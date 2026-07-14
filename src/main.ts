// Must be first: installs an idempotent customElements.define guard before the
// svgedit bundle (pulled in via SvgView) runs its top-level element definitions,
// so re-enabling the plugin doesn't throw "already used with this registry".
import "./compat/customElementsGuard";
import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { SvgView } from "./view/SvgView";
import { SvgSettingsTab } from "./settings/SettingsTab";
import { DEFAULT_SETTINGS, SvgPluginSettings } from "./settings/defaults";
import { markdownPostProcessor } from "./postprocessor/markdownPostProcessor";
import { installViewStatePatch } from "./postprocessor/setViewStatePatch";
import { InsertFileModal } from "./modals/InsertFileModal";
import {
  fileToDataUri,
  fileToResourceUrl,
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
import { registerCommands, resolveTemplateSvg } from "./commands";
import { registerFileSyncHandlers } from "./fileSync";
import { isSvgDrawingFile, resolveEffectiveSettings } from "./data/frontmatter";
import { VIEW_TYPE_SVG } from "./constants";

const RIBBON_ICON = "pencil";

export default class SvgPlugin extends Plugin {
  settings!: SvgPluginSettings;
  _loaded = false;
  /** Leaves in this set bypass the SVG-redirect in setViewStatePatch for one call. */
  bypassLeaves = new Set<WorkspaceLeaf>();
  /** leafId → path of a drawing the user explicitly chose to view as markdown.
   *  The file-open fallback (and layout sweep) skip re-redirecting that leaf back
   *  to the SVG editor only for that file, so "Edit as Markdown" sticks without
   *  trapping other drawings later opened into the same leaf. Cleared on detach. */
  markdownModeLeaves = new Map<string, string>();
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
    this.addRibbonIcon(RIBBON_ICON, "New SVG drawing", async () => {
      const templateSvg = await resolveTemplateSvg(this);
      new NewDrawingModal(
        this.app,
        this.settings.drawingsFolder,
        this.settings.compressDrawingData,
        templateSvg,
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
      this.markdownModeLeaves,
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

      // One-time sweep: convert any already-open markdown leaf showing a drawing
      // (e.g. the last-open file restored at launch) to the SVG editor.
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        const f = (leaf.view as { file?: TFile }).file;
        if (f) this.convertMarkdownLeafIfDrawing(leaf, f);
      }

      // Runtime fallback for open paths the setViewState patch misses (notably
      // the Quick Switcher reusing the single markdown leaf on mobile, where
      // Obsidian may not call setViewState at all).
      this.registerEvent(
        this.app.workspace.on("file-open", (file) => {
          if (!file || file.extension !== "md") return;
          for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
            if ((leaf.view as { file?: TFile }).file?.path === file.path) {
              this.convertMarkdownLeafIfDrawing(leaf, file);
            }
          }
        }),
      );
    });
  }

  /** If `leaf` shows `file` as a markdown view but the drawing should open in the
   *  SVG editor (per effective settings) and the user hasn't intentionally chosen
   *  markdown for it, switch the leaf to the SVG view. Backs up the preemptive
   *  setViewStatePatch for open paths it misses. */
  private convertMarkdownLeafIfDrawing(leaf: WorkspaceLeaf, file: TFile): void {
    if (leaf.view?.getViewType() !== "markdown") return;
    const leafId = (leaf as unknown as { id?: string }).id ?? file.path;
    if (this.markdownModeLeaves.get(leafId) === file.path) return; // user chose markdown
    if (!isSvgDrawingFile(this.app, file)) return;
    if (resolveEffectiveSettings(this.app, file, this.settings).openAsMarkdown) return;
    void leaf.setViewState({ type: VIEW_TYPE_SVG, state: { file: file.path } });
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
            // A rendered/cropped drawing frame has no backing file to link to,
            // so "linked" isn't offered here.
            const mode = await pickImportMode(this.app, false);
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
        const link = resolveVaultLink(this.app, file, this.activeDrawingPath());
        if (mode === "linked") {
          return { dataUrl: fileToResourceUrl(this.app, file), link, external: true };
        }
        const dataUrl = await fileToDataUri(this.app, file);
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
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // One-time migration: the autosave interval moved from minutes to seconds.
    // Honor a user's deliberately long minutes value; new installs keep the 15s
    // default. 0 (disabled) is preserved; otherwise clamp to a 5s floor.
    const legacy = data as { autosaveMinutes?: number; autosaveSeconds?: number } | null;
    if (legacy && legacy.autosaveMinutes !== undefined && legacy.autosaveSeconds === undefined) {
      const m = legacy.autosaveMinutes;
      this.settings.autosaveSeconds = m > 0 ? Math.max(5, m * 60) : 0;
      delete (this.settings as { autosaveMinutes?: number }).autosaveMinutes;
      void this.saveSettings();
    }
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

  /** After any view writes the shared palette/shape library, tell every open
   *  SVG view to re-read it so live editors stay in sync. All views are
   *  refreshed (not "all but the source"): with multiple editors the svgedit
   *  user-data adapter is a single shared registry, so the source's identity
   *  isn't reliable here, and re-reading the just-written value is idempotent. */
  reloadUserDataInAllViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SVG)) {
      const view = leaf.view;
      if (view instanceof SvgView) view.reloadUserData();
    }
  }

  /** Open the "insert file from vault" picker for the given SvgView. */
  openInsertFileModal(view: SvgView): void {
    new InsertFileModal(this.app, view).open();
  }
}
