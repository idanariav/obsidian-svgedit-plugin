import {
  TextFileView,
  WorkspaceLeaf,
  FileSystemAdapter,
  setIcon,
  TFile,
  normalizePath,
} from "obsidian";
import type SvgPlugin from "../main";
import { extractSvg, replaceSvg } from "../data/SvgData";
import { VIEW_TYPE_SVG, EMPTY_SVG } from "../constants";
import { autoExport } from "../export/exporter";

interface SvgEditorInstance {
  setConfig(cfg: Record<string, unknown>): void;
  init(): Promise<void>;
  loadFromString(svg: string): Promise<void>;
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

    // ── CSS (one <link> per document) ──────────────────────────────────────
    if (!document.getElementById(CSS_ELEM_ID)) {
      document.head.createEl("link", {
        attr: {
          id: CSS_ELEM_ID,
          rel: "stylesheet",
          href: adapter.getResourcePath(`${dist}/svgedit.css`),
        },
      });
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
      noDefaultExtensions: true,
      // Load only the tool extensions; skip file I/O ones (ext-opensave, ext-storage)
      // which require browser file-system APIs unavailable in Obsidian's context.
      extensions: [
        "ext-connector",
        "ext-eyedropper",
        "ext-shapes",
        "ext-polystar",
      ],
      extPath,
      imgPath,
    });

    await this.svgEditor.init();

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
      await autoExport(
        this.app, this.file,
        this.svgEditor.svgCanvas.getSvgString(),
        this.plugin.settings,
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
