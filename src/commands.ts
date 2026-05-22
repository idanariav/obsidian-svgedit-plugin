import { Notice, TFile } from "obsidian";
import type SvgPlugin from "./main";
import { SvgView } from "./view/SvgView";
import { NewDrawingModal } from "./modals/NewDrawingModal";
import { toggleOpenMd, isSvgDrawingFile } from "./data/frontmatter";
import { exportSvg, exportPng } from "./export/exporter";
import { extractSvg, replaceSvg } from "./data/SvgData";
import {
  VIEW_TYPE_SVG,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_KEY_OPEN_MD,
  FRONTMATTER_PLUGIN_VALUE,
  EMPTY_SVG,
} from "./constants";

export function registerCommands(plugin: SvgPlugin): void {
  // New drawing
  plugin.addCommand({
    id: "new-svg-drawing",
    name: "New SVG drawing",
    callback: () => {
      new NewDrawingModal(
        plugin.app,
        plugin.settings.drawingsFolder,
        async ({ path, content }) => {
          try {
            const existing = plugin.app.vault.getAbstractFileByPath(path);
            if (existing) {
              new Notice(`File already exists: ${path}`);
              return;
            }
            const file = await plugin.app.vault.create(path, content);
            const leaf = plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file, { active: true });
          } catch (e: unknown) {
            new Notice(`Could not create drawing: ${(e as Error).message}`);
          }
        },
      ).open();
    },
  });

  // Convert existing markdown note to an SVG drawing
  plugin.addCommand({
    id: "convert-to-svg-drawing",
    name: "Convert note to SVG drawing",
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || file.extension !== "md") return false;
      if (isSvgDrawingFile(plugin.app, file)) return false; // already a drawing
      if (!checking) convertNoteToDrawing(plugin, file);
      return true;
    },
  });

  // Insert file from vault (active SvgView)
  plugin.addCommand({
    id: "insert-file-from-vault",
    name: "Insert file from vault into drawing",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view) return false;
      if (!checking) plugin.openInsertFileModal(view);
      return true;
    },
  });

  // Toggle between SVG edit view and markdown source view
  plugin.addCommand({
    id: "toggle-svg-md-view",
    name: "Toggle drawing / markdown view",
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || !isSvgDrawingFile(plugin.app, file)) return false;
      if (!checking) toggleViewMode(plugin, file);
      return true;
    },
  });

  // Export commands
  plugin.addCommand({
    id: "export-svg",
    name: "Export drawing as SVG",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) {
        const svgString = view.getSvgString();
        if (!svgString) return true;
        exportSvg(plugin.app, view.file, svgString)
          .then(() => new Notice("Exported SVG"))
          .catch((e: unknown) => new Notice(`Export failed: ${(e as Error).message}`));
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "export-png",
    name: "Export drawing as PNG",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) {
        const svgString = view.getSvgString();
        if (!svgString) return true;
        exportPng(plugin.app, view.file, svgString, plugin.settings.pngScale)
          .then(() => new Notice("Exported PNG"))
          .catch((e: unknown) => new Notice(`Export failed: ${(e as Error).message}`));
      }
      return true;
    },
  });
}

function getActiveSvgView(plugin: SvgPlugin): SvgView | null {
  const view = plugin.app.workspace.getActiveViewOfType(SvgView);
  return view ?? null;
}

/**
 * Add SVG drawing frontmatter + empty drawing block to an existing markdown
 * note, then reopen it so the setViewState patch routes it to SvgView.
 */
async function convertNoteToDrawing(plugin: SvgPlugin, file: TFile): Promise<void> {
  try {
    // 1. Stamp frontmatter — processFrontMatter handles YAML safely
    await plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm[FRONTMATTER_KEY_PLUGIN] = FRONTMATTER_PLUGIN_VALUE;
      fm[FRONTMATTER_KEY_OPEN_MD] = false;
      if (!Array.isArray(fm.tags)) {
        fm.tags = ["svg"];
      } else if (!(fm.tags as string[]).includes("svg")) {
        (fm.tags as string[]).push("svg");
      }
    });

    // 2. Append the drawing block if it isn't there yet
    const content = await plugin.app.vault.read(file);
    if (!extractSvg(content)) {
      await plugin.app.vault.modify(file, replaceSvg(content, EMPTY_SVG));
    }

    // 3. Reopen — setViewState patch will now route it to SvgView
    const leaf = getActiveLeaf(plugin);
    await leaf.openFile(file, { active: true });
  } catch (e: unknown) {
    new Notice(`Convert failed: ${(e as Error).message}`);
  }
}

/**
 * Flip the svg-open-md frontmatter flag then reopen the file so Obsidian
 * re-evaluates which view to use (setViewState patch reads the flag).
 */
async function toggleViewMode(plugin: SvgPlugin, file: TFile): Promise<void> {
  try {
    await toggleOpenMd(plugin.app, file);
    const leaf = getActiveLeaf(plugin);
    await leaf.openFile(file, { active: true });
  } catch (e: unknown) {
    new Notice(`Toggle failed: ${(e as Error).message}`);
  }
}

/** Return the leaf that is currently showing an SVG or markdown view, falling
 *  back to a generic non-splitting leaf. Avoids the deprecated activeLeaf. */
function getActiveLeaf(plugin: SvgPlugin) {
  return (
    plugin.app.workspace.getActiveViewOfType(SvgView)?.leaf ??
    plugin.app.workspace.getMostRecentLeaf() ??
    plugin.app.workspace.getLeaf(false)
  );
}
