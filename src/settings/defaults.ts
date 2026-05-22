export interface SvgPluginSettings {
  autoExportSvg: boolean;
  autoExportPng: boolean;
  pngScale: number;
  defaultCanvasWidth: number;
  defaultCanvasHeight: number;
  drawingsFolder: string;
}

export const DEFAULT_SETTINGS: SvgPluginSettings = {
  autoExportSvg: true,
  autoExportPng: true,
  pngScale: 1,
  defaultCanvasWidth: 800,
  defaultCanvasHeight: 600,
  drawingsFolder: "",
};
