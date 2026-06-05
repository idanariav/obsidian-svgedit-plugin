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
var import_obsidian14 = require("obsidian");

// src/view/SvgView.ts
var import_obsidian4 = require("obsidian");

// src/constants.ts
var VIEW_TYPE_SVG = "svg-draw-view";
var FRONTMATTER_KEY_PLUGIN = "svg-plugin";
var FRONTMATTER_KEY_OPEN_MD = "svg-open-md";
var FRONTMATTER_KEY_AUTO_EXPORT_PNG = "svg-auto-export-png";
var FRONTMATTER_KEY_TRANSPARENT_BG = "svg-transparent-bg";
var FRONTMATTER_KEY_EXPORT_FRAME = "svg-export-frame";
var FRONTMATTER_PLUGIN_VALUE = "parsed";
var DRAWING_SECTION_HEADING = "## Drawing";
var DRAWING_FENCE_OPEN = "```svg";
var DRAWING_FENCE_CLOSE = "```";
var DRAWING_SECTION_END = "%%";
var LINKED_FILES_HEADING = "## Linked Files";
var VAULT_LINK_ATTR = "data-vault-link";
var VAULT_LOCKED_ATTR = "data-vault-locked";
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
var LINKED_FILES_BLOCK_REGEX = new RegExp(
  `^${escapeRegExp(LINKED_FILES_HEADING)}\\n(?:.*\\n)*?(?=^## )`,
  "m"
);
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function collectVaultLinks(svg) {
  var _a;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const seen = /* @__PURE__ */ new Set();
  const links = [];
  for (const el of Array.from(doc.querySelectorAll(`[${VAULT_LINK_ATTR}]`))) {
    const link = (_a = el.getAttribute(VAULT_LINK_ATTR)) == null ? void 0 : _a.trim();
    if (link && !seen.has(link)) {
      seen.add(link);
      links.push(link);
    }
  }
  return links;
}
function reconcileLinkedFiles(content, svg) {
  const stripped = content.replace(LINKED_FILES_BLOCK_REGEX, "");
  const links = collectVaultLinks(svg);
  if (links.length === 0) return stripped;
  const section = `${LINKED_FILES_HEADING}
` + links.map((l) => `- [[${l}]]`).join("\n") + "\n\n";
  if (stripped.includes(DRAWING_SECTION_HEADING)) {
    return stripped.replace(DRAWING_SECTION_HEADING, () => section + DRAWING_SECTION_HEADING);
  }
  return stripped + "\n\n" + section.trimEnd() + "\n";
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

// src/data/lockedEmbeds.ts
var import_obsidian2 = require("obsidian");

// src/modals/vaultImage.ts
var import_obsidian = require("obsidian");

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
  let exportFrame = globalSettings.exportFrame;
  const folder = resolveFolderConfig(file.path, globalSettings.folderConfigs);
  if (folder) {
    if (folder.openAsMarkdown !== void 0) openAsMarkdown = folder.openAsMarkdown;
    if (folder.autoExportPng !== void 0) autoExportPng = folder.autoExportPng;
    if (folder.transparentBackground !== void 0) transparentBackground = folder.transparentBackground;
    if (folder.exportFrame !== void 0) exportFrame = folder.exportFrame;
  }
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_OPEN_MD]) !== void 0 && fm[FRONTMATTER_KEY_OPEN_MD] !== null)
    openAsMarkdown = !!fm[FRONTMATTER_KEY_OPEN_MD];
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG]) !== void 0 && fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG] !== null)
    autoExportPng = !!fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG];
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_TRANSPARENT_BG]) !== void 0 && fm[FRONTMATTER_KEY_TRANSPARENT_BG] !== null)
    transparentBackground = !!fm[FRONTMATTER_KEY_TRANSPARENT_BG];
  if ((fm == null ? void 0 : fm[FRONTMATTER_KEY_EXPORT_FRAME]) !== void 0 && fm[FRONTMATTER_KEY_EXPORT_FRAME] !== null)
    exportFrame = String(fm[FRONTMATTER_KEY_EXPORT_FRAME]);
  return { openAsMarkdown, autoExportPng, transparentBackground, exportFrame };
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

// src/modals/vaultImage.ts
function pickVaultFile(app, placeholder, filter) {
  return new Promise((resolve) => {
    let chosen = null;
    const modal = new class extends import_obsidian.FuzzySuggestModal {
      getItems() {
        const files = app.vault.getFiles();
        return filter ? files.filter(filter) : files;
      }
      getItemText(file) {
        return file.path;
      }
      onChooseItem(file) {
        chosen = file;
        resolve(file);
      }
      onClose() {
        window.setTimeout(() => resolve(chosen), 0);
      }
    }(app);
    modal.setPlaceholder(placeholder);
    modal.open();
  });
}
async function fileToDataUri(app, file) {
  const binary = await app.vault.readBinary(file);
  const b64 = arrayBufferToBase64(binary);
  const mime = getMimeType(file.extension);
  return `data:${mime};base64,${b64}`;
}
function svgToDataUri(svg) {
  const b64 = arrayBufferToBase64(new TextEncoder().encode(svg).buffer);
  return `data:image/svg+xml;base64,${b64}`;
}
async function readDrawingSvg(app, file) {
  const content = await app.vault.cachedRead(file);
  return extractSvg(content);
}
function pickFrame(app, frames) {
  const WHOLE = "Whole drawing";
  const items = [WHOLE, ...frames];
  return new Promise((resolve) => {
    let chosen = null;
    const modal = new class extends import_obsidian.FuzzySuggestModal {
      getItems() {
        return items;
      }
      getItemText(item) {
        return item;
      }
      onChooseItem(item) {
        chosen = item === WHOLE ? "" : item;
        resolve(chosen);
      }
      onClose() {
        window.setTimeout(() => resolve(chosen), 0);
      }
    }(app);
    modal.setPlaceholder("Pick a frame to import (or the whole drawing)\u2026");
    modal.open();
  });
}
function pickImportMode(app) {
  const UNLOCKED = "Unlocked \u2014 an independent copy (won't sync)";
  const LOCKED = "Locked \u2014 auto-syncs from the source on open";
  const items = [UNLOCKED, LOCKED];
  return new Promise((resolve) => {
    let chosen = null;
    const modal = new class extends import_obsidian.FuzzySuggestModal {
      getItems() {
        return items;
      }
      getItemText(item) {
        return item;
      }
      onChooseItem(item) {
        chosen = item === LOCKED ? "locked" : "unlocked";
        resolve(chosen);
      }
      onClose() {
        window.setTimeout(() => resolve(chosen), 0);
      }
    }(app);
    modal.setPlaceholder("Import as locked or unlocked?");
    modal.open();
  });
}
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
function resolveVaultLink(app, file, drawingPath) {
  var _a;
  const target = (_a = drawingSourceFor(app, file)) != null ? _a : file;
  return app.metadataCache.fileToLinktext(target, drawingPath);
}
function drawingSourceFor(app, file) {
  if (file.extension.toLowerCase() === "md") {
    return isSvgDrawingFile(app, file) ? file : null;
  }
  if (IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) {
    const companionPath = file.path.slice(0, -file.extension.length) + "md";
    const companion = app.vault.getAbstractFileByPath(companionPath);
    if (companion instanceof import_obsidian.TFile && isSvgDrawingFile(app, companion)) {
      return companion;
    }
  }
  return null;
}

// src/export/frames.ts
function listFrames(svgString) {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  return Array.from(doc.querySelectorAll("[data-frame]")).map((f, i) => ({
    id: f.id,
    name: frameName(f, i)
  }));
}
function prepareSvgForExport(svgString, frameName2 = "") {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const root = doc.documentElement;
  const crop = frameName2 ? findFrameBounds(root, frameName2) : null;
  root.querySelectorAll("[data-frame]").forEach((f) => f.remove());
  if (crop) {
    root.setAttribute("viewBox", `${crop.x} ${crop.y} ${crop.w} ${crop.h}`);
    root.setAttribute("width", String(crop.w));
    root.setAttribute("height", String(crop.h));
  }
  return new XMLSerializer().serializeToString(root);
}
function frameName(frame, index) {
  var _a, _b;
  const title = (_b = (_a = frame.querySelector("title")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
  return title || `Frame ${index + 1}`;
}
function findFrameBounds(root, name) {
  const frames = Array.from(root.querySelectorAll("[data-frame]"));
  const match = frames.find((f, i) => frameName(f, i) === name);
  if (!match) return null;
  const num = (attr) => Number(match.getAttribute(attr));
  const x = num("x");
  const y = num("y");
  const w = num("width");
  const h = num("height");
  if (!w || !h) return null;
  return { x, y, w, h };
}

// src/data/lockedEmbeds.ts
var XLINK_NS = "http://www.w3.org/1999/xlink";
async function refreshLockedEmbeds(app, svg, drawingPath) {
  var _a;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const locked = Array.from(doc.querySelectorAll(`image[${VAULT_LOCKED_ATTR}]`));
  if (locked.length === 0) return svg;
  let changed = false;
  for (const el of locked) {
    const link = (_a = el.getAttribute(VAULT_LINK_ATTR)) == null ? void 0 : _a.trim();
    if (!link) continue;
    const hashIdx = link.indexOf("#");
    const base = hashIdx >= 0 ? link.slice(0, hashIdx) : link;
    const frame = hashIdx >= 0 ? link.slice(hashIdx + 1) : "";
    const file = app.metadataCache.getFirstLinkpathDest(base, drawingPath);
    if (!(file instanceof import_obsidian2.TFile)) continue;
    const href = await bakeHref(app, file, frame);
    if (!href) continue;
    setImageHref(el, href);
    changed = true;
  }
  return changed ? new XMLSerializer().serializeToString(doc) : svg;
}
async function bakeHref(app, file, frame) {
  const drawing = drawingSourceFor(app, file);
  if (drawing) {
    const srcSvg = await readDrawingSvg(app, drawing);
    if (!srcSvg) return null;
    return svgToDataUri(prepareSvgForExport(srcSvg, frame));
  }
  return fileToDataUri(app, file);
}
function setImageHref(el, href) {
  el.setAttribute("href", href);
  el.setAttributeNS(XLINK_NS, "xlink:href", href);
}

// src/export/exporter.ts
var import_obsidian3 = require("obsidian");

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
function getCompanionPath(sourcePath, ext, settings, suffix = "") {
  const stem = sourcePath.split("/").pop().replace(/\.md$/, "");
  const basename = stem + suffix + "." + ext;
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
    return (0, import_obsidian3.normalizePath)(exportFolder.replace(/\/?$/, "/") + basename);
  }
  return (0, import_obsidian3.normalizePath)(sourcePath.replace(/[^/]+$/, basename));
}
function frameFileSuffix(frameName2) {
  const slug = frameName2.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
  return slug ? `-${slug}` : "";
}
async function exportSvg(app, sourceFile, svgString, settings, frameName2 = "", pathSuffix = "") {
  const path = getCompanionPath(sourceFile.path, "svg", settings, pathSuffix);
  await app.vault.adapter.write(path, prepareSvgForExport(svgString, frameName2));
}
async function exportPng(app, sourceFile, svgString, scale, transparent = false, settings, frameName2 = "", pathSuffix = "") {
  const path = getCompanionPath(sourceFile.path, "png", settings, pathSuffix);
  const buf = await svgToPngArrayBuffer(prepareSvgForExport(svgString, frameName2), scale, transparent);
  await app.vault.adapter.writeBinary(path, buf);
}
async function autoExport(app, file, svgString, settings, effective) {
  const tasks = [];
  if (settings.autoExportSvg)
    tasks.push(exportSvg(app, file, svgString, settings, effective.exportFrame));
  if (effective.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale, effective.transparentBackground, settings, effective.exportFrame));
  await Promise.all(tasks);
}

// src/view/SvgView.ts
var SCRIPT_LOADED_KEY = "__svgPluginEditorLoaded";
var CSS_ELEM_ID = "svg-plugin-svgedit-css";
var SvgView = class extends import_obsidian4.TextFileView {
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
    (0, import_obsidian4.setIcon)(mdBtn, "code");
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
    const dist = (0, import_obsidian4.normalizePath)(`${this.plugin.manifest.dir}/svgedit-dist`);
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
    var _a, _b, _c;
    this.currentData = data;
    const gen = ++this.loadGen;
    const raw = (_a = extractSvg(data)) != null ? _a : EMPTY_SVG;
    const svg = await refreshLockedEmbeds(this.app, raw, (_c = (_b = this.file) == null ? void 0 : _b.path) != null ? _c : "");
    if (this.loadGen !== gen) return;
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
    const svg = this.svgEditor.svgCanvas.getSvgString();
    return reconcileLinkedFiles(replaceSvg(this.currentData, svg), svg);
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
      const svg = this.svgEditor.svgCanvas.getSvgString();
      this.currentData = reconcileLinkedFiles(replaceSvg(this.currentData, svg), svg);
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
var import_obsidian6 = require("obsidian");

// src/settings/FolderSuggest.ts
var import_obsidian5 = require("obsidian");
var FolderSuggest = class extends import_obsidian5.AbstractInputSuggest {
  constructor(app, inputEl, onSelectCb) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.onSelectCb = onSelectCb;
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.app.vault.getAllFolders(true).filter((folder) => folder.path.toLowerCase().includes(lower));
  }
  renderSuggestion(folder, el) {
    el.setText(folder.isRoot() ? "/ (vault root)" : folder.path);
  }
  selectSuggestion(folder) {
    const value = folder.isRoot() ? "" : folder.path;
    this.inputEl.value = value;
    this.inputEl.trigger("input");
    this.onSelectCb(value);
    this.close();
  }
};

// src/settings/SettingsTab.ts
function toTriState(value) {
  if (value === void 0) return "inherit";
  return value ? "true" : "false";
}
function fromTriState(value) {
  if (value === "inherit") return void 0;
  return value === "true";
}
var SvgSettingsTab = class extends import_obsidian6.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "SVG Draw" });
    new import_obsidian6.Setting(containerEl).setHeading().setName("Open mode");
    new import_obsidian6.Setting(containerEl).setName("Open as Markdown by default").setDesc(
      "When no per-file or per-folder override exists, open drawings in Markdown view instead of the SVG editor."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.openAsMarkdown).onChange(async (v) => {
        this.plugin.settings.openAsMarkdown = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setHeading().setName("Appearance");
    new import_obsidian6.Setting(containerEl).setName("Editor theme").setDesc(
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
    new import_obsidian6.Setting(containerEl).setHeading().setName("Auto-export");
    new import_obsidian6.Setting(containerEl).setName("Export SVG on save").setDesc("Write a companion .svg file next to the drawing on every save.").addToggle(
      (t) => t.setValue(this.plugin.settings.autoExportSvg).onChange(async (v) => {
        this.plugin.settings.autoExportSvg = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Export PNG on save").setDesc("Write a companion .png file next to the drawing on every save.").addToggle(
      (t) => t.setValue(this.plugin.settings.autoExportPng).onChange(async (v) => {
        this.plugin.settings.autoExportPng = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Transparent PNG background").setDesc(
      "Export PNGs with a transparent background. When off, a white fill is painted behind the drawing."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.transparentBackground).onChange(async (v) => {
        this.plugin.settings.transparentBackground = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Export region (frame name)").setDesc(
      "Leave blank to export the whole canvas. Enter a frame name to crop exports to the matching frame. If no frame matches, the whole canvas is exported. Frame rects are always stripped from exports."
    ).addText(
      (t) => t.setPlaceholder("Whole canvas").setValue(this.plugin.settings.exportFrame).onChange(async (v) => {
        this.plugin.settings.exportFrame = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("PNG scale").setDesc("Pixel density multiplier for exported PNGs (1 = 1:1, 2 = 2\xD7).").addDropdown(
      (d) => d.addOptions({ "0.5": "0.5\xD7", "1": "1\xD7", "2": "2\xD7", "4": "4\xD7" }).setValue(String(this.plugin.settings.pngScale)).onChange(async (v) => {
        this.plugin.settings.pngScale = parseFloat(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setHeading().setName("File sync");
    new import_obsidian6.Setting(containerEl).setName("Keep companion files in sync").setDesc(
      "When a drawing is renamed or deleted, automatically rename/delete its companion .svg and .png files."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.keepInSync).onChange(async (v) => {
        this.plugin.settings.keepInSync = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setHeading().setName("New drawing defaults");
    new import_obsidian6.Setting(containerEl).setName("Canvas width").addText(
      (t) => t.setValue(String(this.plugin.settings.defaultCanvasWidth)).onChange(async (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n > 0) {
          this.plugin.settings.defaultCanvasWidth = n;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Canvas height").addText(
      (t) => t.setValue(String(this.plugin.settings.defaultCanvasHeight)).onChange(async (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n > 0) {
          this.plugin.settings.defaultCanvasHeight = n;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Drawings folder").setDesc(
      "Default vault folder for new drawings (e.g. Drawings). Leave blank for vault root."
    ).addText((t) => {
      new FolderSuggest(this.app, t.inputEl, async (v) => {
        this.plugin.settings.drawingsFolder = v.trim();
        await this.plugin.saveSettings();
      });
      t.setPlaceholder("Drawings").setValue(this.plugin.settings.drawingsFolder).onChange(async (v) => {
        this.plugin.settings.drawingsFolder = v.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(containerEl).setHeading().setName("Folder overrides");
    containerEl.createEl("p", {
      text: 'Per-folder settings override the global defaults above. Use "Inherit" to fall back to the global value. Individual file frontmatter (svg-open-md, svg-auto-export-png, svg-transparent-bg, svg-export-frame) takes highest priority.',
      cls: "setting-item-description"
    });
    new import_obsidian6.Setting(containerEl).addButton(
      (btn) => btn.setButtonText("+ Add folder").setCta().onClick(async () => {
        this.plugin.settings.folderConfigs.push({ folder: "" });
        await this.plugin.saveSettings();
        this.display();
      })
    );
    for (let i = 0; i < this.plugin.settings.folderConfigs.length; i++) {
      this.renderFolderBlock(containerEl, i);
    }
    new import_obsidian6.Setting(containerEl).setHeading().setName("Export folder mappings");
    containerEl.createEl("p", {
      text: "Map drawings in a source folder to a different export folder for their companion .svg and .png files. Longest-prefix match wins. If no mapping matches, companions are exported next to the drawing.",
      cls: "setting-item-description"
    });
    new import_obsidian6.Setting(containerEl).addButton(
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
    new import_obsidian6.Setting(wrapper).setName("Source folder").setDesc("Drawings in this vault folder (and sub-folders) use the custom export path.").addText((t) => {
      new FolderSuggest(this.app, t.inputEl, async (v) => {
        this.plugin.settings.exportFolderMappings[index].sourceFolder = v.trim();
        await this.plugin.saveSettings();
      });
      t.setPlaceholder("Content/Concepts").setValue(mapping.sourceFolder).onChange(async (v) => {
        this.plugin.settings.exportFolderMappings[index].sourceFolder = v.trim();
        await this.plugin.saveSettings();
      });
    }).addButton(
      (btn) => btn.setIcon("trash").setTooltip("Remove this mapping").onClick(async () => {
        this.plugin.settings.exportFolderMappings.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian6.Setting(wrapper).setName("Export folder").setDesc("Companion files are written here instead of next to the drawing.").addText((t) => {
      new FolderSuggest(this.app, t.inputEl, async (v) => {
        this.plugin.settings.exportFolderMappings[index].exportFolder = v.trim();
        await this.plugin.saveSettings();
      });
      t.setPlaceholder("Assets/Concepts").setValue(mapping.exportFolder).onChange(async (v) => {
        this.plugin.settings.exportFolderMappings[index].exportFolder = v.trim();
        await this.plugin.saveSettings();
      });
    });
  }
  renderFolderBlock(containerEl, index) {
    const cfg = this.plugin.settings.folderConfigs[index];
    const wrapper = containerEl.createDiv("svg-plugin-folder-block");
    wrapper.style.cssText = "border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;";
    new import_obsidian6.Setting(wrapper).setName("Folder path").setDesc("Vault-relative path, e.g. Drawings/work").addText((t) => {
      new FolderSuggest(this.app, t.inputEl, async (v) => {
        this.plugin.settings.folderConfigs[index].folder = v.trim();
        await this.plugin.saveSettings();
      });
      t.setPlaceholder("Folder/Path").setValue(cfg.folder).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].folder = v.trim();
        await this.plugin.saveSettings();
      });
    }).addButton(
      (btn) => btn.setIcon("trash").setTooltip("Remove this folder override").onClick(async () => {
        this.plugin.settings.folderConfigs.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian6.Setting(wrapper).setName("Open as").setDesc("How to open drawings in this folder by default.").addDropdown(
      (d) => d.addOptions({
        inherit: "Inherit (global default)",
        "false": "SVG editor",
        "true": "Markdown view"
      }).setValue(toTriState(cfg.openAsMarkdown)).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].openAsMarkdown = fromTriState(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(wrapper).setName("Auto-export PNG").setDesc("Whether to write a companion .png file on save.").addDropdown(
      (d) => d.addOptions({
        inherit: "Inherit (global default)",
        "true": "Yes",
        "false": "No"
      }).setValue(toTriState(cfg.autoExportPng)).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].autoExportPng = fromTriState(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(wrapper).setName("Transparent PNG background").setDesc("Whether exported PNGs use a transparent background.").addDropdown(
      (d) => d.addOptions({
        inherit: "Inherit (global default)",
        "true": "Yes \u2014 transparent",
        "false": "No \u2014 white fill"
      }).setValue(toTriState(cfg.transparentBackground)).onChange(async (v) => {
        this.plugin.settings.folderConfigs[index].transparentBackground = fromTriState(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(wrapper).setName("Export region (frame name)").setDesc("Blank inherits the global value. Enter a frame name to crop exports to it for drawings in this folder.").addText(
      (t) => {
        var _a;
        return t.setPlaceholder("Inherit").setValue((_a = cfg.exportFrame) != null ? _a : "").onChange(async (v) => {
          const trimmed = v.trim();
          this.plugin.settings.folderConfigs[index].exportFrame = trimmed === "" ? void 0 : trimmed;
          await this.plugin.saveSettings();
        });
      }
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
  exportFrame: "",
  folderConfigs: [],
  keepInSync: false,
  exportFolderMappings: [],
  editorTheme: "auto"
};

// src/postprocessor/markdownPostProcessor.ts
var import_obsidian7 = require("obsidian");
async function markdownPostProcessor(el, ctx, app) {
  const embeds = el.querySelectorAll(".internal-embed");
  if (embeds.length === 0) return;
  for (const embed of Array.from(embeds)) {
    const src = embed.getAttribute("src");
    if (!src) continue;
    const hashIdx = src.indexOf("#");
    if (hashIdx > 0) {
      await renderFrameEmbed(embed, src, hashIdx, ctx, app);
      continue;
    }
    if (!/\.(png|svg)$/i.test(src)) continue;
    const sourceMd = findSourceMd(app, src, ctx.sourcePath);
    if (!sourceMd) continue;
    bindOpenSource(embed, app, sourceMd);
  }
}
async function renderFrameEmbed(embed, src, hashIdx, ctx, app) {
  if (embed.dataset.svgFrame) return;
  const base = src.slice(0, hashIdx);
  const subpath = src.slice(hashIdx + 1).trim();
  if (!subpath) return;
  const file = app.metadataCache.getFirstLinkpathDest(base, ctx.sourcePath);
  if (!(file instanceof import_obsidian7.TFile) || !isSvgDrawingFile(app, file)) return;
  const svg = extractSvg(await app.vault.cachedRead(file));
  if (!svg) return;
  const frame = listFrames(svg).find((f) => f.name === subpath);
  if (!frame) return;
  const cropped = prepareSvgForExport(svg, frame.name);
  const svgEl = new DOMParser().parseFromString(cropped, "image/svg+xml").documentElement;
  embed.empty();
  embed.dataset.svgFrame = "1";
  embed.addClass("svg-frame-embed");
  embed.appendChild(document.importNode(svgEl, true));
  bindOpenSource(embed, app, file);
}
function bindOpenSource(embed, app, sourceMd) {
  embed.style.cursor = "pointer";
  embed.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    const leaf = app.workspace.getLeaf(false);
    leaf.openFile(sourceMd, { active: true });
  });
}
function findSourceMd(app, imageSrc, sourcePath) {
  const mdPath = (0, import_obsidian7.normalizePath)(
    imageSrc.replace(/\.(png|svg)$/i, ".md")
  );
  const candidate = app.vault.getAbstractFileByPath(mdPath);
  if (candidate instanceof import_obsidian7.TFile && isSvgDrawingFile(app, candidate)) {
    return candidate;
  }
  const resolved = app.metadataCache.getFirstLinkpathDest(
    imageSrc.replace(/\.(png|svg)$/i, ""),
    sourcePath
  );
  if (resolved) {
    const mdPath2 = (0, import_obsidian7.normalizePath)(resolved.path.replace(/\.(png|svg)$/i, ".md"));
    const candidate2 = app.vault.getAbstractFileByPath(mdPath2);
    if (candidate2 instanceof import_obsidian7.TFile && isSvgDrawingFile(app, candidate2)) {
      return candidate2;
    }
  }
  return null;
}

// src/postprocessor/setViewStatePatch.ts
var import_obsidian8 = require("obsidian");

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
  return around(import_obsidian8.WorkspaceLeaf.prototype, {
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
          if (file instanceof import_obsidian8.TFile && isSvgDrawingFile(app, file)) {
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
var import_obsidian9 = require("obsidian");
var InsertFileModal = class extends import_obsidian9.FuzzySuggestModal {
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
      new import_obsidian9.Notice(`Insert failed: ${e.message}`);
    }
  }
  async insertImage(file) {
    var _a, _b;
    const mode = await pickImportMode(this.app);
    if (mode === null) return;
    const dataUri = await fileToDataUri(this.app, file);
    const link = resolveVaultLink(this.app, file, (_b = (_a = this.view.file) == null ? void 0 : _a.path) != null ? _b : "");
    const lockedAttr = mode === "locked" ? ` data-vault-locked="1"` : "";
    const fragment = `<image href="${dataUri}" data-vault-link="${escapeAttr(link)}"${lockedAttr} x="50" y="50" width="200" height="200"/>`;
    await this.view.insertSvgFragment(fragment);
  }
  async insertWikiLink(file) {
    const linkText = this.app.metadataCache.fileToLinktext(file, "");
    const escaped = linkText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fragment = `<text x="50" y="80" font-family="sans-serif" font-size="16" fill="currentColor">[[${escaped}]]</text>`;
    await this.view.insertSvgFragment(fragment);
  }
};
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

// src/modals/NewDrawingModal.ts
var import_obsidian10 = require("obsidian");
var NewDrawingModal = class extends import_obsidian10.Modal {
  constructor(app, defaultFolder, onSubmit) {
    super(app);
    this.name = "Untitled";
    this.folder = defaultFolder;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "New SVG Drawing" });
    new import_obsidian10.Setting(contentEl).setName("Name").setDesc("File name (without extension)").addText(
      (text) => text.setValue(this.name).onChange((v) => this.name = v.trim()).inputEl.focus()
    );
    new import_obsidian10.Setting(contentEl).setName("Folder").setDesc("Vault path for the new file (leave blank for vault root)").addText(
      (text) => text.setValue(this.folder).onChange((v) => this.folder = v.trim())
    );
    new import_obsidian10.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Create").setCta().onClick(() => {
        if (!this.name) return;
        const dir = this.folder ? this.folder.replace(/\/$/, "") + "/" : "";
        const path = (0, import_obsidian10.normalizePath)(`${dir}${this.name}.md`);
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
var import_obsidian12 = require("obsidian");

// src/modals/ExportModal.ts
var import_obsidian11 = require("obsidian");
var ExportModal = class extends import_obsidian11.Modal {
  constructor(plugin, view) {
    super(plugin.app);
    this.format = "png";
    this.plugin = plugin;
    this.view = view;
    const effective = resolveEffectiveSettings(plugin.app, view.file, plugin.settings);
    this.transparent = effective.transparentBackground;
    this.frameName = effective.exportFrame;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Export drawing" });
    const svgString = (_a = this.view.getSvgString()) != null ? _a : "";
    const frames = listFrames(svgString);
    if (this.frameName && !frames.some((f) => f.name === this.frameName)) {
      this.frameName = "";
    }
    new import_obsidian11.Setting(contentEl).setName("Format").addDropdown(
      (d) => d.addOptions({ png: "PNG", svg: "SVG" }).setValue(this.format).onChange((v) => {
        this.format = v;
      })
    );
    new import_obsidian11.Setting(contentEl).setName("Transparent background").setDesc("Applies to PNG export; SVG keeps its own background.").addToggle(
      (t) => t.setValue(this.transparent).onChange((v) => {
        this.transparent = v;
      })
    );
    const regionOptions = { "": "Whole canvas" };
    for (const f of frames) regionOptions[f.name] = f.name;
    new import_obsidian11.Setting(contentEl).setName("Region").setDesc(
      frames.length ? "Whole canvas writes the usual companion file; a frame writes a separate <name>-<frame> file." : "No frames in this drawing \u2014 exporting the whole canvas."
    ).addDropdown(
      (d) => d.addOptions(regionOptions).setValue(this.frameName).setDisabled(frames.length === 0).onChange((v) => {
        this.frameName = v;
      })
    );
    new import_obsidian11.Setting(contentEl).addButton(
      (b) => b.setButtonText("Export").setCta().onClick(() => void this.doExport(svgString))
    );
  }
  async doExport(svgString) {
    const file = this.view.file;
    if (!file) return;
    const suffix = frameFileSuffix(this.frameName);
    try {
      if (this.format === "svg") {
        await exportSvg(this.app, file, svgString, this.plugin.settings, this.frameName, suffix);
      } else {
        await exportPng(
          this.app,
          file,
          svgString,
          this.plugin.settings.pngScale,
          this.transparent,
          this.plugin.settings,
          this.frameName,
          suffix
        );
      }
      new import_obsidian11.Notice(`Exported ${this.format.toUpperCase()}`);
      this.close();
    } catch (e) {
      new import_obsidian11.Notice(`Export failed: ${e.message}`);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/commands.ts
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
              new import_obsidian12.Notice(`File already exists: ${path}`);
              return;
            }
            const file = await plugin.app.vault.create(path, content);
            const leaf = plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file, { active: true });
          } catch (e) {
            new import_obsidian12.Notice(`Could not create drawing: ${e.message}`);
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
    id: "export-drawing",
    name: "Export drawing\u2026",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) new ExportModal(plugin, view).open();
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
        const { exportFrame } = resolveEffectiveSettings(plugin.app, view.file, plugin.settings);
        exportSvg(plugin.app, view.file, svgString, plugin.settings, exportFrame).then(() => new import_obsidian12.Notice("Exported SVG")).catch((e) => new import_obsidian12.Notice(`Export failed: ${e.message}`));
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
        const { transparentBackground, exportFrame } = resolveEffectiveSettings(plugin.app, view.file, plugin.settings);
        exportPng(plugin.app, view.file, svgString, plugin.settings.pngScale, transparentBackground, plugin.settings, exportFrame).then(() => new import_obsidian12.Notice("Exported PNG")).catch((e) => new import_obsidian12.Notice(`Export failed: ${e.message}`));
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
    new import_obsidian12.Notice(`Convert failed: ${e.message}`);
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
    new import_obsidian12.Notice(`Toggle failed: ${e.message}`);
  }
}
function getActiveLeaf(plugin) {
  var _a, _b, _c;
  return (_c = (_b = (_a = plugin.app.workspace.getActiveViewOfType(SvgView)) == null ? void 0 : _a.leaf) != null ? _b : plugin.app.workspace.getMostRecentLeaf()) != null ? _c : plugin.app.workspace.getLeaf(false);
}

// src/fileSync.ts
var import_obsidian13 = require("obsidian");
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
      if (!(file instanceof import_obsidian13.TFile)) return;
      void handleRename(plugin, file, oldPath);
    })
  );
  plugin.registerEvent(
    plugin.app.vault.on("delete", (file) => {
      if (!(file instanceof import_obsidian13.TFile)) return;
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
  for (const ext of ["svg", "png"]) {
    const oldCompanion = (0, import_obsidian13.normalizePath)(getCompanionPath(oldPath, ext, plugin.settings));
    const newCompanion = (0, import_obsidian13.normalizePath)(getCompanionPath(file.path, ext, plugin.settings));
    if (oldCompanion === newCompanion) continue;
    const companionFile = plugin.app.vault.getAbstractFileByPath(oldCompanion);
    if (!(companionFile instanceof import_obsidian13.TFile)) continue;
    if (plugin.app.vault.getAbstractFileByPath(newCompanion) instanceof import_obsidian13.TFile) {
      await plugin.app.vault.delete(companionFile);
      continue;
    }
    try {
      await plugin.app.fileManager.renameFile(companionFile, newCompanion);
    } catch (e) {
      if (plugin.app.vault.getAbstractFileByPath(oldCompanion) instanceof import_obsidian13.TFile) {
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
      const f = plugin.app.vault.getAbstractFileByPath((0, import_obsidian13.normalizePath)(companionPath));
      if (f instanceof import_obsidian13.TFile) plugin.app.vault.delete(f);
    }
  }, 500);
}

// src/main.ts
var RIBBON_ICON = "pencil";
var SvgPlugin = class extends import_obsidian14.Plugin {
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
    this.installHostBridge();
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
    delete window.svgEditHost;
  }
  /** The vault path the active drawing's links should resolve against. */
  activeDrawingPath() {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.app.workspace.getActiveViewOfType(SvgView)) == null ? void 0 : _a.file) == null ? void 0 : _b.path) != null ? _c : "";
  }
  /**
   * Install the global svgedit reads to let the user pick a vault image/file.
   * Picks resolve a wikilink (via resolveVaultLink) which svgedit stamps onto
   * the inserted element(s) as data-vault-link; the link section is then
   * reconciled from the SVG on save.
   */
  installHostBridge() {
    window.svgEditHost = {
      pickVaultImage: async () => {
        const file = await pickVaultFile(
          this.app,
          "Pick a vault image or drawing to import\u2026",
          (f) => IMAGE_EXTENSIONS.has(f.extension.toLowerCase()) || f.extension.toLowerCase() === "md" && isSvgDrawingFile(this.app, f)
        );
        if (!file) return null;
        const drawing = drawingSourceFor(this.app, file);
        if (drawing) {
          const svg = await readDrawingSvg(this.app, drawing);
          if (svg) {
            const frames = listFrames(svg);
            const frameName2 = frames.length ? await pickFrame(this.app, frames.map((f) => f.name)) : "";
            if (frameName2 === null) return null;
            const mode2 = await pickImportMode(this.app);
            if (mode2 === null) return null;
            const prepared = prepareSvgForExport(svg, frameName2);
            const dataUrl2 = svgToDataUri(prepared);
            let link2 = resolveVaultLink(this.app, drawing, this.activeDrawingPath());
            if (frameName2) link2 += `#${frameName2}`;
            if (mode2 === "unlocked" && !frameName2) {
              return { dataUrl: dataUrl2, link: link2, editableSvg: prepared };
            }
            return { dataUrl: dataUrl2, link: link2, locked: mode2 === "locked" };
          }
        }
        const mode = await pickImportMode(this.app);
        if (mode === null) return null;
        const dataUrl = await fileToDataUri(this.app, file);
        const link = resolveVaultLink(this.app, file, this.activeDrawingPath());
        return { dataUrl, link, locked: mode === "locked" };
      },
      pickVaultFile: async () => {
        const file = await pickVaultFile(this.app, "Pick a vault file to link\u2026");
        if (!file) return null;
        return { link: resolveVaultLink(this.app, file, this.activeDrawingPath()) };
      }
    };
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
