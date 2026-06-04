export const VIEW_TYPE_SVG = "svg-draw-view";
export const PLUGIN_ID = "obsidian-svg-plugin";

export const FRONTMATTER_KEY_PLUGIN = "svg-plugin";
export const FRONTMATTER_KEY_OPEN_MD = "svg-open-md";
export const FRONTMATTER_KEY_AUTO_EXPORT_PNG = "svg-auto-export-png";
export const FRONTMATTER_KEY_TRANSPARENT_BG = "svg-transparent-bg";
export const FRONTMATTER_KEY_EXPORT_FRAME = "svg-export-frame";
export const FRONTMATTER_PLUGIN_VALUE = "parsed";

export const DRAWING_SECTION_HEADING = "## Drawing";
export const DRAWING_FENCE_OPEN = "```svg";
export const DRAWING_FENCE_CLOSE = "```";
export const DRAWING_SECTION_END = "%%";

// Auto-managed section of wikilinks to vault files referenced by the drawing
// (imported images / linked shapes). Kept visible above ## Drawing so Obsidian
// generates real backlinks. Reconciled from the SVG on every save.
export const LINKED_FILES_HEADING = "## Linked Files";
// SVG attribute that svgedit stamps onto every element originating from a vault
// import. Its value is the wikilink text to record. This is the cross-repo
// contract with the svgedit fork.
export const VAULT_LINK_ATTR = "data-vault-link";
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
