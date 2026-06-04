import { App, TFile } from "obsidian";
import {
  FRONTMATTER_KEY_OPEN_MD,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
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
  let autoExportPng         = globalSettings.autoExportPng;
  let transparentBackground = globalSettings.transparentBackground;
  let exportFrame           = globalSettings.exportFrame;

  // 2. Apply the best-matching folder override (longest matching path wins)
  const folder = resolveFolderConfig(file.path, globalSettings.folderConfigs);
  if (folder) {
    if (folder.openAsMarkdown        !== undefined) openAsMarkdown        = folder.openAsMarkdown;
    if (folder.autoExportPng         !== undefined) autoExportPng         = folder.autoExportPng;
    if (folder.transparentBackground !== undefined) transparentBackground = folder.transparentBackground;
    if (folder.exportFrame           !== undefined) exportFrame           = folder.exportFrame;
  }

  // 3. Apply per-file frontmatter overrides
  if (fm?.[FRONTMATTER_KEY_OPEN_MD]         !== undefined && fm[FRONTMATTER_KEY_OPEN_MD]         !== null)
    openAsMarkdown        = !!fm[FRONTMATTER_KEY_OPEN_MD];
  if (fm?.[FRONTMATTER_KEY_AUTO_EXPORT_PNG] !== undefined && fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG] !== null)
    autoExportPng         = !!fm[FRONTMATTER_KEY_AUTO_EXPORT_PNG];
  if (fm?.[FRONTMATTER_KEY_TRANSPARENT_BG]  !== undefined && fm[FRONTMATTER_KEY_TRANSPARENT_BG]  !== null)
    transparentBackground = !!fm[FRONTMATTER_KEY_TRANSPARENT_BG];
  if (fm?.[FRONTMATTER_KEY_EXPORT_FRAME]    !== undefined && fm[FRONTMATTER_KEY_EXPORT_FRAME]    !== null)
    exportFrame           = String(fm[FRONTMATTER_KEY_EXPORT_FRAME]);

  return { openAsMarkdown, autoExportPng, transparentBackground, exportFrame };
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
