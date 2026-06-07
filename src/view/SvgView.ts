import {
  TextFileView,
  WorkspaceLeaf,
  Platform,
  setIcon,
} from "obsidian";
import SvgEditor from "svgedit-editor";
import type SvgPlugin from "../main";
import { extractSvg, replaceSvg, reconcileLinkedFiles } from "../data/SvgData";
import { refreshLockedEmbeds } from "../data/lockedEmbeds";
import { VIEW_TYPE_SVG, EMPTY_SVG } from "../constants";
import { autoExport } from "../export/exporter";
import { resolveEffectiveSettings } from "../data/frontmatter";
import type { UserShapeStore } from "../settings/defaults";

interface SvgEditorInstance {
  setConfig(cfg: Record<string, unknown>): void;
  init(): Promise<void>;
  /** Re-read custom palette + saved shapes from the userDataAdapter and re-render
   *  this instance's components. Called after another view edited them. */
  reloadUserData(): void;
  loadFromString(svg: string): Promise<void>;
  /** svgedit's root element; carries the theme-light / theme-dark class. */
  $svgEditor?: HTMLElement;
  configObj: { pref(key: string, val?: unknown): unknown };
  svgCanvas: {
    getSvgString(): string;
    bind(event: string, cb: () => void): void;
  };
}


export class SvgView extends TextFileView {
  readonly plugin: SvgPlugin;

  private editorContainer!: HTMLElement;
  private svgEditor: SvgEditorInstance | null = null;
  private currentData = "";
  private pendingSvg: string | null = null;
  private isLoading = false;
  /** Incremented on every load; lets setViewData detect and discard stale clear() loads. */
  private loadGen = 0;
  /** Last theme applied to svgedit's root. Lets the theme-class MutationObserver
   *  distinguish real theme changes from other class changes (e.g. `.open`) and
   *  ignore our own programmatic "auto"-follow updates. */
  private lastTheme: "light" | "dark" = "light";

  constructor(leaf: WorkspaceLeaf, plugin: SvgPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_SVG; }
  getDisplayText(): string { return this.file?.basename ?? "SVG Drawing"; }
  getIcon(): string { return "pencil"; }

  async onload(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("svg-plugin-view");

    // Topbar stays in Obsidian's DOM so global shortcuts (Cmd+P etc.) work
    const toolbar = this.contentEl.createDiv("svg-plugin-topbar");
    const mdBtn = toolbar.createEl("button", {
      cls: "svg-plugin-topbar-btn",
      attr: { "aria-label": "Edit as Markdown" },
    });
    setIcon(mdBtn, "code");
    mdBtn.addEventListener("click", () => this.switchToMarkdown());

    this.editorContainer = this.contentEl.createDiv("svg-plugin-editor-container");

    try {
      await this.initEditor();
    } catch (e) {
      console.error("[SVG Draw] Failed to init editor:", e);
      this.editorContainer.setText(`SVG editor failed to load: ${(e as Error).message}`);
    }
  }

  private async initEditor(): Promise<void> {
    // svgedit ships as a single self-contained ESM bundle that esbuild inlines
    // into this plugin's main.js (see esbuild.config.mjs `alias`). It carries its
    // own CSS, icons and extensions, so there's nothing to fetch from disk — we
    // just instantiate the imported constructor. CSS is injected into
    // document.head by the bundle itself on init (see scopeInjectedCss below).
    const EditorCtor = SvgEditor as new (el: HTMLElement) => SvgEditorInstance;

    this.svgEditor = new EditorCtor(this.editorContainer);
    this.svgEditor.setConfig({
      no_save_warning: true,
      initTool: "select",
      // Apply the persisted editor theme (the user's last in-editor choice, or
      // Obsidian's current mode when set to "auto"). Passing it as a pref — rather
      // than toggling the class after init — keeps svgedit's stored `theme` pref
      // in sync with the applied class, so the ext-theme-toggle works first-click.
      theme: this.resolveInitialTheme(),
      // Touch-first tablet shell vs. standard desktop layout, chosen per platform
      // (PC vs. mobile) in the plugin settings.
      tabletMode: this.resolveTabletMode(),
      // Route the editor's custom palette + saved shape library through the
      // plugin's data store (data.json) instead of svgedit's own localStorage,
      // so these customizations persist across plugin updates and sync with the
      // vault. Reads are synchronous (settings are already loaded); writes are
      // fire-and-forget saves of the full state on every edit.
      userDataAdapter: {
        getPalette: () => this.plugin.settings.paletteOverrides,
        setPalette: (overrides: Record<string, string>) => {
          this.plugin.settings.paletteOverrides = overrides;
          void this.plugin.saveSettings();
          this.plugin.reloadUserDataInOtherViews(this);
        },
        getUserShapes: () => this.plugin.settings.userShapes,
        setUserShapes: (store: UserShapeStore) => {
          this.plugin.settings.userShapes = store;
          void this.plugin.saveSettings();
          this.plugin.reloadUserDataInOtherViews(this);
        },
      },
      // Leave the side panel closed by default (a "PANEL" handle on the right
      // edge), matching the native svgedit UI; the handle toggles it open.
      showlayers: false,
      noDefaultExtensions: true,
      // Mirror svgedit's full default extension set so the Obsidian editor has
      // the same tools and right-hand panels as the native UI. The only ones we
      // omit are the file-I/O extensions (ext-opensave, ext-storage), which need
      // browser file-system / localStorage APIs unavailable in Obsidian's
      // context, and ext-overview_window (disabled upstream for performance).
      // ext-eyedropper is kept even though it is not an upstream default.
      extensions: [
        "ext-connector",
        "ext-grid",
        "ext-markers",
        "ext-panning",
        "ext-shapes",
        "ext-polystar",
        "ext-cutter",
        "ext-curvature",
        "ext-layer_view",
        "ext-theme-toggle",
        "ext-shadow",
        "ext-color-shift",
        "ext-fonts",
        "ext-eyedropper",
      ],
    });

    await this.svgEditor.init();
    this.scopeInjectedCss();

    this.setupThemeSync();

    this.svgEditor.svgCanvas.bind("changed", () => {
      if (!this.isLoading) this.requestSave();
    });

    // Deliver SVG that arrived before the editor was ready
    if (this.pendingSvg !== null) {
      const svg = this.pendingSvg;
      this.pendingSvg = null;
      this.isLoading = true;
      try { await this.svgEditor.loadFromString(svg); } finally { this.isLoading = false; }
    }
  }

  /** The svgedit bundle injects its stylesheet into document.head on init. That
   *  stylesheet declares its CSS variables on `:root, .svg_editor`, so the
   *  `:root` half leaks svgedit's legacy aliases (e.g. --link-color) onto
   *  Obsidian's document root and restyles Obsidian's own UI. Drop the `:root`
   *  selector from the variable block — the same vars on `.svg_editor` keep the
   *  editor fully themed. Idempotent: safe to run after every view's init. */
  private scopeInjectedCss(): void {
    const style = document.querySelector<HTMLStyleElement>("style[data-svgedit-css]");
    if (!style) return;
    const scoped = style.textContent?.replace(/:root,\s*(\.svg_editor)/g, "$1");
    if (scoped && scoped !== style.textContent) style.textContent = scoped;
  }

  /** Re-read the custom palette + saved shapes from the plugin store and
   *  re-render them. Called when another view edited them. No-op until init. */
  reloadUserData(): void {
    this.svgEditor?.reloadUserData();
  }

  /** Re-apply the configured theme to a live editor (called when the default
   *  theme is changed from the settings tab). */
  refreshThemeFromSettings(): void {
    this.applyTheme(this.resolveInitialTheme());
  }

  /** The theme to apply when the editor opens: the user's explicit persisted
   *  choice, or Obsidian's current mode when set to "auto". */
  private resolveInitialTheme(): "light" | "dark" {
    const pref = this.plugin.settings.editorTheme;
    if (pref === "light" || pref === "dark") return pref;
    return document.body.classList.contains("theme-dark") ? "dark" : "light";
  }

  /** Whether svgedit's touch-first tablet shell should be on, per the platform's
   *  configured UI mode (PC vs. mobile). */
  private resolveTabletMode(): boolean {
    const mode = Platform.isMobile
      ? this.plugin.settings.uiModeMobile
      : this.plugin.settings.uiModeDesktop;
    return mode === "tablet";
  }

  /** svgedit's root element, which carries the theme-light / theme-dark class. */
  private getEditorRoot(): HTMLElement | null {
    const root = this.svgEditor?.$svgEditor
      ?? this.editorContainer.querySelector(".svg_editor");
    return root instanceof HTMLElement ? root : null;
  }

  /** Wire up two-way theme syncing:
   *  - A MutationObserver persists the user's in-editor theme toggle so it
   *    survives switching files / restarting Obsidian.
   *  - While the theme is "auto", follow Obsidian's light/dark mode live. */
  private setupThemeSync(): void {
    const root = this.getEditorRoot();
    if (!root) return;
    this.lastTheme = root.classList.contains("theme-dark") ? "dark" : "light";

    const observer = new MutationObserver(() => {
      const theme = root.classList.contains("theme-dark") ? "dark" : "light";
      // Ignore non-theme class changes (e.g. the `.open` side-panel toggle) and
      // our own programmatic "auto"-follow updates (which set lastTheme first).
      if (theme === this.lastTheme) return;
      this.lastTheme = theme;
      // A real theme change here means the user clicked the in-editor toggle —
      // persist it as their explicit choice so it survives reopening / restarts.
      if (this.plugin.settings.editorTheme !== theme) {
        this.plugin.settings.editorTheme = theme;
        void this.plugin.saveSettings();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    this.register(() => observer.disconnect());

    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        if (this.plugin.settings.editorTheme !== "auto") return;
        this.applyTheme(document.body.classList.contains("theme-dark") ? "dark" : "light");
      }),
    );
  }

  /** Programmatically set svgedit's theme for the "auto" Obsidian-follow path.
   *  Updating lastTheme before mutating the class makes the observer treat the
   *  resulting change as our own and skip persisting it. */
  private applyTheme(theme: "light" | "dark"): void {
    if (!this.svgEditor) return;
    const root = this.getEditorRoot();
    if (!root || this.lastTheme === theme) return;
    this.lastTheme = theme;
    this.svgEditor.configObj.pref("theme", theme);
    root.classList.toggle("theme-dark", theme === "dark");
    root.classList.toggle("theme-light", theme === "light");
  }

  private async switchToMarkdown(): Promise<void> {
    const file = this.file;
    if (!file) return;
    // Persist the current drawing before leaving the SVG view.
    await this.save();
    // Bypass the setViewState patch for this one call so Obsidian opens the
    // file as a plain markdown view instead of redirecting back to SVG.
    this.plugin.bypassLeaves.add(this.leaf);
    await this.leaf.setViewState({ type: "markdown", state: { file: file.path } });
  }

  // ── TextFileView interface ─────────────────────────────────────────────────

  async setViewData(data: string, _clear: boolean): Promise<void> {
    this.currentData = data;
    const gen = ++this.loadGen; // uniquely identifies this load
    const raw = extractSvg(data) ?? EMPTY_SVG;
    // Locked imports are re-baked from their source on every open so a drawing
    // always reflects the latest version of what it embeds.
    const svg = await refreshLockedEmbeds(this.app, raw, this.file?.path ?? "");
    if (this.loadGen !== gen) return; // a newer load superseded us during the re-bake

    if (this.svgEditor) {
      this.isLoading = true;
      try {
        await this.svgEditor.loadFromString(svg);
      } finally {
        // Only release the loading guard if a newer call hasn't already taken over.
        if (this.loadGen === gen) this.isLoading = false;
      }
    } else {
      this.pendingSvg = svg;
    }
  }

  getViewData(): string {
    if (!this.svgEditor) return this.currentData;
    const svg = this.svgEditor.svgCanvas.getSvgString();
    const compress = this.plugin.settings.compressDrawingData;
    return reconcileLinkedFiles(replaceSvg(this.currentData, svg, compress), svg);
  }

  clear(): void {
    this.currentData = "";
    // Do NOT call loadFromString here.  Obsidian guarantees that setViewData()
    // is always called immediately after clear(), so we let setViewData own all
    // canvas updates.  Calling loadFromString(EMPTY_SVG) here and letting it
    // run un-awaited would race against setViewData's own loadFromString call
    // and could overwrite the correct drawing with a blank canvas.
    this.pendingSvg = EMPTY_SVG; // overridden by setViewData before init finishes
  }

  async save(clear?: boolean): Promise<void> {
    await super.save(clear);
    if (!this.svgEditor || !this.file) return;
    try {
      const effective = resolveEffectiveSettings(this.app, this.file, this.plugin.settings);
      await autoExport(
        this.app, this.file,
        this.svgEditor.svgCanvas.getSvgString(),
        this.plugin.settings,
        effective,
      );
    } catch (e) {
      console.error("[SVG Draw] auto-export failed:", e);
    }
  }

  async onunload(): Promise<void> {
    // Snapshot the live SVG into currentData *before* nulling the editor.
    // This ensures getViewData() still returns the latest drawing if Obsidian
    // calls save() after onunload, and also flushes any debounced requestSave()
    // that hasn't fired yet (e.g. when the user closes the tab quickly).
    if (this.svgEditor && this.file) {
      const svg = this.svgEditor.svgCanvas.getSvgString();
      const compress = this.plugin.settings.compressDrawingData;
      this.currentData = reconcileLinkedFiles(replaceSvg(this.currentData, svg, compress), svg);
      try { await this.save(); } catch { /* best-effort */ }
    }
    this.svgEditor = null;
    this.editorContainer?.empty();
  }

  // ── Public helpers ─────────────────────────────────────────────────────────

  getSvgString(): string | null {
    return this.svgEditor?.svgCanvas.getSvgString() ?? null;
  }

  async insertSvgFragment(fragment: string): Promise<void> {
    if (!this.svgEditor) return;

    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const doc = parser.parseFromString(this.svgEditor.svgCanvas.getSvgString(), "image/svg+xml");
    const root = doc.documentElement;
    const fragDoc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`,
      "image/svg+xml",
    );
    for (const child of Array.from(fragDoc.documentElement.childNodes)) {
      root.appendChild(doc.importNode(child, true));
    }
    this.isLoading = true;
    try { await this.svgEditor.loadFromString(serializer.serializeToString(root)); }
    finally { this.isLoading = false; }
    this.requestSave();
  }
}
