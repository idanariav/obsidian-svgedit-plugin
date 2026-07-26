import { describe, it, expect } from "vitest";
import { extractSvg, replaceSvg, getDrawingVersion, setDrawingVersion } from "../../src/data/SvgData";

const SVG = "<svg><rect width=\"1\" height=\"1\"/></svg>";

function drawingFile(svg: string): string {
  return replaceSvg("---\nplugin: svg-drawing\n---\n", svg, false);
}

describe("extractSvg/replaceSvg round-trip", () => {
  it("extracts what replaceSvg wrote", () => {
    const file = drawingFile(SVG);
    expect(extractSvg(file)).toBe(SVG);
  });

  it("replaces an existing block instead of duplicating it", () => {
    const first = drawingFile(SVG);
    const updated = "<svg><circle r=\"2\"/></svg>";
    const second = replaceSvg(first, updated, false);
    expect(extractSvg(second)).toBe(updated);
    expect(second.match(/## Drawing/g)).toHaveLength(1);
  });

  // Regression test for the CRLF empty-open bug: CRLF line endings broke the
  // LF-anchored block regexes, so a synced/edited file would read as empty
  // and a subsequent save could persist that empty state over real content.
  it("extracts correctly from a file with CRLF line endings", () => {
    const file = drawingFile(SVG).replace(/\n/g, "\r\n");
    expect(extractSvg(file)).toBe(SVG);
  });

  it("replaces the existing block in a CRLF file rather than appending a duplicate", () => {
    const file = drawingFile(SVG).replace(/\n/g, "\r\n");
    const updated = "<svg><circle r=\"2\"/></svg>";
    const result = replaceSvg(file, updated, false);
    expect(extractSvg(result)).toBe(updated);
    expect(result.match(/## Drawing/g)).toHaveLength(1);
  });
});

describe("getDrawingVersion/setDrawingVersion", () => {
  it("returns null when no version is stamped", () => {
    expect(getDrawingVersion(SVG)).toBeNull();
  });

  it("round-trips a stamped version", () => {
    const stamped = setDrawingVersion(SVG, "1.2.3");
    expect(getDrawingVersion(stamped)).toBe("1.2.3");
  });

  it("replaces rather than duplicates an existing stamp", () => {
    const stamped = setDrawingVersion(setDrawingVersion(SVG, "1.0.0"), "1.2.3");
    expect(getDrawingVersion(stamped)).toBe("1.2.3");
    expect(stamped.match(/data-svgedit-plugin-version/g)).toHaveLength(1);
  });

  it("strips the stamp when set to null", () => {
    const stamped = setDrawingVersion(SVG, "1.2.3");
    expect(getDrawingVersion(setDrawingVersion(stamped, null))).toBeNull();
  });
});
