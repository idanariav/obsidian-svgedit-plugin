/**
 * `SvgView.editorCommands()` is the seam the "Run editor command…" picker (and any
 * later LLM / CLI / MCP bridge) drives the editor through: nothing until the editor
 * has finished init(), then closures over the editor's own command registry.
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
    commands = {
      list: vi.fn(() => [{ id: "tool_clone", label: "Duplicate", group: "Edit", keys: [], enabled: true, interactive: false }]),
      run: vi.fn(() => "ran"),
    };
    private resolveInit!: () => void;
    private initPromise = new Promise<void>((resolve) => { this.resolveInit = resolve; });

    constructor(_container: HTMLElement) { instances.push(this); }
    setConfig(): void {}
    init(): Promise<void> { return this.initPromise; }
    finishInit(): void { this.resolveInit(); }
    reloadUserData(): void {}
    async loadFromString(): Promise<void> {}
    setBackground(): void {}
  }

  return { FakeSvgEditor, instances };
});

vi.mock("svgedit-editor", () => ({ default: hoisted.FakeSvgEditor }));

const { SvgView } = await import("../../src/view/SvgView");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const plugin = {
  manifest: { version: "1.0.0" },
  settings: {
    editorTheme: "light", uiModeMobile: "standard", uiModeDesktop: "standard", autosaveSeconds: 0,
    compressDrawingData: false, paletteOverrides: {}, userShapes: {}, hotkeyOverrides: {}, favorites: [],
    classLibrary: [], canvasPresets: [], canvasLayouts: [], fontsFolder: "",
  },
  saveSettings: vi.fn(async () => {}),
  reloadUserDataInAllViews: vi.fn(),
};
const app = { workspace: { on: vi.fn(() => ({})), getActiveViewOfType: vi.fn(() => null) }, scope: undefined, vault: {}, metadataCache: {} };

describe("SvgView.editorCommands", () => {
  it("is null before the editor is ready, then lists and runs through the editor's registry", async () => {
    hoisted.instances.length = 0;
    const view = new SvgView({ app } as any, plugin as any);
    expect(view.editorCommands()).toBeNull(); // no editor yet

    const loading = view.onload();
    await flush();
    expect(view.editorCommands()).toBeNull(); // constructed, init() pending

    const editor = hoisted.instances[0];
    editor.finishInit();
    await loading;

    const commands = view.editorCommands()!;
    expect(commands.list().map((c) => c.id)).toEqual(["tool_clone"]);
    expect(commands.run("tool_clone", { n: 1 })).toBe("ran");
    expect(editor.commands.run).toHaveBeenCalledWith("tool_clone", { n: 1 });
  });
});
