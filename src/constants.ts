export const VIEW_TYPE_SVG = "svg-draw-view";
export const PLUGIN_ID = "obsidian-svg-plugin";

export const FRONTMATTER_KEY_PLUGIN = "svg-plugin";
export const FRONTMATTER_KEY_OPEN_MD = "svg-open-md";
export const FRONTMATTER_KEY_AUTO_EXPORT_PNG = "svg-auto-export-png";
export const FRONTMATTER_KEY_TRANSPARENT_BG = "svg-transparent-bg";
export const FRONTMATTER_PLUGIN_VALUE = "parsed";

export const DRAWING_SECTION_HEADING = "## Drawing";
export const DRAWING_FENCE_OPEN = "```svg";
export const DRAWING_FENCE_CLOSE = "```";
export const DRAWING_SECTION_END = "%%";
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
