/**
 * Prepare a stored drawing SVG (the live canvas or a saved version) for the
 * version comparison view, which shows each one through an <img> so two
 * versions with the same element ids can't collide and nothing leaks into the
 * page. An <img> has no access to the document's fonts or the editor's canvas
 * background, so both are baked into the SVG itself.
 */
import { prepareSvgForExport } from "./frames";
import {
  bakeGradientIntoSvg,
  decodeGradientBg,
  getCanvasBg,
  getDrawingVersion,
  setCanvasBg,
  setDrawingVersion,
} from "../data/SvgData";
import { runMigrations } from "../data/migrations";

const SVGNS = "http://www.w3.org/2000/svg";

export interface CompareFont {
  family: string;
  woff2Base64: string;
}

export interface CompareImage {
  svg: string;
  width: number;
  height: number;
}

export function prepareSvgForCompare(
  stored: string,
  opts: { showComments: boolean; fonts: CompareFont[] },
): CompareImage {
  const bg = getCanvasBg(stored);
  const clean = setDrawingVersion(runMigrations(setCanvasBg(stored, null), getDrawingVersion(stored)), null);
  let svg = prepareSvgForExport(clean, "", opts.showComments);
  const gradientXml = bg ? decodeGradientBg(bg) : null;
  if (gradientXml) svg = bakeGradientIntoSvg(svg, gradientXml);

  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const width = parseFloat(root.getAttribute("width") || "800");
  const height = parseFloat(root.getAttribute("height") || "600");
  if (!root.hasAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // A solid background goes in as the bottom-most rect (a gradient was baked above).
  if (!gradientXml) {
    const rect = doc.createElementNS(SVGNS, "rect");
    for (const [k, v] of [["x", "0"], ["y", "0"], ["width", "100%"], ["height", "100%"], ["fill", bg ?? "#ffffff"]]) {
      rect.setAttribute(k, v);
    }
    const firstDrawable = Array.from(root.children).find((c) => ["title", "defs", "style"].indexOf(c.localName) < 0);
    root.insertBefore(rect, firstDrawable ?? null);
  }

  // Embed only the vault fonts the drawing actually names.
  const used = opts.fonts.filter((f) => svg.includes(f.family));
  if (used.length) {
    const style = doc.createElementNS(SVGNS, "style");
    style.textContent = used
      .map((f) => `@font-face{font-family:"${f.family}";src:url(data:font/woff2;base64,${f.woff2Base64}) format("woff2")}`)
      .join("");
    root.insertBefore(style, root.firstChild);
  }

  return { svg: new XMLSerializer().serializeToString(root), width, height };
}
