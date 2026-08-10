/**
 * The fork's visibility inspector (`Editor.setDebugOverlay`, see
 * ../svgedit's src/editor/Editor.js) is driven from this plugin's existing
 * "Debug logging" setting instead of a second toggle — one flag controls
 * both the timestamped log file and the overlay. Covers:
 *  - the initial state applied once svgEditor.init() resolves (SvgView.ts's
 *    `this.svgEditor.setDebugOverlay?.(...)` call right after init), and
 *  - refreshDebugOverlayFromSettings(), which SettingsTab's toggle calls to
 *    push a live change to every open view without reopening it.
 *
 * Uses the same fake `svgedit-editor` + tests/mocks/obsidian.ts pattern as
 * SvgView-init-race.test.ts (obsidian is types-only, no runtime JS).
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
    };
    debugOverlayCalls: boolean[] = [];

    constructor(_container: HTMLElement) {
      instances.push(this);
    }
    setConfig(): void {}
    async init(): Promise<void> {}
    reloadUserData(): void {}
    async loadFromString(): Promise<void> {}
    setBackground(): void {}
    setDebugOverlay(enabled: boolean): void {
      this.debugOverlayCalls.push(enabled);
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

describe("SvgView debug overlay", () => {
  it("applies the 'Debug logging' setting to the overlay once init resolves", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(true);
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    expect(hoisted.instances).toHaveLength(1);
    expect(hoisted.instances[0].debugOverlayCalls).toEqual([true]);
  });

  it("leaves the overlay off when 'Debug logging' is off", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(false);
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();

    expect(hoisted.instances[0].debugOverlayCalls).toEqual([false]);
  });

  it("refreshDebugOverlayFromSettings() pushes a live change without reopening the view", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin(false);
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    await view.onload();
    expect(hoisted.instances[0].debugOverlayCalls).toEqual([false]);

    plugin.settings.debugLogging = true;
    view.refreshDebugOverlayFromSettings();

    expect(hoisted.instances[0].debugOverlayCalls).toEqual([false, true]);
  });
});
