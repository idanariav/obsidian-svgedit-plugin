// Must be first: installs an idempotent customElements.define guard before the
// svgedit bundle (pulled in via SvgView) runs its top-level element definitions,
// so re-enabling the plugin doesn't throw "already used with this registry".
import "./compat/customElementsGuard";
import { Plugin, WorkspaceLeaf } from "obsidian";
import { SvgView } from "./view/SvgView";
import { SvgSettingsTab } from "./settings/SettingsTab";
import { DEFAULT_SETTINGS, SvgPluginSettings } from "./settings/defaults";
import { markdownPostProcessor } from "./postprocessor/markdownPostProcessor";
import { installViewStatePatch } from "./postprocessor/setViewStatePatch";
import { InsertFileModal } from "./modals/InsertFileModal";
import {
  fileToDataUri,
  pickVaultFile,
  resolveVaultLink,
  drawingSourceFor,
  hasCompanionMd,
  readDrawingSvg,
  pickFrame,
  pickImportMode,
  svgToDataUri,
} from "./modals/vaultImage";
import { listFrames, prepareSvgForExport } from "./export/frames";
import { IMAGE_EXTENSIONS } from "./constants";
import { NewDrawingModal } from "./modals/NewDrawingModal";
import { registerCommands } from "./commands";
import { registerFileSyncHandlers } from "./fileSync";
import { isSvgDrawingFile } from "./data/frontmatter";
import { VIEW_TYPE_SVG } from "./constants";

const RIBBON_ICON = "pencil";

export default class SvgPlugin extends Plugin {
  settings!: SvgPluginSettings;
  _loaded = false;
  /** Leaves in this set bypass the SVG-redirect in setViewStatePatch for one call. */
  bypassLeaves = new Set<WorkspaceLeaf>();
  /** Paths of all currently known SVG drawing files (used by fileSync handlers). */
  svgDrawingPaths = new Set<string>();

  private uninstallPatch: (() => void) | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register custom view
    this.registerView(
      VIEW_TYPE_SVG,
      (leaf) => new SvgView(leaf, this),
    );

    // Ribbon icon — open new drawing
    this.addRibbonIcon(RIBBON_ICON, "New SVG drawing", () => {
      new NewDrawingModal(
        this.app,
        this.settings.drawingsFolder,
        this.settings.compressDrawingData,
        async ({ path, content }) => {
          const file = await this.app.vault.create(path, content);
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file, { active: true });
        },
      ).open();
    });

    // Markdown post-processor — intercepts ![[drawing.png]] clicks
    this.registerMarkdownPostProcessor((el, ctx) =>
      markdownPostProcessor(el, ctx, this.app),
    );

    // Monkey-patch setViewState to force SvgView for drawing files
    this.uninstallPatch = installViewStatePatch(
      this.app,
      () => this._loaded,
      this.bypassLeaves,
      () => this.settings,
    );

    // Commands
    registerCommands(this);

    // Settings tab
    this.addSettingTab(new SvgSettingsTab(this.app, this));

    this._loaded = true;

    // Host bridge svgedit feature-detects to offer "import/link from vault".
    this.installHostBridge();

    // Register rename/delete sync handlers immediately so the metadataCache
    // "changed" listener starts tracking drawings as soon as they are indexed.
    registerFileSyncHandlers(this);

    // Seed the SVG drawing paths set from all existing vault files. This must
    // wait for onLayoutReady: during onload the metadataCache is not yet
    // populated, so isSvgDrawingFile() (which reads getFileCache) would return
    // false for every file and leave the set empty — breaking rename/delete sync.
    this.app.workspace.onLayoutReady(() => {
      this.app.vault.getMarkdownFiles().forEach((f) => {
        if (isSvgDrawingFile(this.app, f)) this.svgDrawingPaths.add(f.path);
      });
    });
  }

  async onunload(): Promise<void> {
    this._loaded = false;
    this.uninstallPatch?.();
    delete window.svgEditHost;
  }

  /** The vault path the active drawing's links should resolve against. */
  private activeDrawingPath(): string {
    return this.app.workspace.getActiveViewOfType(SvgView)?.file?.path ?? "";
  }

  /**
   * Install the global svgedit reads to let the user pick a vault image/file.
   * Picks resolve a wikilink (via resolveVaultLink) which svgedit stamps onto
   * the inserted element(s) as data-vault-link; the link section is then
   * reconciled from the SVG on save.
   */
  private installHostBridge(): void {
    window.svgEditHost = {
      pickVaultImage: async () => {
        const file = await pickVaultFile(
          this.app,
          "Pick a vault image or drawing to import…",
          (f) => {
            const ext = f.extension.toLowerCase();
            // Skip image exports that have a companion `.md` — the drawing note
            // is offered instead, so the rendered image isn't a duplicate pick.
            if (IMAGE_EXTENSIONS.has(ext)) return !hasCompanionMd(this.app, f);
            return ext === "md" && isSvgDrawingFile(this.app, f);
          },
        );
        if (!file) return null;

        // A drawing source (the picked drawing note, or an image's companion
        // note) can be imported whole or cropped to one of its frames.
        const drawing = drawingSourceFor(this.app, file);
        if (drawing) {
          const svg = await readDrawingSvg(this.app, drawing);
          if (svg) {
            const frames = listFrames(svg);
            const frameName = frames.length ? await pickFrame(this.app, frames.map((f) => f.name)) : "";
            if (frameName === null) return null; // dismissed the frame picker
            const mode = await pickImportMode(this.app);
            if (mode === null) return null; // dismissed the mode picker
            const prepared = prepareSvgForExport(svg, frameName);
            const dataUrl = svgToDataUri(prepared);
            let link = resolveVaultLink(this.app, drawing, this.activeDrawingPath());
            if (frameName) link += `#${frameName}`;
            // An unlocked *whole-drawing* import is inserted as editable SVG
            // elements (svgedit decomposes `editableSvg`). Frame crops can't be
            // decomposed without bringing the whole drawing, so they — and all
            // locked imports — stay frozen/synced <image> embeds.
            if (mode === "unlocked" && !frameName) {
              return { dataUrl, link, editableSvg: prepared };
            }
            return { dataUrl, link, locked: mode === "locked" };
          }
        }

        const mode = await pickImportMode(this.app);
        if (mode === null) return null; // dismissed the mode picker
        const dataUrl = await fileToDataUri(this.app, file);
        const link = resolveVaultLink(this.app, file, this.activeDrawingPath());
        return { dataUrl, link, locked: mode === "locked" };
      },
      listVaultFiles: () => {
        const drawingPath = this.activeDrawingPath();
        // Surface the active drawing first so its own note is the top suggestion.
        const files = this.app.vault
          .getMarkdownFiles()
          .sort((a, b) => {
            if (a.path === drawingPath) return -1;
            if (b.path === drawingPath) return 1;
            return 0;
          });
        return files.map((f) => ({
          path: f.path,
          link: resolveVaultLink(this.app, f, drawingPath),
        }));
      },
    };
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Re-apply the configured editor theme to every open SVG view (used when the
   *  default theme is changed from the settings tab). */
  refreshOpenEditorThemes(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SVG)) {
      const view = leaf.view;
      if (view instanceof SvgView) view.refreshThemeFromSettings();
    }
  }

  /** After one view writes the shared palette/shape library, tell every OTHER
   *  open SVG view to re-read it so live editors stay in sync. */
  reloadUserDataInOtherViews(except: SvgView): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SVG)) {
      const view = leaf.view;
      if (view instanceof SvgView && view !== except) view.reloadUserData();
    }
  }

  /** Open the "insert file from vault" picker for the given SvgView. */
  openInsertFileModal(view: SvgView): void {
    new InsertFileModal(this.app, view).open();
  }
}
