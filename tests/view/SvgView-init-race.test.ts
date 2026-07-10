/**
 * Regression test for the race documented at src/view/SvgView.ts's
 * `editorReady` field: `svgEditor` goes non-null the instant the editor is
 * constructed, well before `svgEditor.init()` resolves. If setViewData ever
 * treated construction as readiness, a setViewData landing during init()
 * (e.g. the markdown⇄SVG toggle reusing an already-cached file) would call
 * loadFromString on a not-yet-initialized editor — a silent no-op — while
 * still flipping `hasLoadedContent` true, which disarms the "never persist an
 * un-loaded canvas" guard and lets the next save overwrite the file with
 * svgedit's blank default canvas.
 *
 * Uses tests/mocks/obsidian.ts (the `obsidian` package is types-only, no
 * runtime JS, so SvgView can't be constructed against the real thing) and a
 * fake `svgedit-editor` whose init() resolves on demand, to actually land a
 * setViewData call inside that window and assert the guard holds.
 */

import { describe, it, expect, vi } from "vitest";
import { extractSvg } from "../../src/data/SvgData";

const hoisted = vi.hoisted(() => {
  const instances: FakeSvgEditor[] = [];

  class FakeSvgEditor {
    loadedSvgCalls: string[] = [];
    currentSvg = "";
    configObj = { pref: () => undefined };
    svgCanvas = {
      getSvgString: () => this.currentSvg,
      svgCanvasToString: () => this.currentSvg,
      getSvgOption: () => ({}) as { apply?: boolean },
      setSvgOption: () => {},
      bind: () => undefined,
    };
    private resolveInit!: () => void;
    private initPromise = new Promise<void>((resolve) => {
      this.resolveInit = resolve;
    });

    constructor(_container: HTMLElement) {
      instances.push(this);
    }
    setConfig(): void {}
    init(): Promise<void> {
      return this.initPromise;
    }
    finishInit(): void {
      this.resolveInit();
    }
    reloadUserData(): void {}
    async loadFromString(svg: string): Promise<void> {
      this.loadedSvgCalls.push(svg);
      this.currentSvg = svg;
    }
    setBackground(): void {}
  }

  return { FakeSvgEditor, instances };
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
    metadataCache: {},
  };
}

const DRAWING_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

function drawingFile(svg: string): string {
  return `---\nplugin: svg-drawing\n---\n\n## Drawing\n\`\`\`svg\n${svg}\n\`\`\`\n%%\n`;
}

describe("SvgView init race", () => {
  it("doesn't mark content loaded (or drop the incoming drawing) if setViewData lands before svgEditor.init() resolves", async () => {
    hoisted.instances.length = 0;
    const app = makeFakeApp();
    const plugin = makeFakePlugin();
    const leaf = { app };

    const view = new SvgView(leaf as any, plugin as any);
    const onloadPromise = view.onload();
    await flushMicrotasks(); // let onload() run up to `await this.svgEditor.init()`

    expect(hoisted.instances).toHaveLength(1);
    const fakeEditor = hoisted.instances[0];
    expect((view as any).editorReady).toBe(false);

    // The race: a setViewData call lands while init() is still pending.
    const fileContent = drawingFile(DRAWING_SVG);
    await view.setViewData(fileContent, false);

    // Must not have reached the not-yet-ready editor, and must not claim the
    // canvas holds real content — a save() right now must stay a no-op.
    expect(fakeEditor.loadedSvgCalls).toHaveLength(0);
    expect((view as any).hasLoadedContent).toBe(false);
    expect(view.getViewData()).toBe(fileContent);

    // init() now resolves; the pending drawing must be delivered afterward.
    fakeEditor.finishInit();
    await onloadPromise;

    expect((view as any).editorReady).toBe(true);
    expect(fakeEditor.loadedSvgCalls).toEqual([DRAWING_SVG]);
    expect((view as any).hasLoadedContent).toBe(true);
    expect(extractSvg(view.getViewData())).toBe(DRAWING_SVG);
  });
});
