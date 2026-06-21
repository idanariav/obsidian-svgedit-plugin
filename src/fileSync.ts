import { TAbstractFile, TFile, normalizePath } from "obsidian";
import type SvgPlugin from "./main";
import { getCompanionPath } from "./export/exporter";
import { isSvgDrawingFile } from "./data/frontmatter";
import {
  FRONTMATTER_KEY_PLUGIN,
  LEGACY_FRONTMATTER_KEY_PLUGIN,
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
      const marker = fm?.[FRONTMATTER_KEY_PLUGIN] ?? fm?.[LEGACY_FRONTMATTER_KEY_PLUGIN];
      if (marker === FRONTMATTER_PLUGIN_VALUE) {
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

/**
 * After a file rename, repoint any shape-library entry whose `linkedFile`
 * referred to the old path, so future imports of that shape stamp a live
 * wikilink instead of a broken one. Returns true if any entry changed.
 *
 * Stored links come from `fileToLinktext(file, "")` (see resolveVaultLink),
 * which is the basename under Obsidian's default "shortest path" but can be a
 * longer path when ambiguous. A `#frame` suffix, if present, is preserved.
 */
function updateShapeLinksOnRename(
  plugin: SvgPlugin,
  file: TFile,
  oldPath: string,
): boolean {
  const store = plugin.settings.userShapes;
  let changed = false;
  const newLink = plugin.app.metadataCache.fileToLinktext(file, "");
  for (const category of Object.values(store.shapes)) {
    for (const entry of Object.values(category)) {
      if (!entry.linkedFile) continue;
      const hashIdx = entry.linkedFile.indexOf("#");
      const base = hashIdx >= 0 ? entry.linkedFile.slice(0, hashIdx) : entry.linkedFile;
      const frame = hashIdx >= 0 ? entry.linkedFile.slice(hashIdx) : ""; // includes '#'
      if (!linktextPointsTo(base, oldPath)) continue;
      entry.linkedFile = frame ? `${newLink}${frame}` : newLink;
      changed = true;
    }
  }
  return changed;
}

/** True if a stored linktext base referred to the file now at `oldPath`. */
function linktextPointsTo(base: string, oldPath: string): boolean {
  const stripMd = (s: string) => s.replace(/\.md$/i, "");
  const baseName = (s: string) => {
    const slash = s.lastIndexOf("/");
    return slash >= 0 ? s.slice(slash + 1) : s;
  };
  // Full-path match (the link carried the folder path)
  const baseAsPath = /\.[^/]+$/.test(base) ? base : `${base}.md`;
  if (baseAsPath === oldPath) return true;
  // Basename match (shortest-path link — the common case)
  return stripMd(baseName(base)) === stripMd(baseName(oldPath));
}

async function handleRename(
  plugin: SvgPlugin,
  file: TFile,
  oldPath: string,
): Promise<void> {
  if (updateShapeLinksOnRename(plugin, file, oldPath)) {
    await plugin.saveSettings();
    plugin.reloadUserDataInAllViews();
  }

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
