/**
 * Discrete tool/mode-change logging (SvgView.ts's `modeChange` listener,
 * added alongside the existing generic "svg-changed" logging). See
 * ../svgedit's svgcanvas.js: setMode() dispatches the same reused
 * `modeEvent` CustomEvent on `document` for every mode change, so a listener
 * must filter by identity to avoid attributing one open drawing's tool
 * changes to a different one's log.
 *
 * Uses the same fake `svgedit-editor` + tests/mocks/obsidian.ts pattern as
 * SvgView-debug-logger.test.ts.
 */

import { describe, it, expect, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const instances: FakeSvgEditor[] = [];

  class FakeSvgEditor {
    configObj = { pref: () => undefined };
    svgCanvas = {
      getSvgString: () => "",
      svgCanvasToString: () => "",
      getSvgOption: () => ({}) as { apply?: boolean },
      setSvgOption: () => {},
      bind: () => undefined,
      modeEvent: new CustomEvent("modeChange"),
      mode: "select",
      toolLocked: false,
      getMode(): string {
        return this.mode;
      },
      getToolLocked(): boolean {
        return this.toolLocked;
      },
    };

    constructor(_container: HTMLElement) {
      instances.push(this);
    }
    setConfig(): void {}
    async init(): Promise<void> {}
    reloadUserData(): void {}
    async loadFromString(): Promise<void> {}
    setBackground(): void {}
  }

  return { FakeSvgEditor, instances };
});

vi.mock("svgedit-editor", () => ({ default: hoisted.FakeSvgEditor }));

const { SvgView } = await import("../../src/view/SvgView");

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
      debugLogging: true,
    },
    debugLog: { log: vi.fn() },
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
    metadataCache: {},
  };
}

describe("SvgView mode-change logging", () => {
  it("logs a mode-change line with from/to/locked on a real transition", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin();
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    const editor = hoisted.instances[0];
    editor.svgCanvas.mode = "pathedit";
    editor.svgCanvas.toolLocked = true;
    document.dispatchEvent(editor.svgCanvas.modeEvent);

    const calls = plugin.debugLog.log.mock.calls.filter(([event]) => event === "mode-change");
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ from: null, to: "pathedit", locked: true });
  });

  it("does not log a redundant dispatch that leaves the mode unchanged", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin();
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    const editor = hoisted.instances[0];
    editor.svgCanvas.mode = "path";
    document.dispatchEvent(editor.svgCanvas.modeEvent);
    // setMode() dispatches unconditionally even when the mode string doesn't
    // actually change (e.g. a locked tool re-arming itself to the same mode).
    document.dispatchEvent(editor.svgCanvas.modeEvent);

    const calls = plugin.debugLog.log.mock.calls.filter(([event]) => event === "mode-change");
    expect(calls).toHaveLength(1);
  });

  it("ignores a modeChange dispatch from a different open editor instance", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin();

    const viewA = new SvgView({ app } as any, plugin as any);
    await viewA.onload();
    const viewB = new SvgView({ app } as any, plugin as any);
    await viewB.onload();

    expect(hoisted.instances).toHaveLength(2);
    const [editorA, editorB] = hoisted.instances;

    editorB.svgCanvas.mode = "rect";
    document.dispatchEvent(editorB.svgCanvas.modeEvent);

    // Only B's own file path should appear in a mode-change log entry.
    const modeChangeCalls = plugin.debugLog.log.mock.calls.filter(
      ([event]) => event === "mode-change",
    );
    expect(modeChangeCalls).toHaveLength(1);
    expect(editorA.svgCanvas.mode).toBe("select"); // untouched
  });
});
