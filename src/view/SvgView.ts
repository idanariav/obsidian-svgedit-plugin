import {
  TextFileView,
  WorkspaceLeaf,
  Platform,
  TFile,
  Scope,
  setIcon,
} from "obsidian";
import SvgEditor from "svgedit-editor";
import type SvgPlugin from "../main";
import { extractSvg, replaceSvg, reconcileLinkedFiles, getCanvasBg, setCanvasBg, encodeGradientBg, decodeGradientBg, parseGradientElement, isEmptyDrawing } from "../data/SvgData";
import { refreshLockedEmbeds } from "../data/lockedEmbeds";
import { putBackup, getBackup, deleteBackup } from "../data/drawingBackup";
import { RestoreBackupModal } from "../modals/RestoreBackupModal";
import { VIEW_TYPE_SVG, EMPTY_SVG } from "../constants";
import { autoExport } from "../export/exporter";
import { resolveEffectiveSettings } from "../data/frontmatter";
import type {
  UserShapeStore,
  ClassLibraryEntry,
  CanvasPreset,
  CanvasLayout,
} from "../settings/defaults";
import { listFonts, saveFont } from "../data/fontVault";

interface SvgEditorInstance {
  setConfig(cfg: Record<string, unknown>): void;
  init(): Promise<void>;
  /** Re-read custom palette + saved shapes from the userDataAdapter and re-render
   *  this instance's components. Called after another view edited them. */
  reloadUserData(): void;
  loadFromString(svg: string): Promise<void>;
  /** Set the canvas background. We use it to restore a saved per-drawing color
   *  after load; svgedit also keeps the bottom-panel swatch in sync. Pass
   *  `'gradient'` with a gradient element to restore a gradient background. */
  setBackground(color: string, url?: string, gradientElem?: Element): void;
  /** svgedit's root element; carries the theme-light / theme-dark class. */
  $svgEditor?: HTMLElement;
  /** Tear down document-level listeners this editor registered (multi-instance
   *  cleanup). Present on the reentrant svgedit build. */
  destroy?(): void;
  configObj: { pref(key: string, val?: unknown): unknown };
  svgCanvas: {
    getSvgString(): string;
    /** Serialize the drawing honoring the current save options. With the
     *  `apply` option on it embeds @font-face and base64 images, yielding a
     *  self-contained SVG suitable for export (see getExportSvgString). */
    svgCanvasToString(): string;
    /** The mutable save-options object (apply, images, round_digits…). */
    getSvgOption(): { apply?: boolean; [k: string]: unknown };
    setSvgOption(key: string, value: unknown): void;
    /** Attach a handler to a canvas event. svgedit's `bind` *replaces* any
     *  existing handler for that event and returns the previous one, so chain
     *  it (see the `changed` binding below) rather than dropping it. */
    bind(
      event: string,
      cb: (win: Window, elems: unknown) => void,
    ): ((win: Window, elems: unknown) => void) | undefined;
  };
}


export class SvgView extends TextFileView {
  readonly plugin: SvgPlugin;

  private editorContainer!: HTMLElement;
  /** Topbar save button; its red `.svg-plugin-dirty` state mirrors `dirty`. */
  private saveBtn: HTMLButtonElement | null = null;
  private svgEditor: SvgEditorInstance | null = null;
  private currentData = "";
  private pendingSvg: string | null = null;
  /** Canvas background color awaiting an editor that isn't initialized yet;
   *  paired with pendingSvg and applied once init delivers the drawing. */
  private pendingBg: string | null = null;
  /** Whether the pending content (delivered once the editor inits) must be
   *  persisted — set when a backup was restored before the editor was ready. */
  private pendingDirty = false;
  private isLoading = false;
  /** Set when the canvas has unsaved edits since the last save; cleared by a
   *  successful save. Drives the topbar dirty indicator and the autosave timer.
   *  NB: deliberately named `svgDirty`, not `dirty` — TextFileView already owns a
   *  `dirty` field, and shadowing it crosses our save bookkeeping with Obsidian's. */
  private svgDirty = false;
  /** Pending edit-triggered autosave timeout, or null when none is armed.
   *  Demand-armed from setDirty(true); cleared on the view lifecycle. */
  private autosaveTimer: number | null = null;
  /** Concurrency lock: true while a save is writing. Only runSave() mutates it.
   *  Every other save path checks it so saves never overlap. NB: named `svgSaving`,
   *  not `saving` — TextFileView.save() bails immediately when its own `this.svgSaving`
   *  is truthy, so shadowing it would make every super.save() a silent no-op (the
   *  file would never be written). */
  private svgSaving = false;
  /** Set when an edit lands while a save is in flight, so the save knows not to
   *  clear the svgDirty flag (the new edit still needs flushing). */
  private dirtyDuringSave = false;
  /** True when the companion PNG/SVG export is behind the live canvas. Lets a
   *  settle event (switch-away / close) re-export even if a cheap markdown-only
   *  autosave already cleared `dirty`. */
  private companionStale = true;
  /** Incremented on every load; lets setViewData detect and discard stale clear() loads. */
  private loadGen = 0;
  /** True once the real drawing for the current file has actually been loaded
   *  into the canvas. Until then the canvas holds clear()'s EMPTY_SVG, so it must
   *  never be serialized back to the file (that's the empty-revert data loss). */
  private hasLoadedContent = false;
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

    // Save button — its icon goes red (`.svg-plugin-dirty`) while there are
    // unsaved edits, mirroring the periodic-autosave/dirty state.
    this.saveBtn = toolbar.createEl("button", {
      cls: "svg-plugin-topbar-btn",
      attr: { "aria-label": "Save drawing" },
    });
    setIcon(this.saveBtn, "save");
    this.saveBtn.addEventListener("click", () => void this.save());

    this.editorContainer = this.contentEl.createDiv("svg-plugin-editor-container");

    // Obsidian's built-in "Save current file" (Mod+S) command does not route
    // through a custom TextFileView's save() override, so the keyboard shortcut
    // would persist the drawing without ever clearing the dirty indicator. A
    // view-scoped handler (active while this view is focused) runs our own
    // save() instead; returning false suppresses the default save command so it
    // doesn't double-fire. (Same Obsidian limitation the Excalidraw plugin works
    // around with its own scoped Ctrl+S handler.)
    this.scope = new Scope(this.app.scope);
    this.scope.register(["Mod"], "s", () => {
      void this.save();
      return false;
    });

    // Tie the edit-triggered autosave timer to the view lifecycle so a pending
    // flush can't fire after the view is gone.
    this.register(() => this.clearAutosaveTimer());

    // Flush when the user switches away to another leaf/pane while this drawing
    // has unsaved edits (the same-tab file switch and teardown paths cover the
    // other transitions). Per-view registration auto-unregisters on unload.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf === this.leaf) return;          // we are now the active leaf
        if (!this.svgDirty) return;                  // nothing to flush (spurious fire)
        if (!this.hasLoadedContent || this.isLoading) return; // still loading
        if (!this.svgEditor || !this.file) return;
        void this.settleFlush();
      }),
    );

    try {
      await this.initEditor();
    } catch (e) {
      console.error("[Sketch Editor] Failed to init editor:", e);
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
      // Hide svgedit's drawing-name field in the top bar — Obsidian already shows
      // the file name in the view header / tab, so the in-editor title is redundant.
      hideTitle: true,
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
          this.plugin.reloadUserDataInAllViews();
        },
        getUserShapes: () => this.plugin.settings.userShapes,
        setUserShapes: (store: UserShapeStore) => {
          this.plugin.settings.userShapes = store;
          void this.plugin.saveSettings();
          this.plugin.reloadUserDataInAllViews();
        },
        getHotkeys: () => this.plugin.settings.hotkeyOverrides,
        setHotkeys: (overrides: Record<string, string[]>) => {
          this.plugin.settings.hotkeyOverrides = overrides;
          void this.plugin.saveSettings();
        },
        getFavorites: () => this.plugin.settings.favorites,
        setFavorites: (ids: string[]) => {
          this.plugin.settings.favorites = ids;
          void this.plugin.saveSettings();
        },
        getClasses: () => this.plugin.settings.classLibrary,
        setClasses: (classes: ClassLibraryEntry[]) => {
          this.plugin.settings.classLibrary = classes;
          void this.plugin.saveSettings();
          this.plugin.reloadUserDataInAllViews();
        },
        getCanvasPresets: () => this.plugin.settings.canvasPresets,
        setCanvasPresets: (presets: CanvasPreset[]) => {
          this.plugin.settings.canvasPresets = presets;
          void this.plugin.saveSettings();
        },
        getCanvasLayouts: () => this.plugin.settings.canvasLayouts,
        setCanvasLayouts: (layouts: CanvasLayout[]) => {
          this.plugin.settings.canvasLayouts = layouts;
          void this.plugin.saveSettings();
        },
        // Fonts live as .woff2 files in a synced vault folder (not data.json),
        // so they sync like any vault content. Async because vault I/O is async;
        // svgedit's fontStore already awaits these.
        getFonts: () =>
          listFonts(this.app.vault, this.plugin.settings.fontsFolder),
        saveFont: (family: string, woff2Base64: string) =>
          saveFont(
            this.app.vault,
            this.plugin.settings.fontsFolder,
            family,
            woff2Base64,
          ),
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

    // svgedit binds `changed` to its own Editor.elementChanged (which updates
    // the context panel, the empty-canvas brand watermark, etc.). bind()
    // *replaces* the handler, so preserve and chain svgedit's original instead
    // of clobbering it — otherwise those updates stop firing after init.
    const prevChanged = this.svgEditor.svgCanvas.bind("changed", (win, elems) => {
      prevChanged?.(win, elems);
      // Just flag the edit; the edit-triggered autosave timer (and the explicit
      // flushes on switch-away / toggle / close / file-switch) own the actual
      // save+export. We deliberately don't save on every change — that would
      // re-run the PNG export constantly. setDirty arms the autosave timer.
      if (!this.isLoading) this.setDirty(true);
    });

    // Deliver SVG that arrived before the editor was ready
    if (this.pendingSvg !== null) {
      const svg = this.pendingSvg;
      const bg = this.pendingBg;
      this.pendingSvg = null;
      this.pendingBg = null;
      this.isLoading = true;
      try {
        await this.svgEditor.loadFromString(svg);
        if (bg) this.applyCanvasBg(bg);
        this.hasLoadedContent = true;
      } finally { this.isLoading = false; }
      // A backup restored before init must be written back to the empty file.
      if (this.pendingDirty) {
        this.pendingDirty = false;
        this.setDirty(true);
      }
    }
  }

  /** Single place that mutates `dirty`, so the topbar save button's red state
   *  always tracks it. An edit (`value === true`) arriving while a save is in
   *  flight is recorded in `dirtyDuringSave` instead of mutating `dirty`, so the
   *  running save won't clear it away — runSave's `finally` re-arms the timer. */
  private setDirty(value: boolean): void {
    if (value && this.svgSaving) { this.dirtyDuringSave = true; return; }
    this.svgDirty = value;
    if (value) this.companionStale = true;
    this.saveBtn?.toggleClass("svg-plugin-dirty", value);
    if (value) this.scheduleAutosave();
  }

  /** Edit-triggered autosave. Armed from setDirty(true) and counted from the
   *  user's last edit (not a fixed wall clock), so a drawing flushes ~N seconds
   *  after they stop drawing. A safety net against losing in-progress work to a
   *  crash — switching away, toggling view and closing/switching files flush on
   *  their own. Disabled when the interval is 0. */
  private scheduleAutosave(): void {
    const seconds = this.plugin.settings.autosaveSeconds;
    if (!seconds || seconds <= 0) return;
    // Already armed: don't reset on every edit, or continuous drawing would
    // starve the save indefinitely. The first edit since the last flush wins.
    if (this.autosaveTimer !== null) return;
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;
      if (this.svgDirty && this.hasLoadedContent && this.svgEditor && this.file && !this.svgSaving) {
        void this.autosaveFlush();
      } else if (this.svgDirty) {
        // Blocked (a save is in flight) but still dirty — retry shortly.
        this.autosaveTimer = window.setTimeout(() => {
          this.autosaveTimer = null;
          this.scheduleAutosave();
        }, 1000);
      }
    }, seconds * 1000);
  }

  private clearAutosaveTimer(): void {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /** The autosave path: a cheap markdown + backup write, no companion export
   *  (PNG/SVG re-rasterization is deferred to settle events). */
  private async autosaveFlush(): Promise<void> {
    if (this.svgSaving || !this.hasLoadedContent) return;
    await this.runSave({ export: false });
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
    // Remember this is a deliberate markdown view so the file-open fallback
    // doesn't bounce it straight back to the editor.
    this.plugin.markdownModeLeaves.set(
      (this.leaf as unknown as { id?: string }).id ?? file.path,
      file.path,
    );
    await this.leaf.setViewState({ type: "markdown", state: { file: file.path } });
  }

  // ── TextFileView interface ─────────────────────────────────────────────────

  async setViewData(data: string, _clear: boolean): Promise<void> {
    this.currentData = data;
    const gen = ++this.loadGen; // uniquely identifies this load
    let stored = extractSvg(data) ?? EMPTY_SVG;

    // Recovery net: the saved drawing is empty but a non-empty backup from a
    // previous session exists — the empty-revert bug (or a sync conflict/crash)
    // likely struck. Offer to restore rather than silently loading blank.
    let restored = false;
    if (this.file && isEmptyDrawing(stored)) {
      const backup = await getBackup(this.file.path);
      if (this.loadGen !== gen) return;
      if (backup && !isEmptyDrawing(backup)) {
        const choice = await new Promise<"restore" | "discard" | "cancel">((resolve) =>
          new RestoreBackupModal(this.app, this.file!.basename, resolve).open(),
        );
        if (this.loadGen !== gen) return;
        if (choice === "restore") {
          stored = backup;
          restored = true;
        } else if (choice === "discard") {
          void deleteBackup(this.file.path);
        }
      }
    }

    // The per-drawing canvas background is stashed on the saved root <svg>.
    // Pull it out and strip it before handing the SVG to the editor, so the
    // live canvas (and its exports) never carry our bookkeeping attribute.
    const bg = getCanvasBg(stored);
    const raw = setCanvasBg(stored, null);
    // Locked imports are re-baked from their source on every open so a drawing
    // always reflects the latest version of what it embeds.
    const svg = await refreshLockedEmbeds(this.app, raw, this.file?.path ?? "");
    if (this.loadGen !== gen) return; // a newer load superseded us during the re-bake

    if (this.svgEditor) {
      this.isLoading = true;
      try {
        await this.svgEditor.loadFromString(svg);
        // Restore after load; svgedit's loadFromString doesn't touch the
        // background, but a fresh editor instance starts from the white default.
        if (bg) this.applyCanvasBg(bg);
        this.hasLoadedContent = true;
      } finally {
        // Only release the loading guard if a newer call hasn't already taken over.
        if (this.loadGen === gen) this.isLoading = false;
      }
      // A restored backup must be written back to the (empty) file.
      if (restored) this.setDirty(true);
    } else {
      this.pendingSvg = svg;
      this.pendingBg = bg;
      this.pendingDirty = restored;
    }
  }

  getViewData(): string {
    // Until the real drawing has loaded, the canvas holds clear()'s EMPTY_SVG.
    // Return the last-known file content instead, so any save during the load
    // window is a no-op rather than overwriting the file with blank.
    if (!this.svgEditor || !this.hasLoadedContent) return this.currentData;
    const svg = this.stampCanvasBg(this.svgEditor.svgCanvas.getSvgString());
    const compress = this.plugin.settings.compressDrawingData;
    return reconcileLinkedFiles(replaceSvg(this.currentData, svg, compress), svg);
  }

  /** Stamp the editor's current canvas background onto the SVG root so it
   *  persists per-drawing. White (the default) is omitted, so unedited drawings
   *  don't gain the attribute and absence simply means white. */
  private stampCanvasBg(svg: string): string {
    return setCanvasBg(svg, this.canvasBgToken());
  }

  /** The current canvas background as a single persist/export token: a CSS
   *  color, a `gradient:<base64>` token (svgedit keeps the gradient markup in
   *  the `bkgd_gradient` pref), or null when it's the default white. */
  private canvasBgToken(): string | null {
    const color = String(this.svgEditor?.configObj.pref("bkgd_color") ?? "");
    if (color === "gradient") {
      const gradientXml = String(this.svgEditor?.configObj.pref("bkgd_gradient") ?? "");
      return gradientXml ? encodeGradientBg(gradientXml) : null;
    }
    if (!color || /^(#fff(fff)?|white)$/i.test(color)) return null;
    return color;
  }

  /** Restore a persisted canvas-background token onto the live editor. Decodes
   *  a `gradient:<base64>` token back into a gradient element; otherwise treats
   *  the token as a plain color. */
  private applyCanvasBg(token: string): void {
    if (!this.svgEditor) return;
    const gradientXml = decodeGradientBg(token);
    if (gradientXml) {
      const el = parseGradientElement(gradientXml);
      if (el) {
        this.svgEditor.setBackground("gradient", "", el);
        // Electron caches the background rect's paint-server resolution against
        // the gradient's <defs> node. On reopen we restore the gradient right
        // after loadFromString — before the canvas has painted — so it resolves
        // against an unpainted canvas and sticks white. Re-apply once after the
        // first paint: svgedit recreates the <defs> node on every apply, forcing
        // a fresh resolution now that the canvas has rendered.
        requestAnimationFrame(() => this.svgEditor?.setBackground("gradient", "", el));
        return;
      }
    }
    this.svgEditor.setBackground(token, "");
  }

  clear(): void {
    this.currentData = "";
    // A new load lifecycle is starting; the canvas is about to become the empty
    // seed, so nothing must be persisted until setViewData/init delivers content.
    this.hasLoadedContent = false;
    this.pendingDirty = false;
    this.setDirty(false);
    // The drawing about to load matches its on-disk companion image (it was
    // exported on the last save), so nothing is stale until an edit lands.
    this.companionStale = false;
    // Do NOT call loadFromString here.  Obsidian guarantees that setViewData()
    // is always called immediately after clear(), so we let setViewData own all
    // canvas updates.  Calling loadFromString(EMPTY_SVG) here and letting it
    // run un-awaited would race against setViewData's own loadFromString call
    // and could overwrite the correct drawing with a blank canvas.
    this.pendingSvg = EMPTY_SVG; // overridden by setViewData before init finishes
    this.pendingBg = null;
  }

  /** Explicit/settle save: writes the markdown and refreshes the companion
   *  export. The public entry point for the save button, Mod+S, switchToMarkdown
   *  and insertSvgFragment; funnels through runSave so it can't overlap another
   *  save in flight. */
  async save(clear?: boolean): Promise<void> {
    // Never persist an un-loaded canvas: until the real drawing has loaded it
    // still holds clear()'s EMPTY_SVG, and writing it would blank the file.
    if (!this.hasLoadedContent) return;
    if (this.svgSaving) { this.dirtyDuringSave ||= this.svgDirty; return; }
    await this.runSave({ export: true, clear });
  }

  /** The single owner of the `saving` lock. Writes the markdown, refreshes the
   *  IndexedDB backup, and (when `export`) regenerates the companion PNG/SVG.
   *  Dirty is cleared only on a successful write AND only if no edit arrived
   *  while the write was in flight; a failure leaves the drawing dirty so the
   *  edit isn't lost. */
  private async runSave(opts: { export: boolean; clear?: boolean }): Promise<void> {
    this.svgSaving = true;
    this.dirtyDuringSave = false;
    const hadDirty = this.svgDirty;
    try {
      await super.save(opts.clear);
      // Only clear dirty if no edit landed during the write (setDirty routed it
      // into dirtyDuringSave). Otherwise keep it dirty for the next flush.
      if (!this.dirtyDuringSave) {
        this.svgDirty = false;
        this.saveBtn?.toggleClass("svg-plugin-dirty", false);
      }
      if (this.svgEditor && this.file) {
        // Keep a non-empty backup so a future empty open can be recovered.
        const backupSvg = this.stampCanvasBg(this.svgEditor.svgCanvas.getSvgString());
        if (!isEmptyDrawing(backupSvg)) void putBackup(this.file.path, backupSvg);
      }
      if (opts.export) await this.exportCompanions();
    } catch (e) {
      // Don't swallow the edit: restore dirty so the next autosave retries.
      if (hadDirty) {
        this.svgDirty = true;
        this.saveBtn?.toggleClass("svg-plugin-dirty", true);
      }
      console.error("[Sketch Editor] save failed:", e);
    } finally {
      this.svgSaving = false;
      // An edit arrived during the save — re-arm the autosave to flush it.
      if (this.svgDirty || this.dirtyDuringSave) {
        this.dirtyDuringSave = false;
        this.scheduleAutosave();
      }
    }
  }

  /** Regenerate the companion PNG/SVG. Deferred off the frequent autosave path
   *  to settle events (manual save / switch-away / close) so continuous drawing
   *  doesn't thrash the rasterizer. No-ops when companion export is disabled. */
  private async exportCompanions(): Promise<void> {
    if (!this.svgEditor || !this.file) return;
    try {
      const effective = resolveEffectiveSettings(this.app, this.file, this.plugin.settings);
      await autoExport(
        this.app, this.file,
        this.getExportSvgString() ?? this.svgEditor.svgCanvas.getSvgString(),
        this.plugin.settings,
        effective,
        this.getCanvasBgColor(),
      );
      this.companionStale = false;
    } catch (e) {
      console.error("[Sketch Editor] auto-export failed:", e);
    }
  }

  /** A settle-event flush (switch-away): writes the markdown and refreshes the
   *  companion export. Runs even when a cheap autosave already cleared `dirty`,
   *  as long as the companion image is stale, so the PNG catches up on leave. */
  private async settleFlush(): Promise<void> {
    if (this.svgSaving || !this.hasLoadedContent) return;
    if (!this.svgDirty && !this.companionStale) return;
    await this.runSave({ export: true });
  }

  /** Wait (bounded) for an in-flight save to finish, so lifecycle teardown can
   *  flush and destroy the editor without racing a running save. */
  private async waitForSave(maxMs = 4000): Promise<void> {
    const start = Date.now();
    while (this.svgSaving && Date.now() - start < maxMs) {
      await new Promise((r) => window.setTimeout(r, 50));
    }
  }

  /** Flush the outgoing drawing on a same-leaf file switch (this tab opening a
   *  different file), which replaces the editor's content without unloading the
   *  view. With per-edit saving gone, this is what persists unsaved work on
   *  navigation — the periodic timer only covers staying on the same file. */
  async onUnloadFile(file: TFile): Promise<void> {
    this.clearAutosaveTimer();
    // Let any in-flight autosave finish before we flush, so we don't race it.
    await this.waitForSave();
    if ((this.svgDirty || this.companionStale) && this.hasLoadedContent && this.svgEditor && this.file) {
      try { await this.runSave({ export: true }); } catch { /* best-effort */ }
    }
    await super.onUnloadFile(file);
  }

  async onunload(): Promise<void> {
    this.clearAutosaveTimer();
    // Wait for any in-flight save before snapshotting/destroying the canvas, so
    // a running export can't read a torn-down editor.
    await this.waitForSave();
    // Snapshot the live SVG into currentData *before* nulling the editor.
    // This ensures getViewData() still returns the latest drawing if Obsidian
    // calls save() after onunload (e.g. when the user closes the tab quickly).
    // Skip when the real drawing never loaded — the canvas is the empty seed.
    if (this.svgEditor && this.file && this.hasLoadedContent) {
      const svg = this.stampCanvasBg(this.svgEditor.svgCanvas.getSvgString());
      const compress = this.plugin.settings.compressDrawingData;
      this.currentData = reconcileLinkedFiles(replaceSvg(this.currentData, svg, compress), svg);
      try { await this.runSave({ export: true }); } catch { /* best-effort */ }
    }
    // Remove the editor's document-level listeners so a closed drawing can't
    // react to shortcuts/paste on a torn-down canvas or stay the "active" editor.
    try { this.svgEditor?.destroy?.(); } catch { /* best-effort */ }
    this.svgEditor = null;
    this.editorContainer?.empty();
  }

  // ── Public helpers ─────────────────────────────────────────────────────────

  getSvgString(): string | null {
    return this.svgEditor?.svgCanvas.getSvgString() ?? null;
  }

  /** Serialize the drawing as a self-contained SVG for export. svgedit's plain
   *  getSvgString() forces the `apply` save-option off (keeping the persisted
   *  markdown lean), so it omits the @font-face / base64-image embedding that
   *  svgCanvasToString does under `apply`. The raster export path renders the
   *  SVG through an <img>, which has no access to the document's fonts, so
   *  without embedding, custom fonts fall back to a default family. We flip
   *  `apply` on just for this serialization and restore it. */
  getExportSvgString(): string | null {
    const canvas = this.svgEditor?.svgCanvas;
    if (!canvas) return null;
    const prev = canvas.getSvgOption().apply;
    canvas.setSvgOption("apply", true);
    try {
      return canvas.svgCanvasToString();
    } finally {
      canvas.setSvgOption("apply", prev);
    }
  }

  /** The editor's current canvas background as a token for the PNG exporter:
   *  a CSS color, or a `gradient:<base64>` token the exporter bakes into the
   *  SVG (a gradient can't be a ctx.fillStyle). Defaults to white so the export
   *  matches what the canvas shows rather than always being white. */
  getCanvasBgColor(): string {
    return this.canvasBgToken() ?? "#ffffff";
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
    // A deliberate one-off insert — flush it now rather than waiting on the
    // periodic timer, so the embedded file can't be lost to a crash.
    this.setDirty(true);
    await this.save();
  }
}
