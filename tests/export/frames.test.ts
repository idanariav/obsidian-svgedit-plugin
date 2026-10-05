import { describe, it, expect } from "vitest";
import { listFrames, prepareSvgForExport, resolveExportJobs } from "../../src/export/frames";
import { frameFileSuffix } from "../../src/export/exporter";

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

const SVG_WITH_COMMENT_LAYER =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:se="http://svg-edit.googlecode.com" viewBox="0 0 200 100">' +
  '<g class="layer" id="layer1"><title>Layer 1</title><circle cx="10" cy="10" r="5"/></g>' +
  '<g class="layer" id="layer2" se:comment="true"><title>Comments</title><text x="20" y="20">note to self</text></g>' +
  "</svg>";

describe("prepareSvgForExport", () => {
  it("strips frame rects but keeps other content when no frame is named", () => {
    const result = prepareSvgForExport(SVG_WITH_FRAMES);
    expect(result).not.toContain("data-frame");
    expect(result).toContain("<circle");
  });

  it("strips comment layers regardless of their visibility", () => {
    const result = prepareSvgForExport(SVG_WITH_COMMENT_LAYER);
    expect(result).not.toContain("note to self");
    expect(result).not.toContain('id="layer2"');
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

describe("resolveExportJobs", () => {
  const frames = [
    { id: "f1", name: "Intro" },
    { id: "f2", name: "Hero shot" },
  ];
  const suffixOf = (n: string) => frameFileSuffix(n);
  const canvas = { frameName: "", suffix: "" };
  const intro = { frameName: "Intro", suffix: "-Intro" };
  const hero = { frameName: "Hero shot", suffix: "-Hero-shot" };

  it("keeps legacy behaviour for blank and single-name specs", () => {
    expect(resolveExportJobs("", frames, suffixOf)).toEqual([canvas]);
    expect(resolveExportJobs("Intro", frames, suffixOf)).toEqual([{ frameName: "Intro", suffix: "" }]);
    expect(resolveExportJobs("Nope", frames, suffixOf)).toEqual([canvas]);
  });

  it("all-frames exports one suffixed file per frame and no canvas", () => {
    expect(resolveExportJobs("all-frames", frames, suffixOf)).toEqual([intro, hero]);
  });

  it("all-frames-inc-canvas also exports the whole canvas", () => {
    expect(resolveExportJobs("all-frames-inc-canvas", frames, suffixOf)).toEqual([intro, hero, canvas]);
  });

  it("a list exports only the named existing frames", () => {
    expect(resolveExportJobs(["Hero shot", "Missing"], frames, suffixOf)).toEqual([hero]);
    expect(resolveExportJobs(["Missing"], frames, suffixOf)).toEqual([canvas]);
  });

  it("falls back to the whole canvas when the drawing has no frames", () => {
    expect(resolveExportJobs("all-frames", [], suffixOf)).toEqual([canvas]);
  });

  it("disambiguates frames whose names slug to the same filename", () => {
    const clash = [{ id: "a", name: "A b" }, { id: "b", name: "A-b" }];
    const jobs = resolveExportJobs("all-frames", clash, suffixOf);
    expect(jobs.map((j) => j.suffix)).toEqual(["-A-b", "-A-b-2"]);
  });
});
