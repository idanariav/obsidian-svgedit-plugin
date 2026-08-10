/**
 * Regression test: right-clicking an open drawing's tab and choosing
 * "Delete file" left the drawing open and unresponsive. Obsidian doesn't
 * reliably detach a custom TextFileView's leaf on its own when the backing
 * file disappears (notably via the tab's own context-menu delete), so
 * fileSync.ts's vault "delete" handler now closes any open leaf showing the
 * deleted file itself. That must happen unconditionally — it's basic view
 * lifecycle hygiene, not the "keep companion .svg/.png files in sync"
 * preference (`settings.keepInSync`), which the rest of the delete handler
 * (untouched here) is gated on.
 */

import { describe, it, expect, vi } from "vitest";
import { TFile } from "obsidian";
import { registerFileSyncHandlers } from "../src/fileSync";

function makeFakePlugin(keepInSync: boolean, leaves: unknown[]) {
  const vaultHandlers: Record<string, (...args: unknown[]) => unknown> = {};
  const plugin = {
    settings: { keepInSync },
    svgDrawingPaths: new Set<string>(),
    registerEvent: vi.fn(),
    app: {
      metadataCache: {
        on: vi.fn(() => ({})),
        getFileCache: vi.fn(() => undefined),
      },
      vault: {
        on: vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
          vaultHandlers[event] = cb;
          return {};
        }),
        getAbstractFileByPath: vi.fn(() => null),
      },
      workspace: {
        getLeavesOfType: vi.fn(() => leaves),
      },
    },
  };
  return { plugin, vaultHandlers };
}

function makeLeaf(path: string) {
  const view = { file: { path }, markFileDeleted: vi.fn() };
  const leaf = { view, detach: vi.fn() };
  return leaf;
}

function deletedFile(path: string): TFile {
  return Object.assign(new TFile(), { path });
}

describe("fileSync: closing the tab of a deleted drawing", () => {
  it("detaches the leaf showing the deleted file, even with keepInSync off (the default)", () => {
    const matching = makeLeaf("Drawing.md");
    const other = makeLeaf("Other.md");
    const { plugin, vaultHandlers } = makeFakePlugin(false, [matching, other]);

    registerFileSyncHandlers(plugin as any);
    vaultHandlers.delete(deletedFile("Drawing.md"));

    expect(matching.view.markFileDeleted).toHaveBeenCalledOnce();
    expect(matching.detach).toHaveBeenCalledOnce();
    expect(other.view.markFileDeleted).not.toHaveBeenCalled();
    expect(other.detach).not.toHaveBeenCalled();
  });

  it("also detaches with keepInSync on -- closing the tab is not the companion-file-sync preference", () => {
    const matching = makeLeaf("Drawing.md");
    const { plugin, vaultHandlers } = makeFakePlugin(true, [matching]);

    registerFileSyncHandlers(plugin as any);
    vaultHandlers.delete(deletedFile("Drawing.md"));

    expect(matching.detach).toHaveBeenCalledOnce();
  });

  it("marks the view's file deleted before detaching, so unload doesn't try to save it", () => {
    const matching = makeLeaf("Drawing.md");
    const { plugin, vaultHandlers } = makeFakePlugin(false, [matching]);
    const order: string[] = [];
    matching.view.markFileDeleted.mockImplementation(() => order.push("markFileDeleted"));
    matching.detach.mockImplementation(() => order.push("detach"));

    registerFileSyncHandlers(plugin as any);
    vaultHandlers.delete(deletedFile("Drawing.md"));

    expect(order).toEqual(["markFileDeleted", "detach"]);
  });

  it("leaves unrelated open drawings alone when a different file is deleted", () => {
    const other = makeLeaf("Other.md");
    const { plugin, vaultHandlers } = makeFakePlugin(false, [other]);

    registerFileSyncHandlers(plugin as any);
    vaultHandlers.delete(deletedFile("Drawing.md"));

    expect(other.detach).not.toHaveBeenCalled();
  });
});
