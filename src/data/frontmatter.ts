import { App, TFile } from "obsidian";
import {
  FRONTMATTER_KEY_OPEN_MD,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
} from "../constants";

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
