import { Plugin, WorkspaceLeaf } from "obsidian";
import { SvgView } from "./view/SvgView";
import { SvgSettingsTab } from "./settings/SettingsTab";
import { DEFAULT_SETTINGS, SvgPluginSettings } from "./settings/defaults";
import { markdownPostProcessor } from "./postprocessor/markdownPostProcessor";
import { installViewStatePatch } from "./postprocessor/setViewStatePatch";
import { InsertFileModal } from "./modals/InsertFileModal";
import { NewDrawingModal } from "./modals/NewDrawingModal";
import { registerCommands } from "./commands";
import { VIEW_TYPE_SVG } from "./constants";

const RIBBON_ICON = "pencil";

export default class SvgPlugin extends Plugin {
  settings!: SvgPluginSettings;
  _loaded = false;
  /** Leaves in this set bypass the SVG-redirect in setViewStatePatch for one call. */
  bypassLeaves = new Set<WorkspaceLeaf>();

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
  }

  async onunload(): Promise<void> {
    this._loaded = false;
    this.uninstallPatch?.();
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

  /** Open the "insert file from vault" picker for the given SvgView. */
  openInsertFileModal(view: SvgView): void {
    new InsertFileModal(this.app, view).open();
  }
}
