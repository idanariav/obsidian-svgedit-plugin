import { describe, it, expect, vi } from "vitest";
import { TFile } from "obsidian";
import { createApi } from "../src/api";
import { createDrawingTemplate, extractSnapshots, getDrawingVersion } from "../src/data/SvgData";

vi.mock("../src/view/SvgView", () => ({ SvgView: class {} }));
vi.mock("../src/data/frontmatter", () => ({ resolveEffectiveSettings: () => ({}) }));
const autoExport = vi.fn(async () => {});
vi.mock("../src/export/exporter", () => ({ autoExport: (...a: unknown[]) => autoExport(...(a as [])) }));

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">${body}</svg>`;

function setup(initial: string) {
  const file = Object.assign(new TFile(), { path: "d/obj.md" });
  let content = initial;
  const plugin = {
    manifest: { version: "9.9.9" },
    settings: { compressDrawingData: true },
    saveSettings: async () => {},
    app: {
      vault: {
        getAbstractFileByPath: (p: string) => (p === file.path ? file : null),
        read: async () => content,
        modify: async (_f: unknown, c: string) => void (content = c),
      },
      workspace: { getLeavesOfType: () => [] },
    },
  } as never;
  return { api: createApi(plugin), get content() { return content; } };
}

describe("SketchEditorApi", () => {
  it("writes a new drawing, stamps the version, snapshots the old one and exports", async () => {
    const env = setup(createDrawingTemplate(true, svg("<rect/>")));
    await env.api.writeDrawing("d/obj.md", svg("<circle/>"), { snapshot: "Before tiers" });

    const stored = await env.api.readDrawing("d/obj.md");
    expect(stored).toContain("<circle/>");
    expect(getDrawingVersion(stored!)).toBe("9.9.9");
    const snaps = extractSnapshots(env.content);
    expect(snaps.map((s) => s.name)).toEqual(["Before tiers"]);
    expect(snaps[0].svg).toContain("<rect/>");
    expect(autoExport).toHaveBeenCalled();
  });

  it("replaces a same-name snapshot instead of adding another", async () => {
    const env = setup(createDrawingTemplate(true, svg("<rect/>")));
    await env.api.writeDrawing("d/obj.md", svg("<circle/>"), { snapshot: "Before tiers" });
    await env.api.writeDrawing("d/obj.md", svg("<line/>"), { snapshot: "Before tiers" });
    const snaps = extractSnapshots(env.content);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].svg).toContain("<circle/>");
  });

  it("refuses a new snapshot when the versions list is full", async () => {
    const env = setup(createDrawingTemplate(true, svg("<rect/>")));
    for (let i = 0; i < 5; i++) await env.api.writeDrawing("d/obj.md", svg(`<g id="v${i}"/>`), { snapshot: `v${i}` });
    await expect(env.api.writeDrawing("d/obj.md", svg("<line/>"), { snapshot: "v5" })).rejects.toThrow(/versions/);
  });

  it("saves a version without touching the live drawing or exporting", async () => {
    const env = setup(createDrawingTemplate(true, svg("<rect/>")));
    autoExport.mockClear();
    await env.api.saveVersion("d/obj.md", "Feedback r1", svg("<circle/>"));
    expect(await env.api.readDrawing("d/obj.md")).toContain("<rect/>");
    const snaps = extractSnapshots(env.content);
    expect(snaps.map((s) => s.name)).toEqual(["Feedback r1"]);
    expect(snaps[0].svg).toContain("<circle/>");
    expect(getDrawingVersion(snaps[0].svg)).toBe("9.9.9");
    expect(autoExport).not.toHaveBeenCalled();
    await env.api.saveVersion("d/obj.md", "Feedback r1", svg("<line/>"));
    expect(extractSnapshots(env.content)).toHaveLength(1);
  });
});
