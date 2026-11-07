import { App, TFile } from "obsidian";
import type SvgPlugin from "./main";
import { MAX_DRAWING_SNAPSHOTS, VIEW_TYPE_SVG } from "./constants";
import {
  extractSvg,
  replaceSvg,
  reconcileLinkedFiles,
  extractSnapshots,
  replaceSnapshots,
  genSnapshotId,
  getCanvasBg,
  setCanvasBg,
  getDrawingVersion,
  setDrawingVersion,
} from "./data/SvgData";
import type { DrawingSnapshot } from "./data/SvgData";
import { runMigrations } from "./data/migrations";
import { resolveEffectiveSettings } from "./data/frontmatter";
import { autoExport } from "./export/exporter";
import { SvgView } from "./view/SvgView";

/**
 * Headless drawing access for scripts and agents, reached through
 * `app.plugins.plugins["obsidian-svg-plugin"].api` (e.g. via `obsidian eval`).
 * Works on the drawing file, not a live editor, so nothing needs to be open.
 */
export interface SketchEditorApi {
  /** The drawing's stored SVG (as saved, bookkeeping attributes included), or null. */
  readDrawing(path: string): Promise<string | null>;
  /**
   * Replace the drawing's SVG and run the file's auto-export, like an editor save.
   * `snapshot` first saves the current drawing as a named version (replacing a
   * version of the same name; throws when the versions list is full).
   */
  writeDrawing(path: string, svg: string, opts?: { snapshot?: string }): Promise<void>;
  /**
   * Save `svg` as a named version without touching the live drawing or its
   * exports (replacing a version of the same name; throws when the list is full).
   */
  saveVersion(path: string, name: string, svg: string): Promise<void>;
  /** Run the file's auto-export (companions and frames, per its resolved settings). */
  exportDrawing(path: string): Promise<void>;
}

export function createApi(plugin: SvgPlugin): SketchEditorApi {
  const app = plugin.app;

  const api: SketchEditorApi = {
    async readDrawing(path) {
      return extractSvg(await app.vault.read(drawingFile(app, path)));
    },

    async writeDrawing(path, svg, opts = {}) {
      const file = drawingFile(app, path);
      await modifyDrawing(file, (content) => {
        const current = extractSvg(content);
        let snapshots = extractSnapshots(content);
        if (opts.snapshot && current) snapshots = upsertSnapshot(file, snapshots, opts.snapshot, current);
        const stamped = stamp(svg, current);
        const compress = plugin.settings.compressDrawingData;
        return replaceSnapshots(reconcileLinkedFiles(replaceSvg(content, stamped, compress), stamped), snapshots, compress);
      });
      await api.exportDrawing(file.path);
    },

    async saveVersion(path, name, svg) {
      const file = drawingFile(app, path);
      await modifyDrawing(file, (content) => {
        const snapshots = upsertSnapshot(file, extractSnapshots(content), name, stamp(svg, extractSvg(content)));
        return replaceSnapshots(content, snapshots, plugin.settings.compressDrawingData);
      });
    },

    async exportDrawing(path) {
      const file = drawingFile(app, path);
      const stored = extractSvg(await app.vault.read(file));
      if (!stored) throw new Error(`No drawing in "${file.path}"`);
      const bg = getCanvasBg(stored);
      const svg = setDrawingVersion(runMigrations(setCanvasBg(stored, null), getDrawingVersion(stored)), null);
      const effective = resolveEffectiveSettings(app, file, plugin.settings);
      await autoExport(app, file, svg, plugin.settings, effective, bg ?? "#ffffff", () => plugin.saveSettings());
    },
  };
  // Stamp the running version (so no migration re-runs on the new SVG) and
  // carry over the canvas background unless the new SVG sets its own.
  function stamp(svg: string, current: string | null): string {
    const stamped = setDrawingVersion(svg, plugin.manifest.version);
    return getCanvasBg(stamped) === null && current ? setCanvasBg(stamped, getCanvasBg(current)) : stamped;
  }

  // Flush an open editor first, so its unsaved edits aren't lost; it is
  // reloaded with the new content afterwards, since an open view doesn't pick
  // up an external modify and would write its stale canvas back on close.
  async function modifyDrawing(file: TFile, edit: (content: string) => string): Promise<void> {
    const open = app.workspace.getLeavesOfType(VIEW_TYPE_SVG)
      .map((leaf) => leaf.view)
      .filter((v): v is SvgView => v instanceof SvgView && v.file?.path === file.path);
    for (const view of open) await view.save();
    const next = edit(await app.vault.read(file));
    await app.vault.modify(file, next);
    for (const view of open) {
      view.data = next;
      await view.setViewData(next, false);
    }
  }

  return api;
}

/** Add `svg` as version `name`, replacing a same-name version in place; throws when the list is full. */
function upsertSnapshot(file: TFile, snapshots: DrawingSnapshot[], name: string, svg: string): DrawingSnapshot[] {
  const snap = { id: genSnapshotId(), name, createdAt: new Date().toISOString(), svg };
  const idx = snapshots.findIndex((s) => s.name === name);
  if (idx >= 0) return snapshots.map((s, i) => (i === idx ? { ...snap, id: s.id } : s));
  if (snapshots.length >= MAX_DRAWING_SNAPSHOTS) throw new Error(`"${file.path}" already has ${MAX_DRAWING_SNAPSHOTS} versions; delete one first`);
  return [...snapshots, snap];
}

function drawingFile(app: App, path: string): TFile {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error(`No file at "${path}"`);
  return file;
}
