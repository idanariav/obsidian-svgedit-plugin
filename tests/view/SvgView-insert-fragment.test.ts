/**
 * SvgView.insertSvgFragment must be an incremental, undoable canvas edit
 * (svgCanvas.insertSvgFragment in the svgedit fork), not a serialize + append
 * + loadFromString round trip: a reload resets the user's selection / group
 * context / zoom and — since loadFromString now resets the undo stack — would
 * also wipe their undo history.
 *
 * Same fake `svgedit-editor` pattern as SvgView-debug-logger.test.ts.
 */

import { describe, it, expect, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const instances: FakeSvgEditor[] = [];

  class FakeSvgEditor {
    configObj = { pref: () => undefined };
    insertSvgFragment = vi.fn((_xml: string): unknown[] | null => [{}]);
    loadFromString = vi.fn(async () => {});
    svgCanvas = {
      getSvgString: () => "",
      svgCanvasToString: () => "",
      getSvgOption: () => ({}) as { apply?: boolean },
      setSvgOption: () => {},
      bind: () => undefined,
      insertSvgFragment: (xml: string) => this.insertSvgFragment(xml),
    };

    constructor(_container: HTMLElement) {
      instances.push(this);
    }
    setConfig(): void {}
    async init(): Promise<void> {}
    reloadUserData(): void {}
    setBackground(): void {}
    setDebugLogger(): void {}
  }

  return { FakeSvgEditor, instances };
});

vi.mock("svgedit-editor", () => ({ default: hoisted.FakeSvgEditor }));

const { SvgView } = await import("../../src/view/SvgView");

function makePlugin() {
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
      debugLogging: false,
    },
    debugLog: { log: vi.fn() },
    saveSettings: vi.fn(async () => {}),
    reloadUserDataInAllViews: vi.fn(),
  };
}

async function openView() {
  hoisted.instances.length = 0;
  const app = {
    workspace: { on: vi.fn(() => ({})), getActiveViewOfType: vi.fn(() => null) },
    scope: undefined,
    vault: {},
    metadataCache: {},
  };
  const view = new SvgView({ app } as any, makePlugin() as any);
  await view.onload();
  const save = vi.spyOn(view, "save").mockResolvedValue(undefined);
  return { view, editor: hoisted.instances[0], save };
}

describe("SvgView.insertSvgFragment", () => {
  it("inserts through the canvas API, never reloading the document, then saves", async () => {
    const { view, editor, save } = await openView();
    const fragment = `<text x="50" y="80">[[note]]</text>`;

    await view.insertSvgFragment(fragment);

    expect(editor.insertSvgFragment).toHaveBeenCalledWith(fragment);
    expect(editor.loadFromString).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("throws (so the modal shows 'Insert failed') and does not save when the canvas rejects the markup", async () => {
    const { view, editor, save } = await openView();
    editor.insertSvgFragment.mockReturnValueOnce(null);

    await expect(view.insertSvgFragment("<rect")).rejects.toThrow(/could not be inserted/);

    expect(editor.loadFromString).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
