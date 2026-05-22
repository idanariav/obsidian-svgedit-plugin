import { App, TFile, normalizePath } from "obsidian";
import { svgToPngArrayBuffer } from "./raster";
import { SvgPluginSettings } from "../settings/defaults";

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
): Promise<void> {
  const path = getCompanionPath(sourceFile, "png");
  const buf = await svgToPngArrayBuffer(svgString, scale);
  await app.vault.adapter.writeBinary(path, buf);
}

export async function autoExport(
  app: App,
  file: TFile,
  svgString: string,
  settings: SvgPluginSettings,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (settings.autoExportSvg) tasks.push(exportSvg(app, file, svgString));
  if (settings.autoExportPng)
    tasks.push(exportPng(app, file, svgString, settings.pngScale));
  await Promise.all(tasks);
}
