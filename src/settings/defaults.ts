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
};
