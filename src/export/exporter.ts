import { App, TFile, normalizePath } from "obsidian";
import { svgToPngArrayBuffer } from "./raster";
import type { SvgPluginSettings, EffectiveDrawingSettings } from "../settings/defaults";

export function getCompanionPath(
  sourceFile: TFile,
  ext: "svg" | "png",
): string {
  const base = sourceFile.path.replace(/\.md$/, "");
  return normalizePath(`${base}.${ext}`);
}

export async function exportSvg(
  app: App,
  sourceFile: TFile,
  svgString: string,
): Promise<void> {
  const path = getCompanionPath(sourceFile, "svg");
  await app.vault.adapter.write(path, svgString);
}

export async function exportPng(
  app: App,
  sourceFile: TFile,
  svgString: string,
  scale: number,
  transparent = false,
): Promise<void> {
  const path = getCompanionPath(sourceFile, "png");
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
  if (settings.autoExportSvg) tasks.push(exportSvg(app, file, svgString));
  if (effective.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale, effective.transparentBackground));
  await Promise.all(tasks);
}
