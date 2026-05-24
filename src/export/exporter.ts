import { App, TFile, normalizePath } from "obsidian";
import { svgToPngArrayBuffer } from "./raster";
import type { SvgPluginSettings, EffectiveDrawingSettings } from "../settings/defaults";

/**
 * Resolve the companion file path for a drawing.
 *
 * If `settings.exportFolderMappings` contains an entry whose sourceFolder is a
 * prefix of `sourcePath`, the companion is written to `exportFolder` instead of
 * next to the source file.  Longest-prefix match wins.
 */
export function getCompanionPath(
  sourcePath: string,
  ext: "svg" | "png",
  settings: SvgPluginSettings,
): string {
  const basename = sourcePath.split("/").pop()!.replace(/\.md$/, "") + "." + ext;

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
    return normalizePath(exportFolder.replace(/\/?$/, "/") + basename);
  }
  return normalizePath(sourcePath.replace(/\.md$/, "") + "." + ext);
}

export async function exportSvg(
  app: App,
  sourceFile: TFile,
  svgString: string,
  settings: SvgPluginSettings,
): Promise<void> {
  const path = getCompanionPath(sourceFile.path, "svg", settings);
  await app.vault.adapter.write(path, svgString);
}

export async function exportPng(
  app: App,
  sourceFile: TFile,
  svgString: string,
  scale: number,
  transparent = false,
  settings: SvgPluginSettings,
): Promise<void> {
  const path = getCompanionPath(sourceFile.path, "png", settings);
  const buf = await svgToPngArrayBuffer(svgString, scale, transparent);
  await app.vault.adapter.writeBinary(path, buf);
}

export async function autoExport(
  app: App,
  file: TFile,
  svgString: string,
  settings: SvgPluginSettings,
  effective: EffectiveDrawingSettings,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (settings.autoExportSvg) tasks.push(exportSvg(app, file, svgString, settings));
  if (effective.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale, effective.transparentBackground, settings));
  await Promise.all(tasks);
}
