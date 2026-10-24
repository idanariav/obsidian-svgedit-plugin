/**
 * SvgView hands svgedit the UI shell configured for the platform (`uiModeDesktop` on a computer,
 * `uiModeMobile` on a phone or tablet) as the editor's `uiMode` pref, so "mobile" reaches the editor's
 * view-first mobile shell rather than collapsing to a tablet / desktop boolean.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { Platform } from "obsidian";

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

const uiModeFor = async (uiModeDesktop: string, uiModeMobile: string): Promise<unknown> => {
  hoisted.configs.length = 0;
  const plugin = {
    manifest: { version: "1.0.0" },
    settings: {
      editorTheme: "light", uiModeDesktop, uiModeMobile, autosaveSeconds: 0,
      compressDrawingData: false, paletteOverrides: {}, userShapes: {}, hotkeyOverrides: {}, favorites: [],
      classLibrary: [], defaultClasses: {}, brushSlots: {}, canvasPresets: [], canvasLayouts: [], fontsFolder: "",
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
  const config = hoisted.configs.find((c) => "uiMode" in c);
  expect(config, "SvgView passes uiMode to svgedit").toBeTruthy();
  expect(config).not.toHaveProperty("tabletMode");
  return config?.uiMode;
};

describe("SvgView UI mode", () => {
  afterEach(() => { Platform.isMobile = false; });

  it("uses the desktop setting on a computer", async () => {
    Platform.isMobile = false;
    expect(await uiModeFor("tablet", "mobile")).toBe("tablet");
  });

  it("uses the mobile setting on a phone or tablet, including the mobile shell", async () => {
    Platform.isMobile = true;
    expect(await uiModeFor("desktop", "mobile")).toBe("mobile");
  });
});
