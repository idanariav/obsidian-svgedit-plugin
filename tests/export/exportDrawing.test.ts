import { describe, it, expect, vi } from "vitest";
import { exportDrawing } from "../../src/export/exporter";

vi.mock("../../src/export/raster", () => ({ svgToPngArrayBuffer: async () => new ArrayBuffer(1) }));
vi.mock("../../src/data/lockedEmbeds", () => ({ bakeExternalEmbedsForExport: async (_a: unknown, s: string) => s }));

const svg = (...names: string[]) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  names.map((n, i) => `<rect data-frame="1" id="f${i}" x="${i * 10}" y="0" width="10" height="10"><title>${n}</title></rect>`).join("") +
  "</svg>";

function setup() {
  const files = new Map<string, unknown>();
  const app = {
    vault: {
      adapter: {
        write: async (p: string, d: string) => void files.set(p, d),
        writeBinary: async (p: string, d: ArrayBuffer) => void files.set(p, d),
        exists: async (p: string) => files.has(p),
        remove: async (p: string) => void files.delete(p),
      },
    },
  } as never;
  const settings = { exportFolderMappings: [], pngScale: 1, frameExportManifest: {} } as never;
  const file = { path: "d/board.md" } as never;
  const effective = (exportFrame: string | string[]) =>
    ({ exportFrame, transparentBackground: false }) as never;
  return { files, app, settings, file, effective };
}

describe("exportDrawing — per-frame files", () => {
  it("writes one file per frame and deletes the file of a removed/renamed frame", async () => {
    const { files, app, settings, file, effective } = setup();
    const save = vi.fn(async () => {});
    const run = (s: string, spec = "all-frames") =>
      exportDrawing(app, file, s, settings, effective(spec), { svg: true, png: false }, "#fff", save);

    await run(svg("A", "B"));
    expect([...files.keys()].sort()).toEqual(["d/board-A.svg", "d/board-B.svg"]);

    await run(svg("A", "C")); // B renamed to C
    expect([...files.keys()].sort()).toEqual(["d/board-A.svg", "d/board-C.svg"]);
    expect(settings.frameExportManifest["d/board.md"]).toEqual(["d/board-A.svg", "d/board-C.svg"]);
  });

  it("does not write the canvas for all-frames, but does for all-frames-inc-canvas", async () => {
    const { files, app, settings, file, effective } = setup();
    const run = (spec: string) =>
      exportDrawing(app, file, svg("A"), settings, effective(spec), { svg: true, png: false });
    await run("all-frames");
    expect(files.has("d/board.svg")).toBe(false);
    await run("all-frames-inc-canvas");
    expect(files.has("d/board.svg")).toBe(true);
  });

  it("removes recorded frame files when switching back to whole-canvas, and leaves the other format alone", async () => {
    const { files, app, settings, file, effective } = setup();
    await exportDrawing(app, file, svg("A"), settings, effective("all-frames"), { svg: true, png: true });
    expect(files.has("d/board-A.png")).toBe(true);

    await exportDrawing(app, file, svg("A"), settings, effective(""), { svg: true, png: false });
    expect(files.has("d/board-A.svg")).toBe(false); // svg stale, removed
    expect(files.has("d/board-A.png")).toBe(true); // png not exported this run, untouched
  });

  it("never deletes files it did not record", async () => {
    const { files, app, settings, file, effective } = setup();
    files.set("d/board-notes.svg", "user file");
    await exportDrawing(app, file, svg("A"), settings, effective("all-frames"), { svg: true, png: false });
    expect(files.has("d/board-notes.svg")).toBe(true);
  });
});
