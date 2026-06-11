import { App, TFile, normalizePath } from "obsidian";
import { svgToPngArrayBuffer } from "./raster";
import { prepareSvgForExport } from "./frames";
import { decodeGradientBg, bakeGradientIntoSvg } from "../data/SvgData";
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
  suffix = "",
): string {
  const stem = sourcePath.split("/").pop()!.replace(/\.md$/, "");
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
    return normalizePath(exportFolder.replace(/\/?$/, "/") + basename);
  }
  return normalizePath(sourcePath.replace(/[^/]+$/, basename));
}

/**
 * Turn a frame name into a filename-safe path suffix (e.g. "Hero shot" →
 * "-hero-shot"). Used by one-off frame exports so they land in a distinct file
 * that auto-export-on-save never overwrites.
 */
export function frameFileSuffix(frameName: string): string {
  const slug = frameName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-");
  return slug ? `-${slug}` : "";
}

export async function exportSvg(
  app: App,
  sourceFile: TFile,
  svgString: string,
  settings: SvgPluginSettings,
  frameName = "",
  pathSuffix = "",
): Promise<void> {
  const path = getCompanionPath(sourceFile.path, "svg", settings, pathSuffix);
  await app.vault.adapter.write(path, prepareSvgForExport(svgString, frameName));
}

export async function exportPng(
  app: App,
  sourceFile: TFile,
  svgString: string,
  scale: number,
  transparent = false,
  settings: SvgPluginSettings,
  frameName = "",
  pathSuffix = "",
  bgColor = "#ffffff",
): Promise<void> {
  const path = getCompanionPath(sourceFile.path, "png", settings, pathSuffix);
  let svg = prepareSvgForExport(svgString, frameName);
  let solidBg = bgColor;
  // A gradient background can't be a ctx.fillStyle, so bake it into the SVG as
  // a full-canvas rect and rasterize transparently (the gradient is now drawn
  // by the SVG itself). Solid colors keep the simpler fillStyle path. Skip when
  // a transparent export was requested — then no background is wanted at all.
  const gradientXml = transparent ? null : decodeGradientBg(bgColor);
  if (gradientXml) {
    svg = bakeGradientIntoSvg(svg, gradientXml);
    transparent = true;
    solidBg = "#ffffff";
  }
  const buf = await svgToPngArrayBuffer(svg, scale, transparent, solidBg);
  await app.vault.adapter.writeBinary(path, buf);
}

export async function autoExport(
  app: App,
  file: TFile,
  svgString: string,
  settings: SvgPluginSettings,
  effective: EffectiveDrawingSettings,
  bgColor = "#ffffff",
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (effective.autoExportSvg)
    tasks.push(exportSvg(app, file, svgString, settings, effective.exportFrame));
  if (effective.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale, effective.transparentBackground, settings, effective.exportFrame, "", bgColor));
  await Promise.all(tasks);
}
