import { App, TFile, normalizePath } from "obsidian";
import { svgToPngArrayBuffer } from "./raster";
import { prepareSvgForExport, listFrames, resolveExportJobs } from "./frames";
import { decodeGradientBg, bakeGradientIntoSvg } from "../data/SvgData";
import { bakeExternalEmbedsForExport } from "../data/lockedEmbeds";
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
  const baked = await bakeExternalEmbedsForExport(app, svgString, sourceFile.path);
  await app.vault.adapter.write(path, prepareSvgForExport(baked, frameName));
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
  const baked = await bakeExternalEmbedsForExport(app, svgString, sourceFile.path);
  let svg = prepareSvgForExport(baked, frameName);
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

export interface ExportFormats {
  svg: boolean;
  png: boolean;
}

/**
 * Export the drawing in the given formats, honouring the file's resolved
 * `exportFrame` (whole canvas, one frame, a list, or all frames).
 *
 * Suffixed per-frame files are recorded in `settings.frameExportManifest`; any
 * recorded file no longer produced (frame deleted/renamed, or the mode switched
 * back) is deleted. Only recorded files are ever removed, never by name pattern.
 */
export async function exportDrawing(
  app: App,
  file: TFile,
  svgString: string,
  settings: SvgPluginSettings,
  effective: EffectiveDrawingSettings,
  formats: ExportFormats,
  bgColor = "#ffffff",
  saveSettings: () => Promise<void> = async () => {},
): Promise<void> {
  const jobs = resolveExportJobs(effective.exportFrame, listFrames(svgString), frameFileSuffix);
  const tasks: Promise<void>[] = [];
  const written: string[] = [];
  for (const job of jobs) {
    if (formats.svg) {
      tasks.push(exportSvg(app, file, svgString, settings, job.frameName, job.suffix));
      if (job.suffix) written.push(getCompanionPath(file.path, "svg", settings, job.suffix));
    }
    if (formats.png) {
      tasks.push(exportPng(app, file, svgString, settings.pngScale, effective.transparentBackground, settings, job.frameName, job.suffix, bgColor));
      if (job.suffix) written.push(getCompanionPath(file.path, "png", settings, job.suffix));
    }
  }
  await Promise.all(tasks);
  await removeStaleFrameExports(app, file, settings, written, formats, saveSettings);
}

/** Delete recorded per-frame files (of the exported formats) not in `written`, then update the manifest. */
async function removeStaleFrameExports(
  app: App,
  file: TFile,
  settings: SvgPluginSettings,
  written: string[],
  formats: ExportFormats,
  saveSettings: () => Promise<void>,
): Promise<void> {
  const manifest = settings.frameExportManifest;
  const previous = manifest[file.path] ?? [];
  // A partial run (e.g. SVG-only quick export) must not touch the other format's files.
  const covered = (p: string) => (p.endsWith(".svg") ? formats.svg : formats.png);
  const stale = previous.filter((p) => covered(p) && !written.includes(p));
  for (const path of stale) {
    try {
      if (await app.vault.adapter.exists(path)) await app.vault.adapter.remove(path);
    } catch (e) {
      console.error("[Sketch Editor] failed to remove stale frame export:", path, e);
    }
  }
  const next = [...new Set([...previous.filter((p) => !stale.includes(p)), ...written])];
  if (JSON.stringify(next) === JSON.stringify(previous)) return;
  if (next.length) manifest[file.path] = next;
  else delete manifest[file.path];
  await saveSettings();
}

export async function autoExport(
  app: App,
  file: TFile,
  svgString: string,
  settings: SvgPluginSettings,
  effective: EffectiveDrawingSettings,
  bgColor = "#ffffff",
  saveSettings: () => Promise<void> = async () => {},
): Promise<void> {
  await exportDrawing(
    app, file, svgString, settings, effective,
    { svg: effective.autoExportSvg, png: effective.autoExportPng },
    bgColor, saveSettings,
  );
}
