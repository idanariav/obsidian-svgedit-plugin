/**
 * Coverage for the setViewState redirect logic itself (installViewStatePatch),
 * flagged as untested in .claude/techdebt.md: bypass-leaf handling, same-file
 * mode changes vs. new-file opens, and the markdown-mode-leaves override.
 *
 * Uses tests/mocks/obsidian.ts's WorkspaceLeaf stand-in — real monkey-around
 * `around()` patches WorkspaceLeaf.prototype, so leaves here are real
 * instances of that mock class, not plain objects. Each test first replaces
 * WorkspaceLeaf.prototype.setViewState with a vi.fn() spy and only then
 * installs the patch, so `around()` wraps *that* spy as its "next" — letting
 * assertions see exactly what state the patch decided to pass through.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkspaceLeaf, TFile } from "../mocks/obsidian";
import { installViewStatePatch } from "../../src/postprocessor/setViewStatePatch";
import { VIEW_TYPE_SVG } from "../../src/constants";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { FRONTMATTER_KEY_PLUGIN, FRONTMATTER_PLUGIN_VALUE } from "../../src/constants";

const DRAWING_PATH = "drawing.md";
const PLAIN_PATH = "note.md";

function makeApp(drawingPaths: Set<string>) {
  const files = new Map<string, TFile>();
  for (const p of [DRAWING_PATH, PLAIN_PATH]) {
    const f = new TFile();
    f.path = p;
    files.set(p, f);
  }
  return {
    vault: {
      getAbstractFileByPath: (p: string) => files.get(p) ?? null,
    },
    metadataCache: {
      getFileCache: (f: TFile) =>
        drawingPaths.has(f.path)
          ? { frontmatter: { [FRONTMATTER_KEY_PLUGIN]: FRONTMATTER_PLUGIN_VALUE } }
          : { frontmatter: {} },
    },
  };
}

describe("installViewStatePatch", () => {
  let markdownModeLeaves: Map<string, string>;
  let bypassLeaves: Set<WorkspaceLeaf>;
  let uninstall: () => void;
  let isLoaded: boolean;
  let settings: typeof DEFAULT_SETTINGS;
  let nextSetViewState: ReturnType<typeof vi.fn>;
  let nextDetach: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    markdownModeLeaves = new Map();
    bypassLeaves = new Set();
    isLoaded = true;
    settings = { ...DEFAULT_SETTINGS };
    const app = makeApp(new Set([DRAWING_PATH]));

    nextSetViewState = vi.fn(async () => {});
    nextDetach = vi.fn();
    WorkspaceLeaf.prototype.setViewState = nextSetViewState as any;
    WorkspaceLeaf.prototype.detach = nextDetach as any;

    uninstall = installViewStatePatch(
      app as any,
      () => isLoaded,
      bypassLeaves as any,
      () => settings,
      markdownModeLeaves,
    );
  });

  afterEach(() => {
    uninstall();
  });

  it("redirects a new open of a drawing file to the SVG view", async () => {
    const leaf = new WorkspaceLeaf();
    const state = { type: "markdown", state: { file: DRAWING_PATH } };

    await leaf.setViewState(state as any, "eState");

    expect(nextSetViewState).toHaveBeenCalledTimes(1);
    const [passedState, passedEState] = nextSetViewState.mock.calls[0];
    expect(passedState.type).toBe(VIEW_TYPE_SVG);
    expect(passedEState).toBe("eState");
  });

  it("leaves a plain (non-drawing) markdown file alone", async () => {
    const leaf = new WorkspaceLeaf();
    const state = { type: "markdown", state: { file: PLAIN_PATH } };

    await leaf.setViewState(state as any);

    expect(nextSetViewState).toHaveBeenCalledWith(state, undefined);
  });

  it("bypasses the redirect exactly once when the leaf is in bypassLeaves", async () => {
    const leaf = new WorkspaceLeaf();
    bypassLeaves.add(leaf);
    const state = { type: "markdown", state: { file: DRAWING_PATH } };

    await leaf.setViewState(state as any);
    expect(nextSetViewState).toHaveBeenCalledWith(state, undefined);
    expect(bypassLeaves.has(leaf)).toBe(false); // consumed after one call

    // A second call on the same leaf is no longer bypassed.
    await leaf.setViewState(state as any);
    expect(nextSetViewState.mock.calls[1][0].type).toBe(VIEW_TYPE_SVG);
  });

  it("treats a mode change on an already-open markdown view of the SAME file as a passthrough, not a redirect", async () => {
    const leaf = new WorkspaceLeaf();
    const file = new TFile();
    file.path = DRAWING_PATH;
    leaf.view = { getViewType: () => "markdown", file };

    const state = { type: "markdown", state: { file: DRAWING_PATH } };
    await leaf.setViewState(state as any);

    // Same-file mode change (source/live-preview/reading toggle) must go
    // through untouched, not get rewritten to VIEW_TYPE_SVG.
    expect(nextSetViewState).toHaveBeenCalledWith(state, undefined);
  });

  it("still redirects when the leaf's current markdown view is a DIFFERENT file", async () => {
    const leaf = new WorkspaceLeaf();
    const otherFile = new TFile();
    otherFile.path = PLAIN_PATH;
    leaf.view = { getViewType: () => "markdown", file: otherFile };

    await leaf.setViewState({ type: "markdown", state: { file: DRAWING_PATH } } as any);

    expect(nextSetViewState.mock.calls[0][0].type).toBe(VIEW_TYPE_SVG);
  });

  it("respects an effective openAsMarkdown setting and does not redirect", async () => {
    settings.openAsMarkdown = true; // global default: open drawings as markdown
    const leaf = new WorkspaceLeaf();

    await leaf.setViewState({ type: "markdown", state: { file: DRAWING_PATH } } as any);

    expect(nextSetViewState.mock.calls[0][0].type).toBe("markdown");
  });

  it("does not redirect while the plugin is not loaded (shutdown window)", async () => {
    isLoaded = false;
    const leaf = new WorkspaceLeaf();

    await leaf.setViewState({ type: "markdown", state: { file: DRAWING_PATH } } as any);

    expect(nextSetViewState.mock.calls[0][0].type).toBe("markdown");
  });

  it("drops a closed leaf's markdownModeLeaves entry on detach", () => {
    const leaf = new WorkspaceLeaf();
    leaf.id = "leaf-1";
    markdownModeLeaves.set("leaf-1", DRAWING_PATH);

    leaf.detach();

    expect(markdownModeLeaves.has("leaf-1")).toBe(false);
    expect(nextDetach).toHaveBeenCalledTimes(1);
  });
});
