import {
  TextFileView,
  WorkspaceLeaf,
  FileSystemAdapter,
  setIcon,
  normalizePath,
} from "obsidian";
import type SvgPlugin from "../main";
import { extractSvg, replaceSvg } from "../data/SvgData";
import { VIEW_TYPE_SVG, EMPTY_SVG } from "../constants";
import { autoExport } from "../export/exporter";
import { resolveEffectiveSettings } from "../data/frontmatter";

interface SvgEditorInstance {
  setConfig(cfg: Record<string, unknown>): void;
  init(): Promise<void>;
  loadFromString(svg: string): Promise<void>;
  /** svgedit's root element; carries the theme-light / theme-dark class. */
  $svgEditor?: HTMLElement;
  configObj: { pref(key: string, val?: unknown): unknown };
  svgCanvas: {
    getSvgString(): string;
    bind(event: string, cb: () => void): void;
  };
}

// Sentinel on window so we only inject the script tag once across all views.
const SCRIPT_LOADED_KEY = "__svgPluginEditorLoaded";
const CSS_ELEM_ID = "svg-plugin-svgedit-css";

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
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const dist = normalizePath(`${this.plugin.manifest.dir}/svgedit-dist`);

    // ── CSS (one <style> per document) ─────────────────────────────────────
    // Inject svgedit.css as inline <style> content, NOT a <link>. Obsidian loads
    // <script> from app:// resource URLs (the editor runs) but does not reliably
    // apply external <link rel="stylesheet"> from those URLs, which left all of
    // svgedit's light-DOM (side panel, handle, rulers, workarea padding, paper)
    // unstyled while the shadow-DOM components looked fine. Inlining the file
    // content guarantees it applies — the same approach the Excalidraw plugin
    // uses. svgedit.css contains no url() references, so inlining is safe.
    if (!document.getElementById(CSS_ELEM_ID)) {
      // Drop the leading `:root,` selector from svgedit's variable block so its
      // legacy aliases (e.g. --link-color) don't leak onto Obsidian's document
      // root and restyle Obsidian's own UI. The same variables are also declared
      // on `.svg_editor`, so the editor itself stays fully themed.
      const cssText = (await adapter.read(`${dist}/svgedit.css`)).replace(/^:root,$/m, "");
      document.head.createEl("style", { attr: { id: CSS_ELEM_ID } }).textContent = cssText;
    }

    // ── IIFE script (one <script> per document) ────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (!win[SCRIPT_LOADED_KEY]) {
      const jsUrl = adapter.getResourcePath(`${dist}/iife-Editor.js`);
      await new Promise<void>((resolve, reject) => {
        const s = document.head.createEl("script", { attr: { src: jsUrl } });
        s.addEventListener("load", () => { win[SCRIPT_LOADED_KEY] = true; resolve(); });
        s.addEventListener("error", () => reject(new Error(`Failed to load ${jsUrl}`)));
      });
    }

    const EditorCtor = (win.Editor?.default ?? win.Editor) as new (el: HTMLElement) => SvgEditorInstance;

    if (!EditorCtor) throw new Error("window.Editor not found after script load");

    // imgPath and extPath must be absolute URLs (no cache-busting query string).
    const imgPath = adapter.getResourcePath(`${dist}/images/`).split("?")[0];
    const extPath = adapter.getResourcePath(`${dist}/extensions`).split("?")[0];

    this.svgEditor = new EditorCtor(this.editorContainer);
    this.svgEditor.setConfig({
      no_save_warning: true,
      initTool: "select",
      // Apply the persisted editor theme (the user's last in-editor choice, or
      // Obsidian's current mode when set to "auto"). Passing it as a pref — rather
      // than toggling the class after init — keeps svgedit's stored `theme` pref
      // in sync with the applied class, so the ext-theme-toggle works first-click.
      theme: this.resolveInitialTheme(),
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
      extPath,
      imgPath,
    });

    await this.svgEditor.init();

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
    const svg = extractSvg(data) ?? EMPTY_SVG;
    const gen = ++this.loadGen; // uniquely identifies this load

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
    return replaceSvg(this.currentData, this.svgEditor.svgCanvas.getSvgString());
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
      this.currentData = replaceSvg(
        this.currentData,
        this.svgEditor.svgCanvas.getSvgString(),
      );
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
