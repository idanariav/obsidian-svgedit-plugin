import { App, TFile } from "obsidian";
import {
  FRONTMATTER_KEY_OPEN_MD,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
  FRONTMATTER_KEY_AUTO_EXPORT,
  FRONTMATTER_KEY_AUTO_EXPORT_PNG,
  FRONTMATTER_KEY_TRANSPARENT_BG,
  FRONTMATTER_KEY_EXPORT_FRAME,
} from "../constants";
import type {
  SvgPluginSettings,
  FolderConfig,
  EffectiveDrawingSettings,
} from "../settings/defaults";

export function isSvgDrawingFile(app: App, file: TFile): boolean {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  return fm?.[FRONTMATTER_KEY_PLUGIN] === FRONTMATTER_PLUGIN_VALUE;
}

export function shouldOpenAsMarkdown(app: App, file: TFile): boolean {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  return !!fm?.[FRONTMATTER_KEY_OPEN_MD];
}

export async function toggleOpenMd(app: App, file: TFile): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm[FRONTMATTER_KEY_OPEN_MD] = !fm[FRONTMATTER_KEY_OPEN_MD];
  });
}

// ── Resolution logic ──────────────────────────────────────────────────────────

/**
 * Resolve the effective drawing settings for a specific file by applying the
 * hierarchy: global defaults → folder override → per-file frontmatter.
 */
export function resolveEffectiveSettings(
  app: App,
  file: TFile,
  globalSettings: SvgPluginSettings,
): EffectiveDrawingSettings {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;

  // 1. Start from global defaults
  let openAsMarkdown        = globalSettings.openAsMarkdown;
  let autoExportSvg         = globalSettings.autoExportSvg;
  let autoExportPng         = globalSettings.autoExportPng;
  let transparentBackground = globalSettings.transparentBackground;
  let exportFrame           = globalSettings.exportFrame;

  // 2. Apply the best-matching folder override (longest matching path wins)
  const folder = resolveFolderConfig(file.path, globalSettings.folderConfigs);
  if (folder) {
    if (folder.openAsMarkdown        !== undefined) openAsMarkdown        = folder.openAsMarkdown;
    if (folder.autoExportSvg         !== undefined) autoExportSvg         = folder.autoExportSvg;
    if (folder.autoExportPng         !== undefined) autoExportPng         = folder.autoExportPng;
    if (folder.transparentBackground !== undefined) transparentBackground = folder.transparentBackground;
    if (folder.exportFrame           !== undefined) exportFrame           = folder.exportFrame;
  }

  // 3. Apply per-file frontmatter overrides
  if (fm?.[FRONTMATTER_KEY_OPEN_MD]         !== undefined && fm[FRONTMATTER_KEY_OPEN_MD]         !== null)
    openAsMarkdown        = !!fm[FRONTMATTER_KEY_OPEN_MD];

  // The `svg-auto-export` list, when present, fully determines both formats.
  // Present-but-empty (null) means "export nothing". When absent, fall back to
  // the legacy boolean `svg-auto-export-png` (PNG only) for older files.
  if (fm?.[FRONTMATTER_KEY_AUTO_EXPORT] !== undefined) {
    const formats = parseAutoExportList(fm[FRONTMATTER_KEY_AUTO_EXPORT]);
    autoExportSvg = formats.svg;
    autoExportPng = formats.png;
  } else if (fm?.[FRONTMATTER_KEY_AUTO_EXPORT_PNG] !== undefined && fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG] !== null) {
    autoExportPng = !!fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG];
  }

  if (fm?.[FRONTMATTER_KEY_TRANSPARENT_BG]  !== undefined && fm[FRONTMATTER_KEY_TRANSPARENT_BG]  !== null)
    transparentBackground = !!fm[FRONTMATTER_KEY_TRANSPARENT_BG];
  if (fm?.[FRONTMATTER_KEY_EXPORT_FRAME]    !== undefined && fm[FRONTMATTER_KEY_EXPORT_FRAME]    !== null)
    exportFrame           = String(fm[FRONTMATTER_KEY_EXPORT_FRAME]);

  return { openAsMarkdown, autoExportSvg, autoExportPng, transparentBackground, exportFrame };
}

/**
 * Parse the `svg-auto-export` frontmatter value into format flags. Accepts a
 * YAML list (`[svg, png]`), a single string (`png`), or comma/space-separated
 * text. Unknown tokens are ignored; null/empty yields no exports.
 */
function parseAutoExportList(raw: unknown): { svg: boolean; png: boolean } {
  const tokens = Array.isArray(raw)
    ? raw.map((t) => String(t))
    : String(raw ?? "").split(/[\s,]+/);
  const set = new Set(tokens.map((t) => t.trim().toLowerCase()).filter(Boolean));
  return { svg: set.has("svg"), png: set.has("png") };
}

/**
 * Return the FolderConfig whose folder path is the longest prefix of filePath.
 * Files at the vault root (no "/") fall back to a config with folder === "".
 */
function resolveFolderConfig(filePath: string, configs: FolderConfig[]): FolderConfig | null {
  const slashIdx = filePath.lastIndexOf("/");
  const dir = slashIdx >= 0 ? filePath.substring(0, slashIdx) : "";

  let best: FolderConfig | null = null;
  let bestLen = -1;

  for (const cfg of configs) {
    const f = cfg.folder.replace(/\/$/, "");
    const matches = f === "" ? true : (dir === f || dir.startsWith(f + "/"));
    if (matches && f.length > bestLen) {
      best = cfg;
      bestLen = f.length;
    }
  }

  return best;
}
