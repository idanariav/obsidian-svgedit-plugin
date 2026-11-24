/**
 * The plugin marks a drawing dirty on svgedit's `documentChanged` (one event per
 * real change: a step, an undo / redo, an edit outside the history), not on its
 * `changed` UI-refresh event, which also fired for drags that went nowhere and
 * marked untouched drawings dirty (debug log 2026-11-24). Same fake-editor
 * harness as SvgView-mode-log.test.ts.
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
      handlers: {} as Record<string, Array<(win: unknown, detail: unknown) => void>>,
      bind(ev: string, f: (win: unknown, detail: unknown) => void): void {
        (this.handlers[ev] ??= []).push(f);
      },
      fire(ev: string, detail?: unknown): void {
        for (const f of this.handlers[ev] ?? []) f(window, detail);
      },
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

describe("SvgView dirty flag", () => {
  const open = async () => {
    hoisted.instances.length = 0;
    const plugin = makeFakePlugin();
    const view = new SvgView({ app: makeFakeApp() } as any, plugin as any);
    await view.onload();
    return { view: view as any, editor: hoisted.instances[0], plugin };
  };

  it("a documentChanged marks the drawing dirty and logs its cause", async () => {
    const { view, editor, plugin } = await open();
    expect(view.svgDirty).toBe(false);
    editor.svgCanvas.fire("documentChanged", { cause: "step" });
    expect(view.svgDirty).toBe(true);
    const logged = plugin.debugLog.log.mock.calls.filter(([event]) => event === "svg-changed");
    expect(logged).toHaveLength(1);
    expect(logged[0][1]).toMatchObject({ cause: "step" });
  });

  it("a `changed` UI refresh alone does not mark the drawing dirty", async () => {
    const { view, editor } = await open();
    editor.svgCanvas.fire("changed", []);
    expect(view.svgDirty).toBe(false);
  });
});
