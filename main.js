var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SvgPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian10 = require("obsidian");

// src/view/SvgView.ts
var import_obsidian2 = require("obsidian");

// src/constants.ts
var VIEW_TYPE_SVG = "svg-draw-view";
var FRONTMATTER_KEY_PLUGIN = "svg-plugin";
var FRONTMATTER_KEY_OPEN_MD = "svg-open-md";
var FRONTMATTER_KEY_AUTO_EXPORT_PNG = "svg-auto-export-png";
var FRONTMATTER_KEY_TRANSPARENT_BG = "svg-transparent-bg";
var FRONTMATTER_PLUGIN_VALUE = "parsed";
var DRAWING_SECTION_HEADING = "## Drawing";
var DRAWING_FENCE_OPEN = "```svg";
var DRAWING_FENCE_CLOSE = "```";
var DRAWING_SECTION_END = "%%";
var SWITCH_NOTICE = "==\u26A0  Switch to SVG VIEW in the ribbon or right-click menu  \u26A0==";
var EMPTY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><title>SVG Drawing</title></svg>`;
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg"
]);

// src/data/SvgData.ts
var BLOCK_REGEX = /## Drawing\n```svg\n([\s\S]*?)\n```\s*\n%%/;
var BLOCK_REPLACE_REGEX = /## Drawing\n```svg\n[\s\S]*?\n```\s*\n%%/;
function extractSvg(content) {
  const m = BLOCK_REGEX.exec(content);
  return m ? m[1] : null;
}
function replaceSvg(content, newSvg) {
  const block = buildBlock(newSvg);
  if (BLOCK_REPLACE_REGEX.test(content)) {
    return content.replace(BLOCK_REPLACE_REGEX, block);
  }
  return content + "\n\n" + block;
}
function buildBlock(svg) {
  return `${DRAWING_SECTION_HEADING}
${DRAWING_FENCE_OPEN}
${svg}
${DRAWING_FENCE_CLOSE}
${DRAWING_SECTION_END}`;
}
function createDrawingTemplate(svg) {
  const content = svg != null ? svg : EMPTY_SVG;
  return `---
${FRONTMATTER_KEY_PLUGIN}: ${FRONTMATTER_PLUGIN_VALUE}
tags:
  - svg
---

${SWITCH_NOTICE}

${buildBlock(content)}
`;
}

// src/export/exporter.ts
var import_obsidian = require("obsidian");

// src/export/raster.ts
async function svgToPngArrayBuffer(svgString, scale = 1, transparent = false) {
  const blob = await svgToPngBlob(svgString, scale, transparent);
  return blob.arrayBuffer();
}
async function svgToPngBlob(svgString, scale, transparent) {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    if (!svgEl) {
      reject(new Error("Invalid SVG: missing root element"));
      return;
    }
    const width = parseFloat(svgEl.getAttribute("width") || "800");
    const height = parseFloat(svgEl.getAttribute("height") || "600");
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get 2D canvas context"));
      return;
    }
    ctx.scale(scale, scale);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      if (!transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("canvas.toBlob returned null"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG as image"));
    };
    img.src = url;
  });
}

// src/export/exporter.ts
function getCompanionPath(sourcePath, ext, settings) {
  const basename = sourcePath.split("/").pop().replace(/\.md$/, "") + "." + ext;
  let bestLen = 0;
  let exportFolder = "";
  for (const mapping of settings.exportFolderMappings) {
    const srcFolder = mapping.sourceFolder.replace(/\/?$/, "/");
    if (sourcePath.startsWith(srcFolder) && srcFolder.length > bestLen) {
      bestLen = srcFolder.length;
      exportFolder = mapping.exportFolder;
    }
  }
  if (exportFolder) {
    return (0, import_obsidian.normalizePath)(exportFolder.replace(/\/?$/, "/") + basename);
  }
  return (0, import_obsidian.normalizePath)(sourcePath.replace(/\.md$/, "") + "." + ext);
}
async function exportSvg(app, sourceFile, svgString, settings) {
  const path = getCompanionPath(sourceFile.path, "svg", settings);
  await app.vault.adapter.write(path, svgString);
}
async function exportPng(app, sourceFile, svgString, scale, transparent = false, settings) {
  const path = getCompanionPath(sourceFile.path, "png", settings);
  const buf = await svgToPngArrayBuffer(svgString, scale, transparent);
  await app.vault.adapter.writeBinary(path, buf);
}
async function autoExport(app, file, svgString, settings, effective) {
  const tasks = [];
  if (settings.autoExportSvg) tasks.push(exportSvg(app, file, svgString, settings));
  if (effective.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale, effective.transparentBackground, settings));
  await Promise.all(tasks);
}

// src/data/frontmatter.ts
function isSvgDrawingFile(app, file) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  return (fm == null ? void 0 : fm[FRONTMATTER_KEY_PLUGIN]) === FRONTMATTER_PLUGIN_VALUE;
}
function resolveEffectiveSettings(app, file, globalSettings) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  let openAsMarkdown = globalSettings.openAsMarkdown;
  let autoExportPng = globalSettings.autoExportPng;
  let transparentBackground = globalSettings.transparentBackground;
  const folder = resolveFolderConfig(file.path, globalSettings.folderConfigs);
  if (folder) {
    if (folder.openAsMarkdown !== void 0) openAsMarkdown = folder.openAsMarkdown;
    if (folder.autoExportPng !== void 0) autoExportPng = folder.autoExportPng;
    if (folder.transparentBackground !== void 0) transparentBackground = folder.transparentBackground;
  }
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_OPEN_MD]) !== void 0 && fm[FRONTMATTER_KEY_OPEN_MD] !== null)
    openAsMarkdown = !!fm[FRONTMATTER_KEY_OPEN_MD];
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG]) !== void 0 && fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG] !== null)
    autoExportPng = !!fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG];
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_TRANSPARENT_BG]) !== void 0 && fm[FRONTMATTER_KEY_TRANSPARENT_BG] !== null)
    transparentBackground = !!fm[FRONTMATTER_KEY_TRANSPARENT_BG];
  return { openAsMarkdown, autoExportPng, transparentBackground };
}
function resolveFolderConfig(filePath, configs) {
  const slashIdx = filePath.lastIndexOf("/");
  const dir = slashIdx >= 0 ? filePath.substring(0, slashIdx) : "";
  let best = null;
  let bestLen = -1;
  for (const cfg of configs) {
    const f = cfg.folder.replace(/\/$/, "");
    const matches = f === "" ? true : dir === f || dir.startsWith(f + "/");
    if (matches && f.length > bestLen) {
      best = cfg;
      bestLen = f.length;
    }
  }
  return best;
}

// src/view/SvgView.ts
var SCRIPT_LOADED_KEY = "__svgPluginEditorLoaded";
var CSS_ELEM_ID = "svg-plugin-svgedit-css";
var SvgView = class extends import_obsidian2.TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.svgEditor = null;
    this.currentData = "";
    this.pendingSvg = null;
    this.isLoading = false;
    /** Incremented on every load; lets setViewData detect and discard stale clear() loads. */
    this.loadGen = 0;
    /** Last theme applied to svgedit's root. Lets the theme-class MutationObserver
     *  distinguish real theme changes from other class changes (e.g. `.open`) and
     *  ignore our own programmatic "auto"-follow updates. */
    this.lastTheme = "light";
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_SVG;
  }
  getDisplayText() {
    var _a, _b;
    return (_b = (_a = this.file) == null ? void 0 : _a.basename) != null ? _b : "SVG Drawing";
  }
  getIcon() {
    return "pencil";
  }
  async onload() {
    this.contentEl.empty();
    this.contentEl.addClass("svg-plugin-view");
    const toolbar = this.contentEl.createDiv("svg-plugin-topbar");
    const mdBtn = toolbar.createEl("button", {
      cls: "svg-plugin-topbar-btn",
      attr: { "aria-label": "Edit as Markdown" }
    });
    (0, import_obsidian2.setIcon)(mdBtn, "code");
    mdBtn.addEventListener("click", () => this.switchToMarkdown());
    this.editorContainer = this.contentEl.createDiv("svg-plugin-editor-container");
    try {
      await this.initEditor();
    } catch (e) {
      console.error("[SVG Draw] Failed to init editor:", e);
      this.editorContainer.setText(`SVG editor failed to load: ${e.message}`);
    }
  }
  async initEditor() {
    var _a, _b;
    const adapter = this.app.vault.adapter;
    const dist = (0, import_obsidian2.normalizePath)(`${this.plugin.manifest.dir}/svgedit-dist`);
    if (!document.getElementById(CSS_ELEM_ID)) {
      const cssText = (await adapter.read(`${dist}/svgedit.css`)).replace(/^:root,$/m, "");
      document.head.createEl("style", { attr: { id: CSS_ELEM_ID } }).textContent = cssText;
    }
    const win = window;
    if (!win[SCRIPT_LOADED_KEY]) {
      const jsUrl = adapter.getResourcePath(`${dist}/iife-Editor.js`);
      await new Promise((resolve, reject) => {
        const s = document.head.createEl("script", { attr: { src: jsUrl } });
        s.addEventListener("load", () => {
          win[SCRIPT_LOADED_KEY] = true;
          resolve();
        });
        s.addEventListener("error", () => reject(new Error(`Failed to load ${jsUrl}`)));
      });
    }
    const EditorCtor = (_b = (_a = win.Editor) == null ? void 0 : _a.default) != null ? _b : win.Editor;
    if (!EditorCtor) throw new Error("window.Editor not found after script load");
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
        "ext-eyedropper"
      ],
      extPath,
      imgPath
    });
    await this.svgEditor.init();
    this.setupThemeSync();
    this.svgEditor.svgCanvas.bind("changed", () => {
      if (!this.isLoading) this.requestSave();
    });
    if (this.pendingSvg !== null) {
      const svg = this.pendingSvg;
      this.pendingSvg = null;
      this.isLoading = true;
      try {
        await this.svgEditor.loadFromString(svg);
      } finally {
        this.isLoading = false;
      }
    }
  }
  /** Re-apply the configured theme to a live editor (called when the default
   *  theme is changed from the settings tab). */
  refreshThemeFromSettings() {
    this.applyTheme(this.resolveInitialTheme());
  }
  /** The theme to apply when the editor opens: the user's explicit persisted
   *  choice, or Obsidian's current mode when set to "auto". */
  resolveInitialTheme() {
    const pref = this.plugin.settings.editorTheme;
    if (pref === "light" || pref === "dark") return pref;
    return document.body.classList.contains("theme-dark") ? "dark" : "light";
  }
  /** svgedit's root element, which carries the theme-light / theme-dark class. */
  getEditorRoot() {
    var _a, _b;
    const root = (_b = (_a = this.svgEditor) == null ? void 0 : _a.$svgEditor) != null ? _b : this.editorContainer.querySelector(".svg_editor");
    return root instanceof HTMLElement ? root : null;
  }
  /** Wire up two-way theme syncing:
   *  - A MutationObserver persists the user's in-editor theme toggle so it
   *    survives switching files / restarting Obsidian.
   *  - While the theme is "auto", follow Obsidian's light/dark mode live. */
  setupThemeSync() {
    const root = this.getEditorRoot();
    if (!root) return;
    this.lastTheme = root.classList.contains("theme-dark") ? "dark" : "light";
    const observer = new MutationObserver(() => {
      const theme = root.classList.contains("theme-dark") ? "dark" : "light";
      if (theme === this.lastTheme) return;
      this.lastTheme = theme;
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
      })
    );
  }
  /** Programmatically set svgedit's theme for the "auto" Obsidian-follow path.
   *  Updating lastTheme before mutating the class makes the observer treat the
   *  resulting change as our own and skip persisting it. */
  applyTheme(theme) {
    if (!this.svgEditor) return;
    const root = this.getEditorRoot();
    if (!root || this.lastTheme === theme) return;
    this.lastTheme = theme;
    this.svgEditor.configObj.pref("theme", theme);
    root.classList.toggle("theme-dark", theme === "dark");
    root.classList.toggle("theme-light", theme === "light");
  }
  async switchToMarkdown() {
    const file = this.file;
    if (!file) return;
    await this.save();
    this.plugin.bypassLeaves.add(this.leaf);
    await this.leaf.setViewState({ type: "markdown", state: { file: file.path } });
  }
  // ── TextFileView interface ─────────────────────────────────────────────────
  async setViewData(data, _clear) {
    var _a;
    this.currentData = data;
    const svg = (_a = extractSvg(data)) != null ? _a : EMPTY_SVG;
    const gen = ++this.loadGen;
    if (this.svgEditor) {
      this.isLoading = true;
      try {
        await this.svgEditor.loadFromString(svg);
      } finally {
        if (this.loadGen === gen) this.isLoading = false;
      }
    } else {
      this.pendingSvg = svg;
    }
  }
  getViewData() {
    if (!this.svgEditor) return this.currentData;
    return replaceSvg(this.currentData, this.svgEditor.svgCanvas.getSvgString());
  }
  clear() {
    this.currentData = "";
    this.pendingSvg = EMPTY_SVG;
  }
  async save(clear) {
    await super.save(clear);
    if (!this.svgEditor || !this.file) return;
    try {
      const effective = resolveEffectiveSettings(this.app, this.file, this.plugin.settings);
      await autoExport(
        this.app,
        this.file,
        this.svgEditor.svgCanvas.getSvgString(),
        this.plugin.settings,
        effective
      );
    } catch (e) {
      console.error("[SVG Draw] auto-export failed:", e);
    }
  }
  async onunload() {
    var _a;
    if (this.svgEditor && this.file) {
      this.currentData = replaceSvg(
        this.currentData,
        this.svgEditor.svgCanvas.getSvgString()
      );
      try {
        await this.save();
      } catch (e) {
      }
    }
    this.svgEditor = null;
    (_a = this.editorContainer) == null ? void 0 : _a.empty();
  }
  // ── Public helpers ─────────────────────────────────────────────────────────
  getSvgString() {
    var _a, _b;
    return (_b = (_a = this.svgEditor) == null ? void 0 : _a.svgCanvas.getSvgString()) != null ? _b : null;
  }
  async insertSvgFragment(fragment) {
    if (!this.svgEditor) return;
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const doc = parser.parseFromString(this.svgEditor.svgCanvas.getSvgString(), "image/svg+xml");
    const root = doc.documentElement;
    const fragDoc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`,
      "image/svg+xml"
    );
    for (const child of Array.from(fragDoc.documentElement.childNodes)) {
      root.appendChild(doc.importNode(child, true));
    }
    this.isLoading = true;
    try {
      await this.svgEditor.loadFromString(serializer.serializeToString(root));
    } finally {
      this.isLoading = false;
    }
    this.requestSave();
  }
};

// src/settings/SettingsTab.ts
var import_obsidian3 = require("obsidian");
function toTriState(value) {
  if (value === void 0) return "inherit";
  return value ? "true" : "false";
}
function fromTriState(value) {
  if (value === "inherit") return void 0;
  return value === "true";
}
var SvgSettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "SVG Draw" });
    new import_obsidian3.Setting(containerEl).setHeading().setName("Open mode");
    new import_obsidian3.Setting(containerEl).setName("Open as Markdown by default").setDesc(
      "When no per-file or per-folder override exists, open drawings in Markdown view instead of the SVG editor."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.openAsMarkdown).onChange(async (v) => {
        this.plugin.settings.openAsMarkdown = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setHeading().setName("Appearance");
    new import_obsidian3.Setting(containerEl).setName("Editor theme").setDesc(
      `Default theme for the SVG editor. "Match Obsidian" follows Obsidian's light/dark mode; toggling the theme inside the editor updates this setting.`
    ).addDropdown(
      (d) => d.addOptions({
        auto: "Match Obsidian",
        light: "Light",
        dark: "Dark"
      }).setValue(this.plugin.settings.editorTheme).onChange(async (v) => {
        this.plugin.settings.editorTheme = v;
        await this.plugin.saveSettings();
        this.plugin.refreshOpenEditorThemes();
      })
    );
    new import_obsidian3.Setting(containerEl).setHeading().setName("Auto-export");
    new import_obsidian3.Setting(containerEl).setName("Export SVG on save").setDesc("Write a companion .svg file next to the drawing on every save.").addToggle(
      (t) => t.setValue(this.plugin.settings.autoExportSvg).onChange(async (v) => {
        this.plugin.settings.autoExportSvg = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Export PNG on save").setDesc("Write a companion .png file next to the drawing on every save.").addToggle(
      (t) => t.setValue(this.plugin.settings.autoExportPng).onChange(async (v) => {
        this.plugin.settings.autoExportPng = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Transparent PNG background").setDesc(
      "Export PNGs with a transparent background. When off, a white fill is painted behind the drawing."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.transparentBackground).onChange(async (v) => {
        this.plugin.settings.transparentBackground = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("PNG scale").setDesc("Pixel density multiplier for exported PNGs (1 = 1:1, 2 = 2\xD7).").addDropdown(
      (d) => d.addOptions({ "0.5": "0.5\xD7", "1": "1\xD7", "2": "2\xD7", "4": "4\xD7" }).setValue(String(this.plugin.settings.pngScale)).onChange(async (v) => {
        this.plugin.settings.pngScale = parseFloat(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setHeading().setName("File sync");
    new import_obsidian3.Setting(containerEl).setName("Keep companion files in sync").setDesc(
      "When a drawing is renamed or deleted, automatically rename/delete its companion .svg and .png files."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.keepInSync).onChange(async (v) => {
        this.plugin.settings.keepInSync = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setHeading().setName("New drawing defaults");
    new import_obsidian3.Setting(containerEl).setName("Canvas width").addText(
      (t) => t.setValue(String(this.plugin.settings.defaultCanvasWidth)).onChange(async (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n > 0) {
          this.plugin.settings.defaultCanvasWidth = n;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Canvas height").addText(
      (t) => t.setValue(String(this.plugin.settings.defaultCanvasHeight)).onChange(async (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n > 0) {
          this.plugin.settings.defaultCanvasHeight = n;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Drawings folder").setDesc(
      "Default vault folder for new drawings (e.g. Drawings). Leave blank for vault root."
    ).addText(
      (t) => t.setPlaceholder("Drawings").setValue(this.plugin.settings.drawingsFolder).onChange(async (v) => {
        this.plugin.settings.drawingsFolder = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setHeading().setName("Folder overrides");
    containerEl.createEl("p", {
      text: 'Per-folder settings override the global defaults above. Use "Inherit" to fall back to the global value. Individual file frontmatter (svg-open-md, svg-auto-export-png, svg-transparent-bg) takes highest priority.',
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).addButton(
      (btn) => btn.setButtonText("+ Add folder").setCta().onClick(async () => {
        this.plugin.settings.folderConfigs.push({ folder: "" });
        await this.plugin.saveSettings();
        this.display();
      })
    );
    for (let i = 0; i < this.plugin.settings.folderConfigs.length; i++) {
      this.renderFolderBlock(containerEl, i);
    }
    new import_obsidian3.Setting(containerEl).setHeading().setName("Export folder mappings");
    containerEl.createEl("p", {
      text: "Map drawings in a source folder to a different export folder for their companion .svg and .png files. Longest-prefix match wins. If no mapping matches, companions are exported next to the drawing.",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).addButton(
      (btn) => btn.setButtonText("+ Add mapping").setCta().onClick(async () => {
        this.plugin.settings.exportFolderMappings.push({ sourceFolder: "", exportFolder: "" });
        await this.plugin.saveSettings();
        this.display();
      })
    );
    for (let i = 0; i < this.plugin.settings.exportFolderMappings.length; i++) {
      this.renderMappingRow(containerEl, i);
    }
  }
  renderMappingRow(containerEl, index) {
    const mapping = this.plugin.settings.exportFolderMappings[index];
    const wrapper = containerEl.createDiv("svg-plugin-mapping-row");
    wrapper.style.cssText = "border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;";
    new import_obsidian3.Setting(wrapper).setName("Source folder").setDesc("Drawings in this vault folder (and sub-folders) use the custom export path.").addText(
      (t) => t.setPlaceholder("Content/Concepts").setValue(mapping.sourceFolder).onChange(async (v) => {
        this.plugin.settings.exportFolderMappings[index].sourceFolder = v.trim();
        await this.plugin.saveSettings();
      })
    ).addButton(
      (btn) => btn.setIcon("trash").setTooltip("Remove this mapping").onClick(async () => {
        this.plugin.settings.exportFolderMappings.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian3.Setting(wrapper).setName("Export folder").setDesc("Companion files are written here instead of next to the drawing.").addText(
      (t) => t.setPlaceholder("Assets/Concepts").setValue(mapping.exportFolder).onChange(async (v) => {
        this.plugin.settings.exportFolderMappings[index].exportFolder = v.trim();
        await this.plugin.saveSettings();
      })
    );
  }
  renderFolderBlock(containerEl, index) {
    const cfg = this.plugin.settings.folderConfigs[index];
    const wrapper = containerEl.createDiv("svg-plugin-folder-block");
    wrapper.style.cssText = "border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;";
    new import_obsidian3.Setting(wrapper).setName("Folder path").setDesc("Vault-relative path, e.g. Drawings/work").addText(
      (t) => t.setPlaceholder("Folder/Path").setValue(cfg.folder).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].folder = v.trim();
        await this.plugin.saveSettings();
      })
    ).addButton(
      (btn) => btn.setIcon("trash").setTooltip("Remove this folder override").onClick(async () => {
        this.plugin.settings.folderConfigs.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian3.Setting(wrapper).setName("Open as").setDesc("How to open drawings in this folder by default.").addDropdown(
      (d) => d.addOptions({
        inherit: "Inherit (global default)",
        "false": "SVG editor",
        "true": "Markdown view"
      }).setValue(toTriState(cfg.openAsMarkdown)).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].openAsMarkdown = fromTriState(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(wrapper).setName("Auto-export PNG").setDesc("Whether to write a companion .png file on save.").addDropdown(
      (d) => d.addOptions({
        inherit: "Inherit (global default)",
        "true": "Yes",
        "false": "No"
      }).setValue(toTriState(cfg.autoExportPng)).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].autoExportPng = fromTriState(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(wrapper).setName("Transparent PNG background").setDesc("Whether exported PNGs use a transparent background.").addDropdown(
      (d) => d.addOptions({
        inherit: "Inherit (global default)",
        "true": "Yes \u2014 transparent",
        "false": "No \u2014 white fill"
      }).setValue(toTriState(cfg.transparentBackground)).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].transparentBackground = fromTriState(v);
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/settings/defaults.ts
var DEFAULT_SETTINGS = {
  autoExportSvg: true,
  autoExportPng: true,
  pngScale: 1,
  defaultCanvasWidth: 800,
  defaultCanvasHeight: 600,
  drawingsFolder: "",
  openAsMarkdown: false,
  transparentBackground: false,
  folderConfigs: [],
  keepInSync: false,
  exportFolderMappings: [],
  editorTheme: "auto"
};

// src/postprocessor/markdownPostProcessor.ts
var import_obsidian4 = require("obsidian");
async function markdownPostProcessor(el, ctx, app) {
  const embeds = el.querySelectorAll(".internal-embed");
  if (embeds.length === 0) return;
  for (const embed of Array.from(embeds)) {
    const src = embed.getAttribute("src");
    if (!src) continue;
    if (!/\.(png|svg)$/i.test(src)) continue;
    const sourceMd = findSourceMd(app, src);
    if (!sourceMd) continue;
    embed.style.cursor = "pointer";
    embed.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const leaf = app.workspace.getLeaf(false);
      leaf.openFile(sourceMd, { active: true });
    });
  }
}
function findSourceMd(app, imageSrc) {
  const mdPath = (0, import_obsidian4.normalizePath)(
    imageSrc.replace(/\.(png|svg)$/i, ".md")
  );
  const candidate = app.vault.getAbstractFileByPath(mdPath);
  if (candidate instanceof import_obsidian4.TFile && isSvgDrawingFile(app, candidate)) {
    return candidate;
  }
  const resolved = app.metadataCache.getFirstLinkpathDest(
    imageSrc.replace(/\.(png|svg)$/i, ""),
    ""
  );
  if (resolved) {
    const mdPath2 = (0, import_obsidian4.normalizePath)(resolved.path.replace(/\.(png|svg)$/i, ".md"));
    const candidate2 = app.vault.getAbstractFileByPath(mdPath2);
    if (candidate2 instanceof import_obsidian4.TFile && isSvgDrawingFile(app, candidate2)) {
      return candidate2;
    }
  }
  return null;
}

// src/postprocessor/setViewStatePatch.ts
var import_obsidian5 = require("obsidian");

// node_modules/monkey-around/mjs/index.js
function around(obj, factories) {
  const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
  return removers.length === 1 ? removers[0] : function() {
    removers.forEach((r) => r());
  };
}
function around1(obj, method, createWrapper) {
  const original = obj[method], hadOwn = obj.hasOwnProperty(method);
  let current = createWrapper(original);
  if (original)
    Object.setPrototypeOf(current, original);
  Object.setPrototypeOf(wrapper, current);
  obj[method] = wrapper;
  return remove;
  function wrapper(...args) {
    if (current === original && obj[method] === wrapper)
      remove();
    return current.apply(this, args);
  }
  function remove() {
    if (obj[method] === wrapper) {
      if (hadOwn)
        obj[method] = original;
      else
        delete obj[method];
    }
    if (current === original)
      return;
    current = original;
    Object.setPrototypeOf(wrapper, original || Function);
  }
}

// src/postprocessor/setViewStatePatch.ts
function installViewStatePatch(app, isLoaded, bypassLeaves, getSettings) {
  return around(import_obsidian5.WorkspaceLeaf.prototype, {
    setViewState(next) {
      return function(state, eState) {
        var _a, _b;
        if (bypassLeaves.has(this)) {
          bypassLeaves.delete(this);
          return next.call(this, state, eState);
        }
        if (isLoaded() && state.type === "markdown" && typeof ((_a = state.state) == null ? void 0 : _a.file) === "string") {
          if (((_b = this.view) == null ? void 0 : _b.getViewType()) === "markdown") {
            return next.call(this, state, eState);
          }
          const filepath = state.state.file;
          const file = app.vault.getAbstractFileByPath(filepath);
          if (file instanceof import_obsidian5.TFile && isSvgDrawingFile(app, file)) {
            const effective = resolveEffectiveSettings(app, file, getSettings());
            if (!effective.openAsMarkdown) {
              return next.call(this, { ...state, type: VIEW_TYPE_SVG }, eState);
            }
          }
        }
        return next.call(this, state, eState);
      };
    }
  });
}

// src/modals/InsertFileModal.ts
var import_obsidian6 = require("obsidian");
var InsertFileModal = class extends import_obsidian6.FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.setPlaceholder("Pick a vault file to insert into the drawing\u2026");
  }
  getItems() {
    return this.app.vault.getFiles();
  }
  getItemText(file) {
    return file.path;
  }
  async onChooseItem(file) {
    const ext = file.extension.toLowerCase();
    try {
      if (IMAGE_EXTENSIONS.has(ext)) {
        await this.insertImage(file);
      } else {
        await this.insertWikiLink(file);
      }
    } catch (e) {
      new import_obsidian6.Notice(`Insert failed: ${e.message}`);
    }
  }
  async insertImage(file) {
    const binary = await this.app.vault.readBinary(file);
    const b64 = arrayBufferToBase64(binary);
    const mime = getMimeType(file.extension);
    const dataUri = `data:${mime};base64,${b64}`;
    const fragment = `<image href="${dataUri}" x="50" y="50" width="200" height="200"/>`;
    await this.view.insertSvgFragment(fragment);
  }
  async insertWikiLink(file) {
    const linkText = this.app.metadataCache.fileToLinktext(file, "");
    const escaped = linkText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fragment = `<text x="50" y="80" font-family="sans-serif" font-size="16" fill="currentColor">[[${escaped}]]</text>`;
    await this.view.insertSvgFragment(fragment);
  }
};
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function getMimeType(ext) {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

// src/modals/NewDrawingModal.ts
var import_obsidian7 = require("obsidian");
var NewDrawingModal = class extends import_obsidian7.Modal {
  constructor(app, defaultFolder, onSubmit) {
    super(app);
    this.name = "Untitled";
    this.folder = defaultFolder;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "New SVG Drawing" });
    new import_obsidian7.Setting(contentEl).setName("Name").setDesc("File name (without extension)").addText(
      (text) => text.setValue(this.name).onChange((v) => this.name = v.trim()).inputEl.focus()
    );
    new import_obsidian7.Setting(contentEl).setName("Folder").setDesc("Vault path for the new file (leave blank for vault root)").addText(
      (text) => text.setValue(this.folder).onChange((v) => this.folder = v.trim())
    );
    new import_obsidian7.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Create").setCta().onClick(() => {
        if (!this.name) return;
        const dir = this.folder ? this.folder.replace(/\/$/, "") + "/" : "";
        const path = (0, import_obsidian7.normalizePath)(`${dir}${this.name}.md`);
        this.onSubmit({ path, content: createDrawingTemplate() });
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/commands.ts
var import_obsidian8 = require("obsidian");
function registerCommands(plugin) {
  plugin.addCommand({
    id: "new-svg-drawing",
    name: "New SVG drawing",
    callback: () => {
      new NewDrawingModal(
        plugin.app,
        plugin.settings.drawingsFolder,
        async ({ path, content }) => {
          try {
            const existing = plugin.app.vault.getAbstractFileByPath(path);
            if (existing) {
              new import_obsidian8.Notice(`File already exists: ${path}`);
              return;
            }
            const file = await plugin.app.vault.create(path, content);
            const leaf = plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file, { active: true });
          } catch (e) {
            new import_obsidian8.Notice(`Could not create drawing: ${e.message}`);
          }
        }
      ).open();
    }
  });
  plugin.addCommand({
    id: "convert-to-svg-drawing",
    name: "Convert note to SVG drawing",
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || file.extension !== "md") return false;
      if (isSvgDrawingFile(plugin.app, file)) return false;
      if (!checking) convertNoteToDrawing(plugin, file);
      return true;
    }
  });
  plugin.addCommand({
    id: "insert-file-from-vault",
    name: "Insert file from vault into drawing",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view) return false;
      if (!checking) plugin.openInsertFileModal(view);
      return true;
    }
  });
  plugin.addCommand({
    id: "toggle-svg-md-view",
    name: "Toggle drawing / markdown view",
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || !isSvgDrawingFile(plugin.app, file)) return false;
      if (!checking) toggleViewMode(plugin, file);
      return true;
    }
  });
  plugin.addCommand({
    id: "export-svg",
    name: "Export drawing as SVG",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) {
        const svgString = view.getSvgString();
        if (!svgString) return true;
        exportSvg(plugin.app, view.file, svgString, plugin.settings).then(() => new import_obsidian8.Notice("Exported SVG")).catch((e) => new import_obsidian8.Notice(`Export failed: ${e.message}`));
      }
      return true;
    }
  });
  plugin.addCommand({
    id: "export-png",
    name: "Export drawing as PNG",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) {
        const svgString = view.getSvgString();
        if (!svgString) return true;
        exportPng(plugin.app, view.file, svgString, plugin.settings.pngScale, void 0, plugin.settings).then(() => new import_obsidian8.Notice("Exported PNG")).catch((e) => new import_obsidian8.Notice(`Export failed: ${e.message}`));
      }
      return true;
    }
  });
}
function getActiveSvgView(plugin) {
  const view = plugin.app.workspace.getActiveViewOfType(SvgView);
  return view != null ? view : null;
}
async function convertNoteToDrawing(plugin, file) {
  try {
    await plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm[FRONTMATTER_KEY_PLUGIN] = FRONTMATTER_PLUGIN_VALUE;
      fm[FRONTMATTER_KEY_OPEN_MD] = false;
      if (!Array.isArray(fm.tags)) {
        fm.tags = ["svg"];
      } else if (!fm.tags.includes("svg")) {
        fm.tags.push("svg");
      }
    });
    const content = await plugin.app.vault.read(file);
    if (!extractSvg(content)) {
      await plugin.app.vault.modify(file, replaceSvg(content, EMPTY_SVG));
    }
    const leaf = getActiveLeaf(plugin);
    await leaf.openFile(file, { active: true });
  } catch (e) {
    new import_obsidian8.Notice(`Convert failed: ${e.message}`);
  }
}
async function toggleViewMode(plugin, file) {
  try {
    const leaf = getActiveLeaf(plugin);
    const view = leaf.view;
    if ((view == null ? void 0 : view.getViewType()) === VIEW_TYPE_SVG) {
      await view.save();
      plugin.bypassLeaves.add(leaf);
      await leaf.setViewState({ type: "markdown", state: { file: file.path } });
    } else {
      await leaf.setViewState({ type: VIEW_TYPE_SVG, state: { file: file.path } });
    }
  } catch (e) {
    new import_obsidian8.Notice(`Toggle failed: ${e.message}`);
  }
}
function getActiveLeaf(plugin) {
  var _a, _b, _c;
  return (_c = (_b = (_a = plugin.app.workspace.getActiveViewOfType(SvgView)) == null ? void 0 : _a.leaf) != null ? _b : plugin.app.workspace.getMostRecentLeaf()) != null ? _c : plugin.app.workspace.getLeaf(false);
}

// src/fileSync.ts
var import_obsidian9 = require("obsidian");
function registerFileSyncHandlers(plugin) {
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      var _a;
      const fm = (_a = plugin.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
      if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_PLUGIN]) === FRONTMATTER_PLUGIN_VALUE) {
        plugin.svgDrawingPaths.add(file.path);
      } else {
        plugin.svgDrawingPaths.delete(file.path);
      }
    })
  );
  plugin.registerEvent(
    plugin.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof import_obsidian9.TFile)) return;
      void handleRename(plugin, file, oldPath);
    })
  );
  plugin.registerEvent(
    plugin.app.vault.on("delete", (file) => {
      if (!(file instanceof import_obsidian9.TFile)) return;
      void handleDelete(plugin, file);
    })
  );
}
async function handleRename(plugin, file, oldPath) {
  if (!plugin.settings.keepInSync) return;
  if (!isSvgDrawingFile(plugin.app, file) && !plugin.svgDrawingPaths.has(oldPath)) {
    return;
  }
  plugin.svgDrawingPaths.delete(oldPath);
  plugin.svgDrawingPaths.add(file.path);
  console.debug(
    `[SVG Draw] rename sync: ${oldPath} \u2192 ${file.path} (keepInSync on)`
  );
  for (const ext of ["svg", "png"]) {
    const oldCompanion = (0, import_obsidian9.normalizePath)(getCompanionPath(oldPath, ext, plugin.settings));
    const newCompanion = (0, import_obsidian9.normalizePath)(getCompanionPath(file.path, ext, plugin.settings));
    if (oldCompanion === newCompanion) continue;
    const companionFile = plugin.app.vault.getAbstractFileByPath(oldCompanion);
    console.debug(
      `[SVG Draw] rename sync ${ext}: looking for ${oldCompanion} \u2192 found=${companionFile instanceof import_obsidian9.TFile}`
    );
    if (!(companionFile instanceof import_obsidian9.TFile)) continue;
    if (plugin.app.vault.getAbstractFileByPath(newCompanion) instanceof import_obsidian9.TFile) {
      await plugin.app.vault.delete(companionFile);
      continue;
    }
    try {
      await plugin.app.fileManager.renameFile(companionFile, newCompanion);
    } catch (e) {
      if (plugin.app.vault.getAbstractFileByPath(oldCompanion) instanceof import_obsidian9.TFile) {
        await plugin.app.vault.delete(companionFile);
      }
    }
  }
}
async function handleDelete(plugin, file) {
  if (!plugin.settings.keepInSync) return;
  if (!plugin.svgDrawingPaths.has(file.path)) return;
  plugin.svgDrawingPaths.delete(file.path);
  const companions = ["svg", "png"].map(
    (ext) => getCompanionPath(file.path, ext, plugin.settings)
  );
  window.setTimeout(() => {
    for (const companionPath of companions) {
      const f = plugin.app.vault.getAbstractFileByPath((0, import_obsidian9.normalizePath)(companionPath));
      if (f instanceof import_obsidian9.TFile) plugin.app.vault.delete(f);
    }
  }, 500);
}

// src/main.ts
var RIBBON_ICON = "pencil";
var SvgPlugin = class extends import_obsidian10.Plugin {
  constructor() {
    super(...arguments);
    this._loaded = false;
    /** Leaves in this set bypass the SVG-redirect in setViewStatePatch for one call. */
    this.bypassLeaves = /* @__PURE__ */ new Set();
    /** Paths of all currently known SVG drawing files (used by fileSync handlers). */
    this.svgDrawingPaths = /* @__PURE__ */ new Set();
    this.uninstallPatch = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(
      VIEW_TYPE_SVG,
      (leaf) => new SvgView(leaf, this)
    );
    this.addRibbonIcon(RIBBON_ICON, "New SVG drawing", () => {
      new NewDrawingModal(
        this.app,
        this.settings.drawingsFolder,
        async ({ path, content }) => {
          const file = await this.app.vault.create(path, content);
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file, { active: true });
        }
      ).open();
    });
    this.registerMarkdownPostProcessor(
      (el, ctx) => markdownPostProcessor(el, ctx, this.app)
    );
    this.uninstallPatch = installViewStatePatch(
      this.app,
      () => this._loaded,
      this.bypassLeaves,
      () => this.settings
    );
    registerCommands(this);
    this.addSettingTab(new SvgSettingsTab(this.app, this));
    this._loaded = true;
    registerFileSyncHandlers(this);
    this.app.workspace.onLayoutReady(() => {
      this.app.vault.getMarkdownFiles().forEach((f) => {
        if (isSvgDrawingFile(this.app, f)) this.svgDrawingPaths.add(f.path);
      });
    });
  }
  async onunload() {
    var _a;
    this._loaded = false;
    (_a = this.uninstallPatch) == null ? void 0 : _a.call(this);
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /** Re-apply the configured editor theme to every open SVG view (used when the
   *  default theme is changed from the settings tab). */
  refreshOpenEditorThemes() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SVG)) {
      const view = leaf.view;
      if (view instanceof SvgView) view.refreshThemeFromSettings();
    }
  }
  /** Open the "insert file from vault" picker for the given SvgView. */
  openInsertFileModal(view) {
    new InsertFileModal(this.app, view).open();
  }
};
