import { TAbstractFile, TFile, normalizePath } from "obsidian";
import type SvgPlugin from "./main";
import { getCompanionPath } from "./export/exporter";
import { isSvgDrawingFile } from "./data/frontmatter";
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

  // Identify the drawing by reading the renamed file's frontmatter directly,
  // rather than trusting the pre-seeded svgDrawingPaths set (which can be empty
  // if the metadataCache wasn't ready when the set was seeded). After a rename
  // the file content is unchanged, so the cache still carries the frontmatter
  // under the new path. Fall back to the tracked set for robustness.
  if (!isSvgDrawingFile(plugin.app, file) && !plugin.svgDrawingPaths.has(oldPath)) {
    return;
  }

  // Update tracked path immediately
  plugin.svgDrawingPaths.delete(oldPath);
  plugin.svgDrawingPaths.add(file.path);

  for (const ext of ["svg", "png"] as const) {
    const oldCompanion = normalizePath(getCompanionPath(oldPath, ext, plugin.settings));
    const newCompanion = normalizePath(getCompanionPath(file.path, ext, plugin.settings));
    if (oldCompanion === newCompanion) continue;

    const companionFile = plugin.app.vault.getAbstractFileByPath(oldCompanion);
    if (!(companionFile instanceof TFile)) continue;

    // A companion may already exist at the new path: the open view's autoExport
    // re-writes companions under the renamed file's path on save, and that can
    // win the race against this handler. renameFile() throws if the destination
    // exists, which would orphan the old-named file. In that case the newly
    // exported companion is the source of truth — drop the stale old one.
    if (plugin.app.vault.getAbstractFileByPath(newCompanion) instanceof TFile) {
      await plugin.app.vault.delete(companionFile);
      continue;
    }
    try {
      await plugin.app.fileManager.renameFile(companionFile, newCompanion);
    } catch {
      // Lost the race after the existence check above — remove the orphan.
      if (plugin.app.vault.getAbstractFileByPath(oldCompanion) instanceof TFile) {
        await plugin.app.vault.delete(companionFile);
      }
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
