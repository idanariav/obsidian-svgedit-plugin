/**
 * The fork's debug-snapshot logger (`Editor.setDebugLogger`, see
 * ../svgedit's src/editor/Editor.js) is driven from this plugin's existing
 * "Debug logging" setting instead of a second toggle — one flag controls
 * both the timestamped log file and whether svgedit's desync snapshots are
 * forwarded into it (as "debug-snapshot" lines, via SvgView's `log()`
 * helper). Covers:
 *  - the initial state applied once svgEditor.init() resolves (SvgView.ts's
 *    `this.svgEditor.setDebugLogger?.(...)` call right after init),
 *  - refreshDebugLoggerFromSettings(), which SettingsTab's toggle calls to
 *    push a live change to every open view without reopening it, and
 *  - that a snapshot handed to the sink actually reaches plugin.debugLog.
 *
 * Uses the same fake `svgedit-editor` + tests/mocks/obsidian.ts pattern as
 * SvgView-init-race.test.ts (obsidian is types-only, no runtime JS).
 */

import { describe, it, expect, vi } from "vitest";

type DebugSink = ((event: string, detail?: Record<string, unknown>) => void) | null;

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
    };
    debugLoggerSinks: DebugSink[] = [];

    constructor(_container: HTMLElement) {
      instances.push(this);
    }
    setConfig(): void {}
    async init(): Promise<void> {}
    reloadUserData(): void {}
    async loadFromString(): Promise<void> {}
    setBackground(): void {}
    setDebugLogger(sink: DebugSink): void {
      this.debugLoggerSinks.push(sink);
    }
  }

  return { FakeSvgEditor, instances };
});

vi.mock("svgedit-editor", () => ({ default: hoisted.FakeSvgEditor }));

const { SvgView } = await import("../../src/view/SvgView");

function makeFakePlugin(debugLogging: boolean) {
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
      debugLogging,
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

describe("SvgView debug logger", () => {
  it("passes a sink to setDebugLogger once init resolves when 'Debug logging' is on", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(true);
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    expect(hoisted.instances).toHaveLength(1);
    expect(hoisted.instances[0].debugLoggerSinks).toEqual([expect.any(Function)]);
  });

  it("passes null when 'Debug logging' is off", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(false);
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    expect(hoisted.instances[0].debugLoggerSinks).toEqual([null]);
  });

  it("refreshDebugLoggerFromSettings() pushes a live change without reopening the view", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(false);
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();
    expect(hoisted.instances[0].debugLoggerSinks).toEqual([null]);

    plugin.settings.debugLogging = true;
    view.refreshDebugLoggerFromSettings();

    expect(hoisted.instances[0].debugLoggerSinks).toEqual([null, expect.any(Function)]);
  });

  it("forwards a snapshot handed to the sink into plugin.debugLog", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(true);
    const leaf = { app, path: "drawings/foo.svg" };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    const sink = hoisted.instances[0].debugLoggerSinks[0];
    const snapshot = { selection: { selectedIds: ["rect1"], selectors: [] } };
    sink?.("debug-snapshot", snapshot);

    expect(plugin.debugLog.log).toHaveBeenCalledWith(
      "debug-snapshot",
      expect.objectContaining(snapshot),
    );
  });
});
