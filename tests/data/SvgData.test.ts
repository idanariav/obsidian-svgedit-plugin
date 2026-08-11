import { describe, it, expect } from "vitest";
import {
  extractSvg,
  replaceSvg,
  getDrawingVersion,
  setDrawingVersion,
  namespaceSvgIds,
  getCanvasBg,
  setCanvasBg,
  isEmptyDrawing,
  encodeGradientBg,
  decodeGradientBg,
  extractSnapshots,
  replaceSnapshots,
  type DrawingSnapshot,
} from "../../src/data/SvgData";

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

// Regression coverage for the cross-instance id-collision family
// ([[parallel-drawing-fill-bug]] Bug A/A2): Obsidian can mount several
// svgedit editors into the same document (split panes), and SVG paint refs
// (url(#id), href="#id") resolve document-wide, so two drawings minting ids
// from their own reset-to-zero counters can collide. svgedit's own test
// suite only ever exercises one editor per document, so this collision is
// invisible there — it only shows up once two SvgView instances share a page.
describe("namespaceSvgIds", () => {
  const templateSvg =
    '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="svg_2"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect id="svg_1" width="10" height="10" fill="url(#svg_2)"/></svg>';

  const idsOf = (svg: string) => Array.from(svg.matchAll(/ id="([^"]+)"/g)).map((m) => m[1]);

  it("gives two different files (different seeds) non-colliding ids", () => {
    const a = namespaceSvgIds(templateSvg, "Drawings/A.md");
    const b = namespaceSvgIds(templateSvg, "Drawings/B.md");
    const [aIds, bIds] = [idsOf(a), idsOf(b)];
    expect(aIds).toHaveLength(2);
    for (const id of aIds) expect(bIds).not.toContain(id);
  });

  it("rewrites #id references (fill=\"url(#id)\") to match the renamed id", () => {
    const out = namespaceSvgIds(templateSvg, "Drawings/A.md");
    const gradId = /<linearGradient id="([^"]+)"/.exec(out)?.[1];
    expect(gradId).toBeTruthy();
    expect(out).toContain(`fill="url(#${gradId})"`);
  });

  it("is idempotent for the same file, so reopening it doesn't keep renaming ids", () => {
    const once = namespaceSvgIds(templateSvg, "Drawings/A.md");
    const twice = namespaceSvgIds(once, "Drawings/A.md");
    expect(twice).toBe(once);
  });

  it("re-namespaces a drawing whose baked-in nonce belongs to a different file (template duplication)", () => {
    // Mirrors "New drawing from template": two notes both start from the same
    // template file, which already carries a namespace baked in from being
    // stamped once (e.g. previewed, or copied). Without re-stamping, every
    // note created from that template would share one id namespace.
    const templated = namespaceSvgIds(templateSvg, "Templates/sketch_template.md");
    const noteA = namespaceSvgIds(templated, "Drawings/Note A.md");
    const noteB = namespaceSvgIds(templated, "Drawings/Note B.md");
    const [aIds, bIds] = [idsOf(noteA), idsOf(noteB)];
    for (const id of aIds) expect(bIds).not.toContain(id);
  });

  it("suffixes ids with no numeric run rather than leaving them untouched", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><linearGradient id="bg-gradient"/><rect id="background" fill="url(#bg-gradient)"/></svg>';
    const out = namespaceSvgIds(svg, "Drawings/A.md");
    expect(out).not.toContain('id="background"');
    expect(out).not.toContain('id="bg-gradient"');
    expect(out).toContain('fill="url(#bg-gradient_');
  });

  it("leaves an id-less, pathless drawing unchanged", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(namespaceSvgIds(svg, "")).toBe(svg);
  });
});

describe("getCanvasBg/setCanvasBg", () => {
  it("returns null when nothing is stamped", () => {
    expect(getCanvasBg(SVG)).toBeNull();
  });

  it("round-trips a stamped color", () => {
    const stamped = setCanvasBg(SVG, "#123456");
    expect(getCanvasBg(stamped)).toBe("#123456");
  });

  it("replaces rather than duplicates an existing stamp", () => {
    const stamped = setCanvasBg(setCanvasBg(SVG, "#111111"), "#222222");
    expect(getCanvasBg(stamped)).toBe("#222222");
    expect(stamped.match(/data-svgedit-canvas-bg/g)).toHaveLength(1);
  });

  it("strips the stamp when set to null", () => {
    const stamped = setCanvasBg(SVG, "#123456");
    expect(getCanvasBg(setCanvasBg(stamped, null))).toBeNull();
  });
});

describe("isEmptyDrawing", () => {
  it("treats a blank string as empty", () => {
    expect(isEmptyDrawing("")).toBe(true);
  });

  it("treats structural-only content (title/defs/empty g, no drawable elements) as empty", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>t</title><defs/><g></g></svg>';
    expect(isEmptyDrawing(svg)).toBe(true);
  });

  it("treats a drawing with a real drawable element as non-empty", () => {
    expect(isEmptyDrawing(SVG)).toBe(false);
  });
});

describe("extractSnapshots/replaceSnapshots round-trip", () => {
  const snapshot = (n: number): DrawingSnapshot => ({
    id: `id-${n}`,
    name: `Version ${n}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    svg: `<svg><rect width="${n}" height="${n}"/></svg>`,
  });

  it("returns an empty list when no Versions section exists", () => {
    expect(extractSnapshots(drawingFile(SVG))).toEqual([]);
  });

  it("extracts what replaceSnapshots wrote (raw)", () => {
    const file = replaceSnapshots(drawingFile(SVG), [snapshot(1), snapshot(2)], false);
    expect(extractSnapshots(file)).toEqual([snapshot(1), snapshot(2)]);
  });

  it("extracts what replaceSnapshots wrote (compressed)", () => {
    const file = replaceSnapshots(drawingFile(SVG), [snapshot(1)], true);
    expect(file).toContain("compressed-versions-json");
    expect(extractSnapshots(file)).toEqual([snapshot(1)]);
  });

  it("removes the section entirely when the list is empty", () => {
    const withVersions = replaceSnapshots(drawingFile(SVG), [snapshot(1)], false);
    const cleared = replaceSnapshots(withVersions, [], false);
    expect(cleared).not.toContain("## Versions");
    expect(extractSnapshots(cleared)).toEqual([]);
  });

  it("replaces rather than duplicates an existing Versions section", () => {
    const first = replaceSnapshots(drawingFile(SVG), [snapshot(1)], false);
    const second = replaceSnapshots(first, [snapshot(1), snapshot(2)], false);
    expect(second.match(/## Versions/g)).toHaveLength(1);
    expect(extractSnapshots(second)).toEqual([snapshot(1), snapshot(2)]);
  });

  // replaceSvg's BLOCK_REPLACE_REGEX rebuild swallows (and would otherwise
  // drop) any existing "## Versions" section along with "## Drawing" — this
  // simulates SvgView's actual save sequence (replaceSvg, then
  // replaceSnapshots to restore it) to prove versions survive an ordinary
  // drawing save.
  it("survives a normal drawing save (replaceSvg) when reconciled afterward", () => {
    const withVersions = replaceSnapshots(drawingFile(SVG), [snapshot(1)], false);
    const updatedSvg = '<svg><circle r="5"/></svg>';
    const afterSave = replaceSnapshots(
      replaceSvg(withVersions, updatedSvg, false),
      [snapshot(1)],
      false,
    );
    expect(extractSvg(afterSave)).toBe(updatedSvg);
    expect(extractSnapshots(afterSave)).toEqual([snapshot(1)]);
    expect(afterSave.match(/## Versions/g)).toHaveLength(1);
    expect(afterSave.match(/## Drawing/g)).toHaveLength(1);
  });

  it("drops the Versions section on a bare replaceSvg call (why the reconcile step is required)", () => {
    const withVersions = replaceSnapshots(drawingFile(SVG), [snapshot(1)], false);
    const afterSaveOnly = replaceSvg(withVersions, '<svg><circle r="5"/></svg>', false);
    expect(extractSnapshots(afterSaveOnly)).toEqual([]);
  });

  it("coexists with an existing Linked Files section", () => {
    const withLinks = drawingFile(SVG).replace(
      "## Drawing",
      "## Linked Files\n- [[img]]\n\n## Drawing",
    );
    const file = replaceSnapshots(withLinks, [snapshot(1)], false);
    expect(file).toContain("## Linked Files");
    expect(extractSnapshots(file)).toEqual([snapshot(1)]);
    expect(extractSvg(file)).toBe(SVG);
  });
});

describe("encodeGradientBg/decodeGradientBg", () => {
  it("round-trips gradient markup through the token", () => {
    const gradient = '<linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient>';
    expect(decodeGradientBg(encodeGradientBg(gradient))).toBe(gradient);
  });

  it("returns null decoding a token that isn't a gradient", () => {
    expect(decodeGradientBg("#ffffff")).toBeNull();
  });
});
