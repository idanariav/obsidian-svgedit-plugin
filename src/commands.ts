import { App, Notice, TFile } from "obsidian";
import type SvgPlugin from "./main";
import { SvgView } from "./view/SvgView";
import { NewDrawingModal } from "./modals/NewDrawingModal";
import { isSvgDrawingFile, resolveEffectiveSettings } from "./data/frontmatter";
import { exportSvg, exportPng } from "./export/exporter";
import { ExportModal } from "./modals/ExportModal";
import { extractSvg, replaceSvg } from "./data/SvgData";
import {
  parseExcalidrawScene,
  excalidrawToSvg,
  stripExcalidrawData,
} from "./import/excalidrawImport";
import {
  VIEW_TYPE_SVG,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
  EMPTY_SVG,
} from "./constants";

const EXCALIDRAW_FM_KEY = "excalidraw-plugin";

/** True when the file is an Obsidian Excalidraw drawing. */
function isExcalidrawFile(app: App, file: TFile): boolean {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  return fm?.[EXCALIDRAW_FM_KEY] != null;
}

/**
 * Stamp the configured drawing tag onto a note's frontmatter when converting it
 * to an svgedit drawing. No-op when the setting is disabled or the tag is blank.
 */
function applyDrawingTag(fm: Record<string, unknown>, plugin: SvgPlugin): void {
  if (!plugin.settings.addDrawingTag) return;
  const tag = plugin.settings.drawingTag.trim();
  if (!tag) return;
  if (!Array.isArray(fm.tags)) {
    fm.tags = [tag];
  } else if (!(fm.tags as string[]).includes(tag)) {
    (fm.tags as string[]).push(tag);
  }
}

export function registerCommands(plugin: SvgPlugin): void {
  // New drawing
  plugin.addCommand({
    id: "new-svg-drawing",
    name: "New SVG drawing",
    callback: () => {
      new NewDrawingModal(
        plugin.app,
        plugin.settings.drawingsFolder,
        plugin.settings.compressDrawingData,
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

  // Convert the active Excalidraw drawing into an svgedit drawing (in place)
  plugin.addCommand({
    id: "convert-excalidraw-to-svg",
    name: "Convert Excalidraw drawing to SVG",
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || file.extension !== "md") return false;
      if (!isExcalidrawFile(plugin.app, file)) return false;
      if (!checking) convertExcalidrawToDrawing(plugin, file);
      return true;
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

  // Export drawing (menu) — pick format, transparency and region
  plugin.addCommand({
    id: "export-drawing",
    name: "Export drawing…",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) new ExportModal(plugin, view).open();
      return true;
    },
  });

  // Quick export commands — use the file's resolved export region (frame/canvas)
  plugin.addCommand({
    id: "export-svg",
    name: "Export drawing as SVG",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view || !view.file) return false;
      if (!checking) {
        const svgString = view.getExportSvgString();
        if (!svgString) return true;
        const { exportFrame } = resolveEffectiveSettings(plugin.app, view.file, plugin.settings);
        exportSvg(plugin.app, view.file, svgString, plugin.settings, exportFrame)
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
        const svgString = view.getExportSvgString();
        if (!svgString) return true;
        const { transparentBackground, exportFrame } =
          resolveEffectiveSettings(plugin.app, view.file, plugin.settings);
        exportPng(plugin.app, view.file, svgString, plugin.settings.pngScale, transparentBackground, plugin.settings, exportFrame, "", view.getCanvasBgColor())
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
 * Convert an Excalidraw drawing note into an svgedit drawing in place: parse the
 * scene to clean SVG primitives, swap the frontmatter from Excalidraw to svgedit,
 * optionally strip the original Excalidraw data, embed the SVG block, then reopen
 * so the setViewState patch routes the file to SvgView.
 */
async function convertExcalidrawToDrawing(plugin: SvgPlugin, file: TFile): Promise<void> {
  try {
    const original = await plugin.app.vault.read(file);
    const scene = parseExcalidrawScene(original);
    if (!scene) {
      new Notice("No Excalidraw drawing data found in this note");
      return;
    }
    const svg = excalidrawToSvg(scene);

    // 1. Swap frontmatter: drop every excalidraw-* key (so the Excalidraw plugin
    //    no longer claims the file), stamp the svgedit keys + svg tag.
    await plugin.app.fileManager.processFrontMatter(file, (fm) => {
      for (const key of Object.keys(fm)) {
        if (key.startsWith("excalidraw-")) delete fm[key];
      }
      fm[FRONTMATTER_KEY_PLUGIN] = FRONTMATTER_PLUGIN_VALUE;
      applyDrawingTag(fm, plugin);
    });

    // 2. Body edits on the (frontmatter-updated) content.
    let content = await plugin.app.vault.read(file);
    if (plugin.settings.removeExcalidrawData) {
      content = stripExcalidrawData(content);
    }
    await plugin.app.vault.modify(file, replaceSvg(content, svg, plugin.settings.compressDrawingData));

    // 3. Reopen — the setViewState patch now routes it to SvgView.
    const leaf = getActiveLeaf(plugin);
    await leaf.openFile(file, { active: true });
    new Notice("Converted Excalidraw drawing to SVG");
  } catch (e: unknown) {
    new Notice(`Convert failed: ${(e as Error).message}`);
  }
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
      applyDrawingTag(fm, plugin);
    });

    // 2. Append the drawing block if it isn't there yet
    const content = await plugin.app.vault.read(file);
    if (!extractSvg(content)) {
      await plugin.app.vault.modify(file, replaceSvg(content, EMPTY_SVG, plugin.settings.compressDrawingData));
    }

    // 3. Reopen — setViewState patch will now route it to SvgView
    const leaf = getActiveLeaf(plugin);
    await leaf.openFile(file, { active: true });
  } catch (e: unknown) {
    new Notice(`Convert failed: ${(e as Error).message}`);
  }
}

/**
 * Switch the active leaf between SVG drawing view and markdown view without
 * touching frontmatter.  The svg-open-md flag only controls the *default*
 * view when a file is first opened; this command just flips the current view.
 *
 * SVG → markdown: save the drawing first, then bypass the setViewState patch
 *   so Obsidian actually shows the markdown view.
 * Markdown → SVG: set the view type directly (no patch bypass needed).
 */
async function toggleViewMode(plugin: SvgPlugin, file: TFile): Promise<void> {
  try {
    const leaf = getActiveLeaf(plugin);
    const view = leaf.view;

    if (view?.getViewType() === VIEW_TYPE_SVG) {
      // Currently in SVG view → switch to markdown.
      // Save first so drawing changes are not lost.
      await (view as SvgView).save();
      // Bypass the redirect patch for this one setViewState call.
      plugin.bypassLeaves.add(leaf);
      await leaf.setViewState({ type: "markdown", state: { file: file.path } });
    } else {
      // Currently in markdown view → switch to SVG.
      await leaf.setViewState({ type: VIEW_TYPE_SVG, state: { file: file.path } });
    }
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
