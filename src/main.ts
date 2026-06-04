import { Plugin, WorkspaceLeaf } from "obsidian";
import { SvgView } from "./view/SvgView";
import { SvgSettingsTab } from "./settings/SettingsTab";
import { DEFAULT_SETTINGS, SvgPluginSettings } from "./settings/defaults";
import { markdownPostProcessor } from "./postprocessor/markdownPostProcessor";
import { installViewStatePatch } from "./postprocessor/setViewStatePatch";
import { InsertFileModal } from "./modals/InsertFileModal";
import { fileToDataUri, pickVaultFile, resolveVaultLink } from "./modals/vaultImage";
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
          "Pick a vault image to import…",
          (f) => IMAGE_EXTENSIONS.has(f.extension.toLowerCase()),
        );
        if (!file) return null;
        const dataUrl = await fileToDataUri(this.app, file);
        const link = resolveVaultLink(this.app, file, this.activeDrawingPath());
        return { dataUrl, link };
      },
      pickVaultFile: async () => {
        const file = await pickVaultFile(this.app, "Pick a vault file to link…");
        if (!file) return null;
        return { link: resolveVaultLink(this.app, file, this.activeDrawingPath()) };
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

  /** Open the "insert file from vault" picker for the given SvgView. */
  openInsertFileModal(view: SvgView): void {
    new InsertFileModal(this.app, view).open();
  }
}
