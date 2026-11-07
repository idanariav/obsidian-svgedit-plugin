import { describe, it, expect } from "vitest";
import { prepareSvgForCompare } from "../../src/export/compare";

const STORED =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:se="http://svg-edit.googlecode.com" ' +
  'data-svgedit-plugin-version="1.0.62" data-svgedit-canvas-bg="#c7fdff" width="1080" height="1350">' +
  '<g class="layer" id="l1"><title>Layer 1</title><text font-family="Architects Daughter">Set free</text>' +
  '<rect data-frame="1" x="0" y="0" width="10" height="10"><title>f</title></rect></g>' +
  '<g class="layer" id="l2" se:comment="true"><title>Feedback comments</title><text>1. moved</text></g>' +
  "</svg>";

const fonts = [
  { family: "Architects Daughter", woff2Base64: "AAAA" },
  { family: "Unused Font", woff2Base64: "BBBB" },
];

describe("prepareSvgForCompare", () => {
  it("bakes in the canvas background, a viewBox and only the fonts the drawing uses", () => {
    const im = prepareSvgForCompare(STORED, { showComments: true, fonts });
    expect(im).toMatchObject({ width: 1080, height: 1350 });
    expect(im.svg).toContain('viewBox="0 0 1080 1350"');
    expect(im.svg).toMatch(/<rect[^>]*fill="#c7fdff"/);
    expect(im.svg).toContain('font-family:"Architects Daughter"');
    expect(im.svg).not.toContain("Unused Font");
    expect(im.svg).not.toContain("data-svgedit-canvas-bg");
    expect(im.svg).not.toContain("data-frame");
  });

  it("keeps comment layers only when asked", () => {
    expect(prepareSvgForCompare(STORED, { showComments: true, fonts: [] }).svg).toContain("1. moved");
    expect(prepareSvgForCompare(STORED, { showComments: false, fonts: [] }).svg).not.toContain("1. moved");
  });

  it("puts the background behind the drawing, not over it", () => {
    const { svg } = prepareSvgForCompare(STORED, { showComments: false, fonts: [] });
    expect(svg.indexOf('fill="#c7fdff"')).toBeLessThan(svg.indexOf('class="layer"'));
  });
});
