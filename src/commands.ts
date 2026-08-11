import { App, MarkdownView, Notice, normalizePath, parseYaml, TFile } from "obsidian";
import type SvgPlugin from "./main";
import { SvgView } from "./view/SvgView";
import { NewDrawingModal } from "./modals/NewDrawingModal";
import { isSvgDrawingFile, resolveEffectiveSettings } from "./data/frontmatter";
import { exportSvg, exportPng } from "./export/exporter";
import { ExportModal } from "./modals/ExportModal";
import { VersionsModal } from "./modals/VersionsModal";
import { extractSvg, replaceSvg, createDrawingTemplate } from "./data/SvgData";
import { uniqueVaultPath } from "./data/uniqueName";
import { stripTemplaterSyntax, applyTemplateFrontmatter } from "./data/templateFrontmatter";
import { createNoteViaTemplater } from "./integrations/templater";
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
  MAX_DRAWING_SNAPSHOTS,
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

/**
 * Read a template file's Sketch Editor Data directly (no Templater
 * execution), or EMPTY_SVG when no path is set / it can't be read. Shared by
 * resolveTemplateSvg and resolveDrawingTemplateSvg.
 */
async function readTemplateSvg(plugin: SvgPlugin, path: string, label: string): Promise<string> {
  if (!path) return EMPTY_SVG;
  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    new Notice(`${label} not found, using blank canvas: ${path}`);
    return EMPTY_SVG;
  }
  const svg = extractSvg(await plugin.app.vault.read(file));
  if (!svg) {
    new Notice(`${label} has no drawing data, using blank canvas: ${path}`);
    return EMPTY_SVG;
  }
  return svg;
}

/**
 * Resolve the configured template drawing's SVG (its Sketch Editor Data only),
 * or EMPTY_SVG when no template is set / it can't be read.
 */
export async function resolveTemplateSvg(plugin: SvgPlugin): Promise<string> {
  return readTemplateSvg(plugin, plugin.settings.defaultTemplate.trim(), "Template");
}

/**
 * Resolve the configured "Convert note to SVG drawing" drawing template's
 * SVG, or EMPTY_SVG when none is set / it can't be read. Kept separate from
 * resolveTemplateSvg because conversion reads the file's raw content directly
 * (extractSvg) rather than running it through Templater, so a defaultTemplate
 * that relies on Templater to dynamically embed a drawing would otherwise
 * yield unrendered Templater syntax here instead of real SVG data.
 */
export async function resolveDrawingTemplateSvg(plugin: SvgPlugin): Promise<string> {
  return readTemplateSvg(plugin, plugin.settings.defaultDrawingTemplate.trim(), "Drawing template");
}

/**
 * Static (non-Templater) frontmatter fields declared on the configured
 * template drawing, to pre-fill new/converted drawings with the same schema
 * (e.g. "Description:", "ContentStatus: Ideas"). A raw Templater template's
 * frontmatter isn't valid YAML on its own — see stripTemplaterSyntax for what
 * gets dropped before parsing. Returns {} when there's no template, it can't
 * be read, or nothing static survives.
 */
export async function resolveTemplateFrontmatter(plugin: SvgPlugin): Promise<Record<string, unknown>> {
  const path = plugin.settings.defaultTemplate.trim();
  if (!path) return {};
  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return {};
  const content = await plugin.app.vault.read(file);
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};
  try {
    const parsed = parseYaml(stripTemplaterSyntax(match[1]));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Try to create the new drawing note by running the configured template
 * through Templater itself (see integrations/templater.ts) rather than this
 * plugin's own static Drawing-block-and-frontmatter copy. Returns null when
 * there's no template configured, it isn't a real file, or Templater isn't
 * installed/enabled — callers fall back to createDrawingAt() in that case.
 */
export async function tryCreateDrawingViaTemplater(
  plugin: SvgPlugin,
  folder: string,
  filename: string,
): Promise<TFile | null> {
  const templatePath = plugin.settings.defaultTemplate.trim();
  if (!templatePath) return null;
  const templateFile = plugin.app.vault.getAbstractFileByPath(templatePath);
  if (!(templateFile instanceof TFile)) return null;
  return createNoteViaTemplater(plugin.app, templateFile, folder, filename);
}

/** Build a new drawing note directly at `path`, from the configured
 *  template's Drawing block and static frontmatter fields (the non-Templater
 *  path — see tryCreateDrawingViaTemplater for the preferred one). */
export async function createDrawingAt(plugin: SvgPlugin, path: string): Promise<TFile> {
  const templateSvg = await resolveTemplateSvg(plugin);
  const templateFrontmatter = await resolveTemplateFrontmatter(plugin);
  const content = createDrawingTemplate(plugin.settings.compressDrawingData, templateSvg);
  const file = await plugin.app.vault.create(path, content);
  if (Object.keys(templateFrontmatter).length) {
    await plugin.app.fileManager.processFrontMatter(file, (fm) =>
      applyTemplateFrontmatter(fm, templateFrontmatter),
    );
  }
  return file;
}

export function registerCommands(plugin: SvgPlugin): void {
  // New drawing
  plugin.addCommand({
    id: "new-svg-drawing",
    name: "New SVG drawing",
    callback: async () => {
      new NewDrawingModal(
        plugin.app,
        plugin.settings.drawingsFolder,
        async ({ path, folder, name }) => {
          try {
            const existing = plugin.app.vault.getAbstractFileByPath(path);
            if (existing) {
              new Notice(`File already exists: ${path}`);
              return;
            }
            const file =
              (await tryCreateDrawingViaTemplater(plugin, folder, name)) ??
              (await createDrawingAt(plugin, path));
            const leaf = plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file, { active: true });
          } catch (e: unknown) {
            new Notice(`Could not create drawing: ${(e as Error).message}`);
          }
        },
      ).open();
    },
  });

  // New drawing for the active note — creates a drawing (from the configured
  // template/folder/suffix) and links it back to the note via the configured
  // frontmatter field.
  plugin.addCommand({
    id: "new-drawing-for-note",
    name: "New drawing for this file",
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || file.extension !== "md") return false;
      if (!checking) void createDrawingForNote(plugin, file);
      return true;
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

  // Surface the drawing/markdown toggle in the file/tab "more options" menu so it
  // is reachable on mobile (no keyboard for the command). The file-menu event
  // also powers the tab-header "3-dots" menu. Scoped to the drawing currently
  // shown in the active leaf, so toggleViewMode acts on the right leaf.
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || !isSvgDrawingFile(plugin.app, file)) return;
      const leaf = plugin.app.workspace.getMostRecentLeaf();
      if ((leaf?.view as { file?: TFile })?.file?.path !== file.path) return;
      const inSvg = leaf?.view?.getViewType() === VIEW_TYPE_SVG;
      menu.addItem((item) =>
        item
          .setTitle(inSvg ? "Open as markdown" : "Open as drawing")
          .setIcon(inSvg ? "code" : "pencil")
          .onClick(() => void toggleViewMode(plugin, file)),
      );
    }),
  );

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

  // Drawing versioning — manage saved versions (list/restore/rename/replace/
  // delete/export), and a quick keyboard-driven save of a new version.
  plugin.addCommand({
    id: "manage-drawing-versions",
    name: "Manage drawing versions…",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view) return false;
      if (!checking) new VersionsModal(plugin, view).open();
      return true;
    },
  });

  plugin.addCommand({
    id: "save-drawing-version",
    name: "Save drawing version",
    checkCallback: (checking) => {
      const view = getActiveSvgView(plugin);
      if (!view) return false;
      if (!checking) {
        const count = view.listSnapshots().length;
        if (count >= MAX_DRAWING_SNAPSHOTS) {
          // At capacity — open the manager so the user can pick a slot to
          // replace instead of silently failing.
          new VersionsModal(plugin, view).open();
        } else {
          view
            .saveSnapshot(`Version ${count + 1}`)
            .then(() => new Notice("Saved new version"))
            .catch((e: unknown) => new Notice(`Could not save version: ${(e as Error).message}`));
        }
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
      const templateSvg = await resolveDrawingTemplateSvg(plugin);
      await plugin.app.vault.modify(file, replaceSvg(content, templateSvg, plugin.settings.compressDrawingData));
    }

    // 3. Reopen — setViewState patch will now route it to SvgView
    const leaf = getActiveLeaf(plugin);
    await leaf.openFile(file, { active: true });
  } catch (e: unknown) {
    new Notice(`Convert failed: ${(e as Error).message}`);
  }
}

/**
 * Append a link to `linkedFile` onto `targetFile`'s `fieldName` frontmatter
 * list, creating the list if needed and skipping duplicates.
 */
async function addFrontmatterLink(
  plugin: SvgPlugin,
  targetFile: TFile,
  fieldName: string,
  linkedFile: TFile,
): Promise<void> {
  const link = plugin.app.fileManager.generateMarkdownLink(linkedFile, targetFile.path);
  await plugin.app.fileManager.processFrontMatter(targetFile, (fm) => {
    if (!Array.isArray(fm[fieldName])) {
      fm[fieldName] = fm[fieldName] != null ? [fm[fieldName], link] : [link];
    } else if (!(fm[fieldName] as string[]).includes(link)) {
      (fm[fieldName] as string[]).push(link);
    }
  });
}

/**
 * Create a new drawing (from the configured template/folder/filename suffix)
 * and, if configured, link it back to `noteFile` two-way: a link to the note
 * on the drawing's frontmatter, and a link to the drawing on the note's
 * frontmatter (as a list, since a note can have more than one drawing) —
 * then open the drawing.
 */
export async function createDrawingForNote(plugin: SvgPlugin, noteFile: TFile): Promise<void> {
  try {
    // noteFile is always the active file here (checkCallback requires it), so
    // it may have an open editor with unsaved changes. If we mutate its
    // frontmatter now but the editor's stale in-memory buffer autosaves
    // afterwards, that save clobbers our change back out. Flush it first so
    // the buffer is clean and Obsidian's own file-changed reload picks up the
    // frontmatter write instead of overwriting it.
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file === noteFile) {
      await activeView.save();
    }

    const baseName = `${noteFile.basename}${plugin.settings.newDrawingSuffix}`;
    // Resolve a name that's free in drawingsFolder before handing it to
    // Templater, rather than only checking uniqueness in the fallback branch
    // below — otherwise a colliding name reliably breaks templates that
    // rename/move the note using it (e.g. via tp.file.move).
    const path = normalizePath(
      uniqueVaultPath(
        (p) => plugin.app.vault.getAbstractFileByPath(normalizePath(p)) != null,
        plugin.settings.drawingsFolder,
        baseName,
        "md",
      ),
    );
    const uniqueName = path.split("/").pop()!.replace(/\.md$/, "");

    let file = await tryCreateDrawingViaTemplater(plugin, plugin.settings.drawingsFolder, uniqueName);
    if (!file) {
      if (plugin.settings.defaultTemplate.trim()) {
        new Notice("Drawing template failed, created a blank drawing instead");
      }
      file = await createDrawingAt(plugin, path);
    }

    // Each direction is independent — a failure linking one side (e.g. the
    // drawing's "Source" field) must not prevent the other (the note's
    // "Drawings" field) from being attempted.
    const drawingFieldName = plugin.settings.newDrawingLinkField.trim();
    if (drawingFieldName) {
      try {
        await addFrontmatterLink(plugin, file, drawingFieldName, noteFile);
      } catch (e: unknown) {
        new Notice(`Could not link drawing back to note: ${(e as Error).message}`);
      }
    }

    const noteFieldName = plugin.settings.noteDrawingsField.trim();
    if (noteFieldName) {
      try {
        await addFrontmatterLink(plugin, noteFile, noteFieldName, file);
      } catch (e: unknown) {
        new Notice(`Could not link note to drawing: ${(e as Error).message}`);
      }
    }

    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
  } catch (e: unknown) {
    new Notice(`Could not create drawing: ${(e as Error).message}`);
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

    const leafId = (leaf as unknown as { id?: string }).id ?? file.path;
    if (view?.getViewType() === VIEW_TYPE_SVG) {
      // Currently in SVG view → switch to markdown.
      // Save first so drawing changes are not lost.
      await (view as SvgView).save();
      // Bypass the redirect patch for this one setViewState call, and mark the
      // leaf as deliberately markdown so the file-open fallback leaves it alone.
      plugin.bypassLeaves.add(leaf);
      plugin.markdownModeLeaves.set(leafId, file.path);
      await leaf.setViewState({ type: "markdown", state: { file: file.path } });
    } else {
      // Currently in markdown view → switch to SVG.
      plugin.markdownModeLeaves.delete(leafId);
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
