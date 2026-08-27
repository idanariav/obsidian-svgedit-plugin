/**
 * Regression test for the cross-instance id-collision family
 * ([[parallel-drawing-fill-bug]], [[paste-cross-instance-id-collision]]):
 * Obsidian can mount several SvgView/svgedit instances into the same
 * document at once (split panes), and SVG paint references (url(#id),
 * href="#id") resolve document-wide, not per-editor-instance. svgedit's own
 * test suite only ever drives one editor per document, so a same-document,
 * two-instance collision is invisible there — it only shows up once two
 * SvgView instances are actually open together, which is what this test
 * drives end-to-end through setViewData (getCanvasBg -> migrations ->
 * refreshLockedEmbeds -> namespaceSvgIds), not just the isolated function
 * (see tests/data/SvgData.test.ts for that unit-level coverage).
 *
 * Uses the same fake-editor/fake-obsidian harness as
 * tests/view/SvgView-init-race.test.ts.
 */

import { describe, it, expect, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  class FakeSvgEditor {
    loadedSvgCalls: string[] = [];
    backgroundCalls: string[] = [];
    currentSvg = "";
    configObj = { pref: () => undefined };
    svgCanvas = {
      getSvgString: () => this.currentSvg,
      svgCanvasToString: () => this.currentSvg,
      getSvgOption: () => ({}) as { apply?: boolean },
      setSvgOption: () => {},
      bind: () => undefined,
    };
    destroyCalls = 0;
    constructor(_container: HTMLElement) {}
    setConfig(): void {}
    async init(): Promise<void> {}
    reloadUserData(): void {}
    async loadFromString(svg: string): Promise<void> {
      this.loadedSvgCalls.push(svg);
      this.currentSvg = svg;
    }
    setBackground(color: string): void {
      this.backgroundCalls.push(color);
    }
    destroy(): void {
      this.destroyCalls++;
    }
  }

  return { FakeSvgEditor };
});

// "obsidian" is aliased to tests/mocks/obsidian.ts in vitest.config.mts (the
// installed package is types-only, no runtime JS to load here).
vi.mock("svgedit-editor", () => ({ default: hoisted.FakeSvgEditor }));

const { SvgView } = await import("../../src/view/SvgView");

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeFakePlugin() {
  return {
    manifest: { version: "1.0.0" },
    settings: {
      editorTheme: "light",
      uiModeMobile: "standard",
      uiModeDesktop: "standard",
      autosaveSeconds: 0,
      compressDrawingData: false,
      paletteOverrides: {},
      userShapes: {},
      hotkeyOverrides: {},
      favorites: [],
      classLibrary: [],
      canvasPresets: [],
      canvasLayouts: [],
      fontsFolder: "",
    },
    saveSettings: vi.fn(async () => {}),
    reloadUserDataInAllViews: vi.fn(),
  };
}

function makeFakeApp() {
  return {
    workspace: {
      on: vi.fn(() => ({})),
      getActiveViewOfType: vi.fn(() => null),
    },
    scope: undefined,
    vault: {},
    metadataCache: { getFirstLinkpathDest: vi.fn(() => null) },
  };
}

async function openDrawing(path: string, fileContent: string) {
  const app = makeFakeApp();
  const plugin = makeFakePlugin();
  const leaf = { app };
  const view = new SvgView(leaf as any, plugin as any);
  await view.onload();
  await flushMicrotasks(); // let svgEditor.init() resolve
  (view as any).file = { path, basename: path.split("/").pop() };
  await view.setViewData(fileContent, false);
  return { view, editor: (view as any).svgEditor as InstanceType<typeof hoisted.FakeSvgEditor> };
}

function idsOf(svg: string): string[] {
  return Array.from(svg.matchAll(/ id="([^"]+)"/g)).map((m) => m[1]);
}

function drawingFile(svg: string): string {
  return `---\nplugin: svg-drawing\n---\n\n## Drawing\n\`\`\`svg\n${svg}\n\`\`\`\n%%\n`;
}

describe("SvgView multi-instance id namespacing", () => {
  it("gives two panes opened from the SAME template content non-colliding ids on the live canvas", async () => {
    // Both notes were created from one template, so the markdown each loads
    // is byte-identical (same baked ids, same-or-absent se:nonce) — the exact
    // shape of the "New drawing from template" scenario that produced Bug A2.
    const templateSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="svg_2"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect id="svg_1" width="10" height="10" fill="url(#svg_2)"/></svg>';
    const fileContent = drawingFile(templateSvg);

    const [{ editor: editorA }, { editor: editorB }] = await Promise.all([
      openDrawing("Drawings/Note A.md", fileContent),
      openDrawing("Drawings/Note B.md", fileContent),
    ]);

    const svgA = editorA.loadedSvgCalls.at(-1)!;
    const svgB = editorB.loadedSvgCalls.at(-1)!;
    const [idsA, idsB] = [idsOf(svgA), idsOf(svgB)];

    expect(idsA).toHaveLength(2);
    for (const id of idsA) expect(idsB).not.toContain(id);

    // The paint reference must follow the renamed id on each pane, not just
    // the ids themselves — otherwise the rewritten gradient id would be
    // unreferenced and the rect would render with no fill.
    const gradIdA = /<linearGradient id="([^"]+)"/.exec(svgA)![1];
    expect(svgA).toContain(`fill="url(#${gradIdA})"`);
  });

  it("reloading the same file twice keeps the same ids (namespacing is stable, not re-randomized)", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="svg_1" width="10" height="10"/></svg>';
    const { editor: firstEditor } = await openDrawing("Drawings/A.md", drawingFile(svg));
    const firstLoad = firstEditor.loadedSvgCalls.at(-1)!;

    // Simulate Obsidian reopening the file (a fresh SvgView, same path) with
    // the content it just saved — the saved SVG already carries this file's
    // se:nonce, so namespaceSvgIds must be a no-op rather than re-randomizing.
    const { editor: secondEditor } = await openDrawing("Drawings/A.md", drawingFile(firstLoad));
    const secondLoad = secondEditor.loadedSvgCalls.at(-1)!;

    expect(idsOf(secondLoad)).toEqual(idsOf(firstLoad));
  });

  // Defense-in-depth for [[background-color-localstorage-bleed]]: svgedit
  // persists bkgd_color to the shared window.localStorage, so a freshly
  // constructed editor instance is not reliably white-by-default — it can
  // inherit whatever color a DIFFERENT drawing (opened earlier, same
  // Electron origin) left behind. A drawing with no stamped background must
  // still have white asserted explicitly on load rather than trusting the
  // editor's own initial state.
  it("always asserts a background on load, even for a drawing with none stamped", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="svg_1" width="10" height="10"/></svg>';
    const { editor } = await openDrawing("Drawings/A.md", drawingFile(svg));

    expect(editor.backgroundCalls).toContain("#ffffff");
  });
});

// Regression test for the "keyboard copy/paste silently does nothing until I
// click something" report: svgedit's domScope.js routes document-level
// shortcuts/paste only to whichever mounted instance last claimed
// "active" (see isActiveEditor there). That claim used to only get released
// from onunload() -- which Obsidian's per-leaf close path (tab closed, pane
// merged) isn't guaranteed to invoke, only full plugin/component teardown
// reliably is. A drawing closed via a plain tab-close could keep squatting
// the claim, silently blocking Ctrl+C/Ctrl+V on every *other* open drawing
// until the user clicked inside the stale one again (which nobody would
// think to do, since they'd already closed it). onClose() now releases the
// same teardown onunload() does, so a normal tab-close reliably calls
// svgEditor.destroy() (which clears the active-editor claim on the svgedit
// side) without needing to wait for -- or depend on -- onunload() at all.
describe("SvgView leaf-close teardown", () => {
  const oneRectSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="svg_1" width="10" height="10"/></svg>';

  it("onClose() destroys the editor (releasing svgedit's active-editor claim), same as onunload() already does", async () => {
    const { view, editor } = await openDrawing("Drawings/A.md", drawingFile(oneRectSvg));

    await view.onClose();

    expect(editor.destroyCalls).toBe(1);
    expect((view as any).svgEditor).toBeNull();
  });

  it("destroys exactly once even if both onClose() and onunload() end up firing for the same teardown", async () => {
    const { view, editor } = await openDrawing("Drawings/A.md", drawingFile(oneRectSvg));

    await view.onClose();
    await view.onunload();

    expect(editor.destroyCalls).toBe(1);
  });
});
