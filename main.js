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
var import_obsidian9 = require("obsidian");

// src/view/SvgView.ts
var import_obsidian2 = require("obsidian");

// src/constants.ts
var VIEW_TYPE_SVG = "svg-draw-view";
var FRONTMATTER_KEY_PLUGIN = "svg-plugin";
var FRONTMATTER_KEY_OPEN_MD = "svg-open-md";
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
${FRONTMATTER_KEY_OPEN_MD}: false
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
async function svgToPngArrayBuffer(svgString, scale = 1) {
  const blob = await svgToPngBlob(svgString, scale);
  return blob.arrayBuffer();
}
async function svgToPngBlob(svgString, scale) {
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
function getCompanionPath(sourceFile, ext) {
  const base = sourceFile.path.replace(/\.md$/, "");
  return (0, import_obsidian.normalizePath)(`${base}.${ext}`);
}
async function exportSvg(app, sourceFile, svgString) {
  const path = getCompanionPath(sourceFile, "svg");
  await app.vault.adapter.write(path, svgString);
}
async function exportPng(app, sourceFile, svgString, scale) {
  const path = getCompanionPath(sourceFile, "png");
  const buf = await svgToPngArrayBuffer(svgString, scale);
  await app.vault.adapter.writeBinary(path, buf);
}
async function autoExport(app, file, svgString, settings) {
  const tasks = [];
  if (settings.autoExportSvg) tasks.push(exportSvg(app, file, svgString));
  if (settings.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale));
  await Promise.all(tasks);
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
      document.head.createEl("link", {
        attr: {
          id: CSS_ELEM_ID,
          rel: "stylesheet",
          href: adapter.getResourcePath(`${dist}/svgedit.css`)
        }
      });
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
      noDefaultExtensions: true,
      // Load only the tool extensions; skip file I/O ones (ext-opensave, ext-storage)
      // which require browser file-system APIs unavailable in Obsidian's context.
      extensions: [
        "ext-connector",
        "ext-eyedropper",
        "ext-shapes",
        "ext-polystar"
      ],
      extPath,
      imgPath
    });
    await this.svgEditor.init();
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
      await autoExport(
        this.app,
        this.file,
        this.svgEditor.svgCanvas.getSvgString(),
        this.plugin.settings
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
var SvgSettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "SVG Draw" });
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
    new import_obsidian3.Setting(containerEl).setName("PNG scale").setDesc("Pixel density multiplier for exported PNGs (1 = 1:1, 2 = 2\xD7).").addDropdown(
      (d) => d.addOptions({ "0.5": "0.5\xD7", "1": "1\xD7", "2": "2\xD7", "4": "4\xD7" }).setValue(String(this.plugin.settings.pngScale)).onChange(async (v) => {
        this.plugin.settings.pngScale = parseFloat(v);
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
  }
};

// src/settings/defaults.ts
var DEFAULT_SETTINGS = {
  autoExportSvg: true,
  autoExportPng: true,
  pngScale: 1,
  defaultCanvasWidth: 800,
  defaultCanvasHeight: 600,
  drawingsFolder: ""
};

// src/postprocessor/markdownPostProcessor.ts
var import_obsidian4 = require("obsidian");

// src/data/frontmatter.ts
function isSvgDrawingFile(app, file) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  return (fm == null ? void 0 : fm[FRONTMATTER_KEY_PLUGIN]) === FRONTMATTER_PLUGIN_VALUE;
}
function shouldOpenAsMarkdown(app, file) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  return !!(fm == null ? void 0 : fm[FRONTMATTER_KEY_OPEN_MD]);
}

// src/postprocessor/markdownPostProcessor.ts
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
function installViewStatePatch(app, isLoaded, bypassLeaves) {
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
          if (file instanceof import_obsidian5.TFile && isSvgDrawingFile(app, file) && !shouldOpenAsMarkdown(app, file)) {
            return next.call(this, { ...state, type: VIEW_TYPE_SVG }, eState);
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
        exportSvg(plugin.app, view.file, svgString).then(() => new import_obsidian8.Notice("Exported SVG")).catch((e) => new import_obsidian8.Notice(`Export failed: ${e.message}`));
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
        exportPng(plugin.app, view.file, svgString, plugin.settings.pngScale).then(() => new import_obsidian8.Notice("Exported PNG")).catch((e) => new import_obsidian8.Notice(`Export failed: ${e.message}`));
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

// src/main.ts
var RIBBON_ICON = "pencil";
var SvgPlugin = class extends import_obsidian9.Plugin {
  constructor() {
    super(...arguments);
    this._loaded = false;
    /** Leaves in this set bypass the SVG-redirect in setViewStatePatch for one call. */
    this.bypassLeaves = /* @__PURE__ */ new Set();
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
      this.bypassLeaves
    );
    registerCommands(this);
    this.addSettingTab(new SvgSettingsTab(this.app, this));
    this._loaded = true;
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
  /** Open the "insert file from vault" picker for the given SvgView. */
  openInsertFileModal(view) {
    new InsertFileModal(this.app, view).open();
  }
};
