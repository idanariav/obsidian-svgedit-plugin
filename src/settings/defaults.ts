/** Maps drawings in a source folder to a different export destination folder. */
export interface ExportFolderMapping {
  sourceFolder: string; // e.g., "Content/Concepts"
  exportFolder: string; // e.g., "Assets/Concepts"
}

/** Per-folder override — undefined means "inherit from global" */
export interface FolderConfig {
  folder: string;
  openAsMarkdown?: boolean;
  autoExportPng?: boolean;
  transparentBackground?: boolean;
  /** Name of the frame to crop exports to. Empty/undefined inherits the global value. */
  exportFrame?: string;
}

/** Resolved, concrete settings for a specific file (no undefined values). */
export interface EffectiveDrawingSettings {
  openAsMarkdown: boolean;
  autoExportPng: boolean;
  transparentBackground: boolean;
  /** Name of the frame to crop exports to. Empty string = export the whole canvas. */
  exportFrame: string;
}

export interface SvgPluginSettings {
  autoExportSvg: boolean;
  autoExportPng: boolean;
  pngScale: number;
  defaultCanvasWidth: number;
  defaultCanvasHeight: number;
  drawingsFolder: string;
  /** Global default: open drawings in Markdown view (false = SVG view). */
  openAsMarkdown: boolean;
  /** Global default: export PNGs with transparent background (false = white fill). */
  transparentBackground: boolean;
  /** Global default frame name to crop exports to. Empty = export the whole canvas. */
  exportFrame: string;
  /** Per-folder overrides, applied before per-file frontmatter. */
  folderConfigs: FolderConfig[];
  /** When true, rename/delete of a drawing also renames/deletes its companion files. */
  keepInSync: boolean;
  /** When converting an Excalidraw drawing, remove the original Excalidraw data
   *  (the "# Excalidraw Data" section) from the note. False keeps it as inert text. */
  removeExcalidrawData: boolean;
  /** When converting a markdown note into an svgedit drawing, add a frontmatter
   *  tag to mark it. When false, no tag is stamped. */
  addDrawingTag: boolean;
  /** The tag text added on conversion when addDrawingTag is true (no leading #). */
  drawingTag: string;
  /** Custom export destinations: drawings in sourceFolder export to exportFolder. */
  exportFolderMappings: ExportFolderMapping[];
  /** Persisted svgedit editor theme. "auto" follows Obsidian's light/dark mode;
   *  "light"/"dark" is the user's explicit in-editor choice, remembered across
   *  files and sessions. */
  editorTheme: "auto" | "light" | "dark";
  /** svgedit UI mode used when Obsidian runs on a desktop/PC. "tablet" enables
   *  svgedit's touch-first shell; "desktop" uses the standard layout. */
  uiModeDesktop: "desktop" | "tablet";
  /** svgedit UI mode used when Obsidian runs on a mobile device. */
  uiModeMobile: "desktop" | "tablet";
  /** When true, the drawing SVG is stored LZString-compressed in the note to
   *  keep files slim. When false it is stored as readable SVG (better git diffs
   *  and plain-text search). Existing files migrate to the chosen format on the
   *  next save; reads handle both formats either way. */
  compressDrawingData: boolean;
}

export const DEFAULT_SETTINGS: SvgPluginSettings = {
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
  removeExcalidrawData: false,
  addDrawingTag: true,
  drawingTag: "svg",
  exportFolderMappings: [],
  editorTheme: "auto",
  uiModeDesktop: "desktop",
  uiModeMobile: "tablet",
  compressDrawingData: true,
};
