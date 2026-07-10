import { describe, it, expect } from "vitest";
import { listFrames, prepareSvgForExport } from "../../src/export/frames";

const SVG_WITH_FRAMES =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
  '<rect data-frame="1" id="f1" x="0" y="0" width="50" height="50"><title>Intro</title></rect>' +
  '<rect data-frame="1" id="f2" x="60" y="0" width="40" height="30"></rect>' +
  '<circle cx="10" cy="10" r="5"/>' +
  "</svg>";

describe("listFrames", () => {
  it("lists frames in document order with names from their <title>", () => {
    expect(listFrames(SVG_WITH_FRAMES)).toEqual([
      { id: "f1", name: "Intro" },
      { id: "f2", name: "Frame 2" },
    ]);
  });

  it("returns an empty list when there are no frames", () => {
    expect(listFrames('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toEqual([]);
  });
});

describe("prepareSvgForExport", () => {
  it("strips frame rects but keeps other content when no frame is named", () => {
    const result = prepareSvgForExport(SVG_WITH_FRAMES);
    expect(result).not.toContain("data-frame");
    expect(result).toContain("<circle");
  });

  it("crops to the named frame's bounds and strips frame rects", () => {
    const result = prepareSvgForExport(SVG_WITH_FRAMES, "Intro");
    expect(result).toContain('viewBox="0 0 50 50"');
    expect(result).toContain('width="50"');
    expect(result).toContain('height="50"');
    expect(result).not.toContain("data-frame");
  });

  it("exports the whole canvas when the named frame doesn't match", () => {
    const result = prepareSvgForExport(SVG_WITH_FRAMES, "Nope");
    expect(result).toContain('viewBox="0 0 200 100"');
  });
});
