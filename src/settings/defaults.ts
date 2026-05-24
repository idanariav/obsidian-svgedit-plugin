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
}

/** Resolved, concrete settings for a specific file (no undefined values). */
export interface EffectiveDrawingSettings {
  openAsMarkdown: boolean;
  autoExportPng: boolean;
  transparentBackground: boolean;
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
  /** Per-folder overrides, applied before per-file frontmatter. */
  folderConfigs: FolderConfig[];
  /** When true, rename/delete of a drawing also renames/deletes its companion files. */
  keepInSync: boolean;
  /** Custom export destinations: drawings in sourceFolder export to exportFolder. */
  exportFolderMappings: ExportFolderMapping[];
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
  folderConfigs: [],
  keepInSync: false,
  exportFolderMappings: [],
};
