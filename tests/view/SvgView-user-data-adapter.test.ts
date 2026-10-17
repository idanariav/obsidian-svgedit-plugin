/**
 * The userDataAdapter SvgView hands svgedit must implement both halves of every pair the editor uses.
 * svgedit does not fall back to localStorage once an adapter is registered: a missing `setDefaultClasses`
 * silently drops the "default class for new objects" choice (and `getDefaultClasses` reads as empty), so the
 * default never applies. This pins the per-type default classes to `settings.defaultClasses` (data.json).
 */

import { describe, it, expect, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const configs: Record<string, any>[] = [];

  class FakeSvgEditor {
    configObj = { pref: () => undefined };
    svgCanvas = {
      getSvgString: () => "",
      svgCanvasToString: () => "",
      getSvgOption: () => ({}) as { apply?: boolean },
      setSvgOption: () => {},
      bind: () => undefined,
    };
    constructor(_container: HTMLElement) {}
    setConfig(config: Record<string, any>): void {
      configs.push(config);
    }
    init(): Promise<void> {
      return Promise.resolve();
    }
    reloadUserData(): void {}
    async loadFromString(): Promise<void> {}
    setBackground(): void {}
  }

  return { FakeSvgEditor, configs };
});

vi.mock("svgedit-editor", () => ({ default: hoisted.FakeSvgEditor }));

const { SvgView } = await import("../../src/view/SvgView");

describe("SvgView userDataAdapter", () => {
  it("reads and persists per-type default classes through plugin settings", async () => {
    hoisted.configs.length = 0;
    const plugin = {
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
        defaultClasses: { rect: "card" } as Record<string, string>,
        brushSlots: { 0: { thickness: 9 } } as Record<string, Record<string, unknown>>,
        canvasPresets: [],
        canvasLayouts: [],
        fontsFolder: "",
      },
      saveSettings: vi.fn(async () => {}),
      reloadUserDataInAllViews: vi.fn(),
    };
    const app = {
      workspace: { on: vi.fn(() => ({})), getActiveViewOfType: vi.fn(() => null) },
      scope: undefined,
      vault: {},
      metadataCache: {},
    };

    const view = new SvgView({ app } as any, plugin as any);
    await view.onload();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const adapter = hoisted.configs.map((c) => c.userDataAdapter).find(Boolean);
    expect(adapter, "SvgView passes a userDataAdapter to svgedit").toBeTruthy();
    expect(typeof adapter.getDefaultClasses).toBe("function");
    expect(typeof adapter.setDefaultClasses).toBe("function");

    // reads what is stored
    expect(adapter.getDefaultClasses()).toEqual({ rect: "card" });

    // a write lands in settings and is saved
    adapter.setDefaultClasses({ text: "title" });
    expect(plugin.settings.defaultClasses).toEqual({ text: "title" });
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(adapter.getDefaultClasses()).toEqual({ text: "title" });
  });

  it("persists the brush tool's saved slots through plugin settings", async () => {
    hoisted.configs.length = 0;
    const plugin = {
      manifest: { version: "1.0.0" },
      settings: {
        editorTheme: "light", uiModeMobile: "standard", uiModeDesktop: "standard", autosaveSeconds: 0,
        compressDrawingData: false, paletteOverrides: {}, userShapes: {}, hotkeyOverrides: {}, favorites: [],
        classLibrary: [], defaultClasses: {}, canvasPresets: [], canvasLayouts: [], fontsFolder: "",
        brushSlots: { 0: { thickness: 9 } } as Record<string, Record<string, unknown>>,
      },
      saveSettings: vi.fn(async () => {}),
      reloadUserDataInAllViews: vi.fn(),
    };
    const app = {
      workspace: { on: vi.fn(() => ({})), getActiveViewOfType: vi.fn(() => null) },
      scope: undefined, vault: {}, metadataCache: {},
    };
    const view = new SvgView({ app } as any, plugin as any);
    await view.onload();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const adapter = hoisted.configs.map((c) => c.userDataAdapter).find(Boolean);
    expect(typeof adapter.getBrushes).toBe("function");
    expect(typeof adapter.setBrushes).toBe("function");
    expect(adapter.getBrushes()).toEqual({ 0: { thickness: 9 } });
    adapter.setBrushes({ 1: { thickness: 20, name: "Ink" } });
    expect(plugin.settings.brushSlots).toEqual({ 1: { thickness: 20, name: "Ink" } });
    expect(plugin.saveSettings).toHaveBeenCalled();
  });
});
