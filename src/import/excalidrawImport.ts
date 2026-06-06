import LZString from "lz-string";

/**
 * Converts an Obsidian Excalidraw drawing note into an svgedit-compatible SVG
 * string. We map each Excalidraw element to a clean, individually-editable SVG
 * primitive (rect/ellipse/polygon/polyline/path/text/image) rather than the
 * roughjs <path> "soup" Excalidraw's own export produces — the hand-drawn look
 * and hachure fill textures are intentionally dropped in favour of editability.
 *
 * The Obsidian Excalidraw plugin stores the scene as
 *   LZString.compressToBase64(JSON.stringify(scene))
 * chunked with blank lines inside a ```compressed-json fence (older/decompressed
 * files use a plain ```json fence). See the sibling obsidian-excalidraw-plugin
 * repo's src/utils/sceneDataUtils.ts.
 */

// ── Excalidraw scene types (only the fields we read) ─────────────────────────

interface ExcalPoint extends Array<number> {
  0: number;
  1: number;
}

export interface ExcalElement {
  type: string;
  isDeleted?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  opacity?: number;
  roundness?: unknown | null;
  // line / arrow / freedraw
  points?: ExcalPoint[];
  polygon?: boolean;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  // image
  fileId?: string | null;
}

export interface ExcalScene {
  type?: string;
  elements: ExcalElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, { dataURL?: string } | undefined>;
  [k: string]: unknown;
}

// ── parsing ──────────────────────────────────────────────────────────────────

const COMPRESSED_RE = /```compressed-json\n([\s\S]*?)\n```/;
const JSON_RE = /## Drawing\n```json\n([\s\S]*?)\n```/;

/** Extract and decompress the Excalidraw scene from a drawing note's markdown. */
export function parseExcalidrawScene(content: string): ExcalScene | null {
  const compressed = COMPRESSED_RE.exec(content);
  if (compressed) {
    const cleaned = compressed[1].replace(/\s+/g, "");
    const json = LZString.decompressFromBase64(cleaned);
    if (!json) return null;
    return JSON.parse(json) as ExcalScene;
  }
  const plain = JSON_RE.exec(content);
  if (plain) {
    return JSON.parse(plain[1]) as ExcalScene;
  }
  return null;
}

/**
 * Strip the Obsidian Excalidraw plugin's drawing data from a note: the
 * "# Excalidraw Data" section (Text Elements + the %%-wrapped Drawing block,
 * which always sits at the end of the file) plus the "Switch to EXCALIDRAW
 * VIEW" notice paragraph. Leaves the rest of the note body intact.
 */
export function stripExcalidrawData(content: string): string {
  return content
    .replace(/\n#+ Excalidraw Data[\s\S]*$/, "\n")
    .replace(/^.*Switch to EXCALIDRAW VIEW.*$\n?/m, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

// ── SVG generation ───────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";
const PAD = 20;
const RENDERABLE = new Set([
  "rectangle", "ellipse", "diamond", "triangle",
  "line", "arrow", "freedraw", "text", "image",
]);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Round to 2 decimals and drop a trailing ".00". */
function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

function fontFamily(family: number | undefined): string {
  switch (family) {
    case 2: return "Helvetica, Arial, sans-serif";
    case 3: return "Cascadia, Consolas, monospace";
    default: return "Virgil, Segoe UI, sans-serif";
  }
}

/** Shared stroke/fill/opacity attributes for a shape element. */
function commonAttrs(el: ExcalElement, isText = false): string {
  const parts: string[] = [];
  const stroke = el.strokeColor;
  if (isText) {
    parts.push(`fill="${esc(stroke ?? "#000000")}"`);
  } else {
    const bg = el.backgroundColor;
    parts.push(`fill="${bg && bg !== "transparent" ? esc(bg) : "none"}"`);
    if (stroke && stroke !== "transparent") parts.push(`stroke="${esc(stroke)}"`);
    const sw = el.strokeWidth ?? 1;
    parts.push(`stroke-width="${n(sw)}"`);
    if (el.strokeStyle === "dashed") parts.push(`stroke-dasharray="${n(sw * 4)},${n(sw * 4)}"`);
    else if (el.strokeStyle === "dotted") parts.push(`stroke-dasharray="${n(sw)},${n(sw * 2)}"`);
  }
  if (el.opacity != null && el.opacity < 100) parts.push(`opacity="${n(el.opacity / 100)}"`);
  return parts.join(" ");
}

/** rotate(deg cx cy) transform when the element is rotated; cx/cy already offset. */
function rotateAttr(el: ExcalElement, ox: number, oy: number): string {
  const a = el.angle ?? 0;
  if (!a) return "";
  const cx = el.x + ox + el.width / 2;
  const cy = el.y + oy + el.height / 2;
  const deg = (a * 180) / Math.PI;
  return ` transform="rotate(${n(deg)} ${n(cx)} ${n(cy)})"`;
}

function elementToSvg(el: ExcalElement, id: string, ox: number, oy: number, scene: ExcalScene): string | null {
  const x = el.x + ox;
  const y = el.y + oy;
  const w = el.width;
  const h = el.height;
  const idAttr = ` id="${id}"`;
  const rot = rotateAttr(el, ox, oy);

  switch (el.type) {
    case "rectangle": {
      const rx = el.roundness ? Math.min(32, w / 4, h / 4) : 0;
      const rxAttr = rx > 0 ? ` rx="${n(rx)}"` : "";
      return `<rect${idAttr} x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rxAttr} ${commonAttrs(el)}${rot}/>`;
    }
    case "ellipse": {
      return `<ellipse${idAttr} cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}" ${commonAttrs(el)}${rot}/>`;
    }
    case "diamond": {
      const pts = [
        [x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2],
      ];
      return `<polygon${idAttr} points="${pointsStr(pts)}" ${commonAttrs(el)}${rot}/>`;
    }
    case "triangle": {
      const pts = [[x + w / 2, y], [x + w, y + h], [x, y + h]];
      return `<polygon${idAttr} points="${pointsStr(pts)}" ${commonAttrs(el)}${rot}/>`;
    }
    case "line":
    case "arrow": {
      const pts = (el.points ?? []).map((p) => [x + p[0], y + p[1]]);
      if (pts.length < 2) return null;
      if (el.type === "line" && el.polygon) {
        return `<polygon${idAttr} points="${pointsStr(pts)}" ${commonAttrs(el)}${rot}/>`;
      }
      const markers = el.type === "arrow"
        ? `${el.endArrowhead ? ' marker-end="url(#excal-arrow)"' : ""}${el.startArrowhead ? ' marker-start="url(#excal-arrow-start)"' : ""}`
        : "";
      // polyline default fill is the element's fill; force none unless a real bg is set
      return `<polyline${idAttr} points="${pointsStr(pts)}" ${commonAttrs(el)}${markers}${rot}/>`;
    }
    case "freedraw": {
      const pts = (el.points ?? []).map((p) => [x + p[0], y + p[1]]);
      if (pts.length < 2) return null;
      const d = "M" + pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" L");
      const stroke = el.strokeColor ?? "#000000";
      const sw = el.strokeWidth ?? 1;
      const op = el.opacity != null && el.opacity < 100 ? ` opacity="${n(el.opacity / 100)}"` : "";
      return `<path${idAttr} d="${d}" fill="none" stroke="${esc(stroke)}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"${op}${rot}/>`;
    }
    case "text": {
      const text = el.text ?? "";
      const size = el.fontSize ?? 20;
      const lineH = (el.lineHeight ?? 1.25) * size;
      const align = el.textAlign ?? "left";
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
      const lines = text.split("\n");
      const tspans = lines
        .map((line, i) => `<tspan x="${n(tx)}" dy="${i === 0 ? n(size) : n(lineH)}">${esc(line) || " "}</tspan>`)
        .join("");
      return `<text${idAttr} x="${n(tx)}" y="${n(y)}" font-family="${esc(fontFamily(el.fontFamily))}" font-size="${n(size)}" text-anchor="${anchor}" ${commonAttrs(el, true)}${rot}>${tspans}</text>`;
    }
    case "image": {
      const file = el.fileId ? scene.files?.[el.fileId] : undefined;
      const dataURL = file?.dataURL;
      if (!dataURL) {
        console.warn(`[svgedit import] image element ${id} has no file data; skipping`);
        return null;
      }
      const op = el.opacity != null && el.opacity < 100 ? ` opacity="${n(el.opacity / 100)}"` : "";
      return `<image${idAttr} x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" href="${esc(dataURL)}"${op}${rot}/>`;
    }
    default:
      console.warn(`[svgedit import] skipping unsupported element type "${el.type}"`);
      return null;
  }
}

function pointsStr(pts: number[][]): string {
  return pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" ");
}

const ARROW_MARKERS =
  `<marker id="excal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>` +
  `<marker id="excal-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10,0 L0,5 L10,10 z" fill="context-stroke"/></marker>`;

/** Convert a parsed Excalidraw scene into an svgedit-compatible SVG string. */
export function excalidrawToSvg(scene: ExcalScene): string {
  const els = (scene.elements ?? []).filter(
    (e) => !e.isDeleted && RENDERABLE.has(e.type),
  );

  // Bounding box across all renderable elements.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of els) {
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.width);
    maxY = Math.max(maxY, e.y + e.height);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  const ox = -minX + PAD;
  const oy = -minY + PAD;
  const width = Math.max(1, Math.ceil(maxX - minX + PAD * 2));
  const height = Math.max(1, Math.ceil(maxY - minY + PAD * 2));

  const body: string[] = [];
  let needsArrow = false;
  let i = 1;
  for (const e of els) {
    if (e.type === "arrow") needsArrow = true;
    const svg = elementToSvg(e, `svg_${i}`, ox, oy, scene);
    if (svg) { body.push("  " + svg); i++; }
  }

  const defs = needsArrow ? `\n <defs>${ARROW_MARKERS}</defs>` : "";

  return (
    `<svg xmlns="${SVG_NS}" xmlns:svg="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">\n` +
    ` <title>SVG Drawing</title>${defs}\n` +
    ` <g class="layer">\n` +
    `  <title>Layer 1</title>\n` +
    body.join("\n") + (body.length ? "\n" : "") +
    ` </g>\n` +
    `</svg>`
  );
}
