import { TAbstractFile, TFile, normalizePath } from "obsidian";
import type SvgPlugin from "./main";
import { getCompanionPath } from "./export/exporter";
import {
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
} from "./constants";

/**
 * Register vault rename/delete event handlers and keep `plugin.svgDrawingPaths`
 * up to date via metadataCache changes.
 *
 * Call this once during plugin load, after `svgDrawingPaths` has been seeded.
 */
export function registerFileSyncHandlers(plugin: SvgPlugin): void {
  // Keep the tracked-paths set in sync as frontmatter changes
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm?.[FRONTMATTER_KEY_PLUGIN] === FRONTMATTER_PLUGIN_VALUE) {
        plugin.svgDrawingPaths.add(file.path);
      } else {
        plugin.svgDrawingPaths.delete(file.path);
      }
    }),
  );

  plugin.registerEvent(
    plugin.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
      if (!(file instanceof TFile)) return;
      void handleRename(plugin, file, oldPath);
    }),
  );

  plugin.registerEvent(
    plugin.app.vault.on("delete", (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      void handleDelete(plugin, file);
    }),
  );
}

async function handleRename(
  plugin: SvgPlugin,
  file: TFile,
  oldPath: string,
): Promise<void> {
  if (!plugin.settings.keepInSync) return;
  if (!plugin.svgDrawingPaths.has(oldPath)) return;

  // Update tracked path immediately
  plugin.svgDrawingPaths.delete(oldPath);
  plugin.svgDrawingPaths.add(file.path);

  for (const ext of ["svg", "png"] as const) {
    const oldCompanion = getCompanionPath(oldPath, ext, plugin.settings);
    const newCompanion = getCompanionPath(file.path, ext, plugin.settings);
    if (oldCompanion === newCompanion) continue;
    const companionFile = plugin.app.vault.getAbstractFileByPath(normalizePath(oldCompanion));
    if (companionFile instanceof TFile) {
      await plugin.app.fileManager.renameFile(companionFile, normalizePath(newCompanion));
    }
  }
}

async function handleDelete(plugin: SvgPlugin, file: TFile): Promise<void> {
  if (!plugin.settings.keepInSync) return;
  if (!plugin.svgDrawingPaths.has(file.path)) return;

  plugin.svgDrawingPaths.delete(file.path);

  // Snapshot companion paths before any async delay
  const companions = (["svg", "png"] as const).map((ext) =>
    getCompanionPath(file.path, ext, plugin.settings),
  );

  // Short delay: let Obsidian finish closing any open views of the deleted file
  window.setTimeout(() => {
    for (const companionPath of companions) {
      const f = plugin.app.vault.getAbstractFileByPath(normalizePath(companionPath));
      if (f instanceof TFile) plugin.app.vault.delete(f);
    }
  }, 500);
}
