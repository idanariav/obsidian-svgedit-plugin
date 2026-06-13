export const VIEW_TYPE_SVG = "svg-draw-view";
export const PLUGIN_ID = "obsidian-svg-plugin";

export const FRONTMATTER_KEY_PLUGIN = "sketch-editor-plugin";
export const FRONTMATTER_KEY_OPEN_MD = "sketch-editor-open-md";
// List of formats to auto-export on save, e.g. `[svg, png]`. Present-but-empty
// means "export nothing"; absent means "inherit folder/global".
export const FRONTMATTER_KEY_AUTO_EXPORT = "sketch-editor-auto-export";
// Legacy boolean key, kept as a read-time fallback for files written before
// FRONTMATTER_KEY_AUTO_EXPORT existed. Controls PNG export only.
export const FRONTMATTER_KEY_AUTO_EXPORT_PNG = "sketch-editor-auto-export-png";
export const FRONTMATTER_KEY_TRANSPARENT_BG = "sketch-editor-transparent-bg";
export const FRONTMATTER_KEY_EXPORT_FRAME = "sketch-editor-export-frame";
export const FRONTMATTER_PLUGIN_VALUE = "parsed";

// Legacy svg-* frontmatter keys, kept as a read-time fallback for drawings
// written before the "Sketch Editor" rename. Reads check the new key, then fall
// back to these; writes only ever use the new keys above.
export const LEGACY_FRONTMATTER_KEY_PLUGIN = "svg-plugin";
export const LEGACY_FRONTMATTER_KEY_OPEN_MD = "svg-open-md";
export const LEGACY_FRONTMATTER_KEY_AUTO_EXPORT = "svg-auto-export";
export const LEGACY_FRONTMATTER_KEY_AUTO_EXPORT_PNG = "svg-auto-export-png";
export const LEGACY_FRONTMATTER_KEY_TRANSPARENT_BG = "svg-transparent-bg";
export const LEGACY_FRONTMATTER_KEY_EXPORT_FRAME = "svg-export-frame";

// The drawing data lives inside a "# SVGEdit Data" section wrapped in `%%`
// comment fences so Obsidian hides it from rendered/preview output. `## Drawing`
// is a level-2 heading nested under that level-1 section heading.
export const SVGEDIT_SECTION_HEADING = "# SVGEdit Data";
// Opening `%%` comment fence plus the section heading, written as one unit and
// also used as the anchor that the Linked Files section is inserted above.
export const SVGEDIT_SECTION_OPEN = "%%\n# SVGEdit Data";
export const DRAWING_SECTION_HEADING = "## Drawing";
export const DRAWING_FENCE_OPEN = "```svg";
// Fence used when the drawing is stored LZString-compressed (see SvgData.ts).
// Mirrors the Obsidian Excalidraw plugin's `compressed-json` token.
export const DRAWING_FENCE_COMPRESSED_OPEN = "```compressed-svg";
export const DRAWING_FENCE_CLOSE = "```";
export const DRAWING_SECTION_END = "%%";

// Auto-managed section of wikilinks to vault files referenced by the drawing
// (imported images / linked shapes). Kept visible above the %%-hidden SVGEdit
// Data section so Obsidian still generates real backlinks. Reconciled from the
// SVG on every save.
export const LINKED_FILES_HEADING = "## Linked Files";
// SVG attribute that svgedit stamps onto every element originating from a vault
// import. Its value is the wikilink text to record. This is the cross-repo
// contract with the svgedit fork.
export const VAULT_LINK_ATTR = "data-vault-link";
// Marks an imported element as "locked": its content is re-baked from the
// source on every load (see refreshLockedEmbeds) rather than kept as a frozen
// snapshot. Also stamped by the svgedit fork at import time.
export const VAULT_LOCKED_ATTR = "data-vault-locked";
// Stamped by this plugin onto the saved drawing's root <svg> to persist the
// per-drawing canvas background color. svgedit keeps the background as editor
// chrome (a global `bkgd_color` pref), not in the document, so it would reset to
// white on every reopen; we stash it here and restore it after load. Lives only
// in the persisted markdown — it's stripped before handing the SVG to the live
// editor, so exports stay clean. White (the default) is omitted, so absence
// means white. See SvgData.ts (getCanvasBg/setCanvasBg) and SvgView.ts.
export const CANVAS_BG_ATTR = "data-svgedit-canvas-bg";
export const SWITCH_NOTICE =
  "==⚠  Switch to SVG VIEW in the ribbon or right-click menu  ⚠==";

export const EMPTY_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
  `<title>SVG Drawing</title>` +
  `</svg>`;

export const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
]);

export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;
