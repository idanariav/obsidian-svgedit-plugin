/**
 * Regression tests for "New drawing for this file" (src/commands.ts,
 * createDrawingForNote). Two bugs motivated these:
 *
 * 1. noteFile is always the active file (the command requires it). If it has
 *    an open editor with unsaved changes, mutating its frontmatter via
 *    processFrontMatter and then letting the editor's stale buffer autosave
 *    afterward clobbers that write back out — the note's link-back field
 *    silently reverts. Fixed by flushing the active editor first.
 * 2. The raw, unchecked note basename was handed straight to Templater. Any
 *    template that renames/moves the new note using that name (e.g. via
 *    tp.file.move) collides on a second drawing for the same note and the
 *    whole creation fails. Fixed by resolving a name that's free in
 *    drawingsFolder before ever calling Templater.
 *
 * Uses tests/mocks/obsidian.ts (the installed `obsidian` package is
 * types-only, no runtime JS) with a fake App/vault/fileManager/workspace —
 * only what createDrawingForNote's code path touches.
 */

import { describe, it, expect, vi } from "vitest";
import { MarkdownView, TFile } from "obsidian";

// commands.ts imports SvgView, which imports the real 4MB svgedit-editor
// bundle — that bundle touches <canvas> at module-eval time, which jsdom
// can't provide (see tests/view/SvgView-init-race.test.ts for the same
// workaround). Nothing under test here exercises the editor itself.
vi.mock("svgedit-editor", () => ({ default: class {} }));

const { createDrawingForNote } = await import("../../src/commands");

function makeVault() {
  const files = new Map<string, TFile>();
  return {
    files,
    getAbstractFileByPath: (path: string) => files.get(path) ?? null,
    create: vi.fn(async (path: string, _content: string) => {
      const file = new TFile();
      file.path = path;
      file.basename = path.split("/").pop()!.replace(/\.md$/, "");
      files.set(path, file);
      return file;
    }),
    read: vi.fn(async () => ""),
  };
}

function makeFileManager() {
  const frontmatter = new Map<TFile, Record<string, unknown>>();
  return {
    frontmatter,
    generateMarkdownLink: (file: TFile, _sourcePath: string) => `[[${file.basename}]]`,
    processFrontMatter: vi.fn(async (file: TFile, fn: (fm: Record<string, unknown>) => void) => {
      const fm = frontmatter.get(file) ?? {};
      fn(fm);
      frontmatter.set(file, fm);
    }),
  };
}

function makePlugin(overrides: { activeView?: unknown } = {}) {
  const vault = makeVault();
  const fileManager = makeFileManager();
  const openFile = vi.fn(async () => {});
  const app = {
    vault,
    fileManager,
    workspace: {
      getActiveViewOfType: vi.fn(() => overrides.activeView ?? null),
      getLeaf: vi.fn(() => ({ openFile })),
    },
    plugins: undefined as unknown,
  };
  const settings = {
    newDrawingSuffix: "",
    drawingsFolder: "Drawings",
    defaultTemplate: "",
    defaultDrawingTemplate: "",
    newDrawingLinkField: "Source",
    noteDrawingsField: "Drawings",
    compressDrawingData: false,
  };
  return { app, settings, openFile };
}

function noteFile(basename: string): TFile {
  const f = new TFile();
  f.basename = basename;
  f.path = `${basename}.md`;
  return f;
}

describe("createDrawingForNote", () => {
  it("flushes the active editor for noteFile before touching its frontmatter", async () => {
    const note = noteFile("Grit (book)");
    const save = vi.fn(async () => {});
    const activeView = Object.assign(new MarkdownView({} as never), { file: note, save });
    const plugin = makePlugin({ activeView });

    await createDrawingForNote(plugin as any, note);

    expect(save).toHaveBeenCalled();
    // The flush must happen before the note's frontmatter is mutated, not after.
    const saveOrder = save.mock.invocationCallOrder[0];
    const noteWriteOrder = plugin.app.fileManager.processFrontMatter.mock.calls.findIndex(
      (call) => call[0] === note,
    );
    expect(noteWriteOrder).toBeGreaterThanOrEqual(0);
    const noteWriteCallOrder = plugin.app.fileManager.processFrontMatter.mock.invocationCallOrder[noteWriteOrder];
    expect(saveOrder).toBeLessThan(noteWriteCallOrder);
  });

  it("does not flush the editor when the active view is showing a different file", async () => {
    const note = noteFile("Grit (book)");
    const other = noteFile("Some other note");
    const save = vi.fn(async () => {});
    const activeView = Object.assign(new MarkdownView({} as never), { file: other, save });
    const plugin = makePlugin({ activeView });

    await createDrawingForNote(plugin as any, note);

    expect(save).not.toHaveBeenCalled();
  });

  it("resolves a free name before calling Templater, so a colliding basename doesn't reach it", async () => {
    const note = noteFile("Grit (book)");
    const plugin = makePlugin();
    // Simulate a drawing already at "Drawings/Grit (book).md" from a prior run.
    plugin.app.vault.files.set("Drawings/Grit (book).md", new TFile());

    const createFromTemplate = vi.fn(async (_t: unknown, _folder: string, filename: string) => {
      const file = new TFile();
      file.basename = filename;
      file.path = `Drawings/${filename}.md`;
      return file;
    });
    plugin.settings.defaultTemplate = "Templates/sketch.md";
    plugin.app.vault.files.set("Templates/sketch.md", new TFile());
    plugin.app.plugins = {
      plugins: { "templater-obsidian": { templater: { create_new_note_from_template: createFromTemplate } } },
    };

    await createDrawingForNote(plugin as any, note);

    expect(createFromTemplate).toHaveBeenCalledTimes(1);
    const [, , filename] = createFromTemplate.mock.calls[0];
    expect(filename).toBe("Grit (book) 1");
  });

  it("still links the note even if linking the drawing back to the note fails", async () => {
    const note = noteFile("Grit (book)");
    const plugin = makePlugin();

    plugin.app.fileManager.processFrontMatter.mockImplementation(async (file: TFile) => {
      if (file !== note) throw new Error("boom");
    });

    await createDrawingForNote(plugin as any, note);

    // Both directions were attempted despite the drawing-side write throwing.
    expect(plugin.app.fileManager.processFrontMatter).toHaveBeenCalledWith(note, expect.any(Function));
    // The command still completes and opens the drawing rather than aborting.
    expect(plugin.openFile).toHaveBeenCalled();
  });
});
