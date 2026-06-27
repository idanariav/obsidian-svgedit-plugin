import LZString from "lz-string";
import {
  SVGEDIT_SECTION_OPEN,
  DRAWING_SECTION_HEADING,
  DRAWING_FENCE_OPEN,
  DRAWING_FENCE_COMPRESSED_OPEN,
  DRAWING_FENCE_CLOSE,
  DRAWING_SECTION_END,
  EMPTY_SVG,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
  SWITCH_NOTICE,
  LINKED_FILES_HEADING,
  VAULT_LINK_ATTR,
  CANVAS_BG_ATTR,
} from "../constants";

// Matches the fenced raw-SVG block between the ## Drawing heading and the %%
// terminator, capturing the SVG content inside the fence. The optional
// section-heading wrapper may sit just above; this regex only needs the inner
// block.
const RAW_BLOCK_REGEX =
  /## Drawing\n```svg\n([\s\S]*?)\n```\s*\n%%/;

// Matches the fenced compressed-SVG block, capturing the chunked base64 payload.
const COMPRESSED_BLOCK_REGEX =
  /## Drawing\n```compressed-svg\n([\s\S]*?)\n```\s*\n%%/;

// One `%%` + section-heading wrapper opening. Accepts the current "Sketch Editor
// Data" heading and the legacy "SVGEdit Data" name, and tolerates blank lines
// after the `%%` fence (an older format left a `%%\n\n# … Data` variant behind).
const WRAPPER_OPEN = "(?:%%\\n+#+ (?:Sketch Editor|SVGEdit) Data\\n+)";

// Either block (raw or compressed), including any wrapper opening(s) — and an
// auto-managed "## Linked Files" section — that precede it. Matching the opening
// too means rebuilding the block also migrates legacy (un-wrapped) files to the
// wrapped layout, and the `(?:svg|compressed-svg)` alternation lets a save in
// either direction rewrite whichever format currently exists. The `*` on the
// wrapper collapses duplicated/stray wrapper openings back into the single one
// buildBlock writes.
//
// The optional "## Linked Files" segment is the crucial part: reconcileLinkedFiles
// inserts that section *between* the wrapper opening and "## Drawing", so without
// matching it here the wrapper is no longer adjacent to "## Drawing" and would be
// left behind — buildBlock would then prepend a *second* wrapper, duplicating the
// "# … Data" heading on every save. Swallowing it lets the single fresh wrapper
// replace the whole region; reconcileLinkedFiles re-adds Linked Files immediately
// after, under that one surviving wrapper.
const BLOCK_REPLACE_REGEX = new RegExp(
  WRAPPER_OPEN + "*(?:## Linked Files\\n(?:.*\\n)*?)?## Drawing\\n```(?:svg|compressed-svg)\\n[\\s\\S]*?\\n```\\s*\\n%%",
);

// Width to wrap the base64 payload at, so a compressed drawing is many modest
// lines rather than one enormous line. Whitespace is stripped before decompress.
const BASE64_LINE_WIDTH = 76;

/** Extract the SVG string from a markdown drawing file. Returns null if not found. */
export function extractSvg(content: string): string | null {
  const c = COMPRESSED_BLOCK_REGEX.exec(content);
  if (c) return LZString.decompressFromBase64(c[1].replace(/\s+/g, "")) || null;
  const m = RAW_BLOCK_REGEX.exec(content);
  return m ? m[1] : null;
}

// Graphics elements that count as actual drawn content. Structural nodes
// (<g> layers, <title>, <defs>, <metadata>) are ignored so both the saved
// EMPTY_SVG and svgedit's empty-layer serialization read as "empty".
const DRAWABLE_SELECTOR =
  "path,rect,circle,ellipse,line,polyline,polygon,text,image,use,foreignObject";

/** True when an SVG drawing has no drawable content. Used to detect the
 *  empty-canvas state for the backup-recovery net (offer restore on an empty
 *  open) and to skip backing up empty canvases. */
export function isEmptyDrawing(svg: string): boolean {
  if (!svg || !svg.trim()) return true;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  // A parse error means we can't tell — treat as non-empty so we neither nag
  // with a restore prompt nor skip a backup on questionable input.
  if (doc.querySelector("parsererror")) return false;
  return doc.querySelector(DRAWABLE_SELECTOR) === null;
}

/** Replace the SVG block in an existing markdown drawing file with new SVG content. */
export function replaceSvg(content: string, newSvg: string, compress: boolean): string {
  const block = buildBlock(newSvg, compress);
  if (BLOCK_REPLACE_REGEX.test(content)) {
    return content.replace(BLOCK_REPLACE_REGEX, () => block);
  }
  return content + "\n\n" + block;
}

function buildBlock(svg: string, compress: boolean): string {
  const fenceOpen = compress ? DRAWING_FENCE_COMPRESSED_OPEN : DRAWING_FENCE_OPEN;
  const payload = compress ? chunk(LZString.compressToBase64(svg), BASE64_LINE_WIDTH) : svg;
  return (
    `${SVGEDIT_SECTION_OPEN}\n\n` +
    `${DRAWING_SECTION_HEADING}\n${fenceOpen}\n${payload}\n${DRAWING_FENCE_CLOSE}\n${DRAWING_SECTION_END}`
  );
}

/** Break a string into newline-separated lines of at most `width` characters. */
function chunk(s: string, width: number): string {
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += width) lines.push(s.slice(i, i + width));
  return lines.join("\n");
}

// ── Per-drawing canvas background ──────────────────────────────────────────────
// The canvas background color is svgedit editor chrome (a global `bkgd_color`
// pref), not part of the SVG document, so it resets to white whenever a fresh
// editor instance opens. To make it per-drawing, the plugin stamps the chosen
// color onto the saved root <svg> via CANVAS_BG_ATTR and restores it after load.

/** Read the persisted canvas background color from a saved SVG's root, or null. */
export function getCanvasBg(svg: string): string | null {
  const m = new RegExp(`<svg\\b[^>]*\\s${CANVAS_BG_ATTR}="([^"]*)"`).exec(svg);
  return m ? m[1] : null;
}

/**
 * Return `svg` with the canvas-background attribute set to `color` on the root
 * <svg>, or removed when `color` is null. Any existing attribute is replaced
 * first, so this is idempotent.
 */
export function setCanvasBg(svg: string, color: string | null): string {
  const stripped = svg.replace(
    new RegExp(`\\s${CANVAS_BG_ATTR}="[^"]*"`),
    "",
  );
  if (!color) return stripped;
  return stripped.replace(/<svg\b/, `<svg ${CANVAS_BG_ATTR}="${color}"`);
}

// A gradient canvas background can't be expressed as a CSS color, so the
// CANVAS_BG_ATTR token (and the bgColor threaded into the PNG exporter) carries
// the gradient's SVG markup base64-encoded behind this prefix. Solid colors are
// stored as-is; this keeps both forms in a single string channel.
const GRADIENT_BG_PREFIX = "gradient:";

/** Encode a gradient element's SVG markup into a CANVAS_BG_ATTR-safe token.
 *  Gradient markup is ASCII (tags, numeric offsets, hex colors), so plain
 *  base64 is sufficient and keeps the token free of quotes/whitespace. */
export function encodeGradientBg(gradientXml: string): string {
  return GRADIENT_BG_PREFIX + btoa(gradientXml);
}

/** Decode a CANVAS_BG_ATTR token to gradient markup, or null if it isn't one. */
export function decodeGradientBg(token: string): string | null {
  if (!token.startsWith(GRADIENT_BG_PREFIX)) return null;
  try {
    return atob(token.slice(GRADIENT_BG_PREFIX.length));
  } catch {
    return null;
  }
}

/** Parse a stored gradient's markup into a live element, wrapping it in an
 *  <svg> so the SVG namespace is guaranteed regardless of how it was
 *  serialized. Returns null on malformed input. */
export function parseGradientElement(gradientXml: string): Element | null {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${gradientXml}</svg>`,
    "image/svg+xml",
  );
  if (doc.querySelector("parsererror")) return null;
  return doc.documentElement.firstElementChild;
}

/** Bake a gradient background into an SVG export string: add the gradient to
 *  <defs> and a full-canvas <rect> referencing it as the first (bottom-most)
 *  drawable element. Used so the PNG exporter can render the gradient through
 *  the SVG itself rather than via an (impossible) gradient ctx.fillStyle. */
export function bakeGradientIntoSvg(svg: string, gradientXml: string): string {
  const SVGNS = "http://www.w3.org/2000/svg";
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return svg;
  const root = doc.documentElement;
  const grad = parseGradientElement(gradientXml);
  if (!grad) return svg;

  const id = "obsidian-canvas-bg-gradient";
  grad.setAttribute("id", id);
  let defs = root.querySelector("defs");
  if (!defs) {
    defs = doc.createElementNS(SVGNS, "defs");
    root.insertBefore(defs, root.firstChild);
  }
  defs.appendChild(doc.importNode(grad, true));

  const rect = doc.createElementNS(SVGNS, "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", `url(#${id})`);
  root.insertBefore(rect, root.firstChild);

  return new XMLSerializer().serializeToString(doc);
}

// ── Per-drawing id namespacing (multi-instance fill bug) ───────────────────────
// Obsidian can mount several svgedit editors into the *same* document at once
// (split panes). SVG paint references (`fill="url(#id)"`, `filter`, `clip-path`,
// `href="#id"`, …) resolve document-wide to the *first* matching id, but every
// saved drawing carries ids minted from its own per-document counter (`svg_31`,
// `ellipse_1`, …). So a second drawing's gradient/filter fill binds to the first
// drawing's same-id element — usually not a paint server — and renders with no
// fill (white) until the first drawing closes. svgedit's own fix for external
// multi-instance hosts is the `se:nonce` mechanism: an `se:nonce` on the root
// makes every generated id `type_<nonce>_num`, and the editor honours a nonce it
// finds on load. We stamp a per-file nonce and rewrite the saved drawing's ids
// (and their references) to carry it, so concurrently open drawings never share
// an id. Idempotent: a drawing that already has `se:nonce` is left untouched.

// svgedit reads the nonce from this namespace (see Drawing's constructor).
const SE_NS = "http://svg-edit.googlecode.com";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

/** A stable, compact numeric nonce derived from a string (the file path), so a
 *  given drawing keeps the same id namespace across opens and two different
 *  files get different namespaces. Random fallback for an unsaved (pathless)
 *  drawing, whose ids are transient until it is first written. */
function nonceFromSeed(seed: string): string {
  if (!seed) return String(Math.floor(Math.random() * 1e9) + 1);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  // Keep it non-zero so the namespace is always visibly present.
  return String((h >>> 0) + 1);
}

/** Insert the nonce into an id at svgedit's position — before the first numeric
 *  run, matching its `type_<nonce>_num` scheme (`svg_31` → `svg_<n>_31`,
 *  `svg_7_blur` → `svg_<n>_7_blur`). Ids without a numeric run get the nonce
 *  suffixed, which is enough to make them unique. */
function namespaceId(id: string, nonce: string): string {
  const m = /^([A-Za-z][\w-]*?_)(\d)/.exec(id);
  if (m) return id.replace(/^([A-Za-z][\w-]*?_)(\d)/, `$1${nonce}_$2`);
  return `${id}_${nonce}`;
}

/**
 * Rewrite a saved drawing's element ids — and every `#id` reference in its
 * attribute values — to carry a per-file nonce, so it can't collide with another
 * drawing open in the same document. Stamps `se:nonce` on the root so svgedit
 * keeps minting matching ids for elements created during the session. A no-op
 * (returns the input) when the drawing already carries a nonce or fails to parse.
 */
export function namespaceSvgIds(svg: string, seed: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return svg;
  const root = doc.documentElement;
  if (root.getAttributeNS(SE_NS, "nonce")) return svg; // already namespaced

  const idEls = Array.from(doc.querySelectorAll("[id]"));
  const nonce = nonceFromSeed(seed);
  const map = new Map<string, string>();
  for (const el of idEls) {
    const oldId = el.getAttribute("id");
    if (!oldId) continue;
    const newId = namespaceId(oldId, nonce);
    map.set(oldId, newId);
    el.setAttribute("id", newId);
  }
  if (map.size === 0 && !seed) {
    // Empty drawing with no ids and no path — nothing to namespace yet.
    return svg;
  }

  // Repoint every `#id` reference (url(#id), href="#id", clip-path, mask, …) by
  // rewriting it in any attribute value. The greedy \w+ captures the whole id
  // token, so `svg_3` and `svg_31` are never confused.
  if (map.size > 0) {
    for (const el of Array.from(doc.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        if (!attr.value.includes("#")) continue;
        const next = attr.value.replace(/#([A-Za-z][\w:.-]*)/g, (whole, id) =>
          map.has(id) ? `#${map.get(id)}` : whole,
        );
        if (next !== attr.value) attr.value = next;
      }
    }
  }

  root.setAttributeNS(XMLNS_NS, "xmlns:se", SE_NS);
  root.setAttributeNS(SE_NS, "se:nonce", nonce);
  return new XMLSerializer().serializeToString(doc);
}

// Matches the auto-managed "## Linked Files" section: the heading through every
// following line up to (but not including) the next structural anchor. The
// section now lives under the "# Sketch Editor Data" heading and directly above
// "## Drawing", so the new layout terminates on "## Drawing". The alternation
// also accepts the legacy layout, where the section sat above the
// "%%\n# Sketch Editor Data" opening; the lazy quantifier stops at whichever
// anchor comes first, so old files migrate cleanly on their next save.
// Multiline so ^ anchors each line.
const LINKED_FILES_BLOCK_REGEX = new RegExp(
  `^${escapeRegExp(LINKED_FILES_HEADING)}\\n(?:.*\\n)*?(?=^(?:${escapeRegExp(SVGEDIT_SECTION_OPEN)}|${escapeRegExp(DRAWING_SECTION_HEADING)}))`,
  "m",
);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collect the distinct vault-link wikilink texts present in the SVG, in first-seen order. */
function collectVaultLinks(svg: string): string[] {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const seen = new Set<string>();
  const links: string[] = [];
  for (const el of Array.from(doc.querySelectorAll(`[${VAULT_LINK_ATTR}]`))) {
    const link = el.getAttribute(VAULT_LINK_ATTR)?.trim();
    if (link && !seen.has(link)) {
      seen.add(link);
      links.push(link);
    }
  }
  return links;
}

/**
 * Rebuild the auto-managed "## Linked Files" section to match the vault links
 * still present in the SVG. Links survive as long as ≥1 stamped element remains;
 * the section is removed entirely when none do. The section sits under the
 * "# Sketch Editor Data" heading and just above "## Drawing", inside the `%%`
 * comment. Obsidian still generates real backlinks for wikilinks inside a `%%`
 * comment, so keeping it there hides it from rendered output without losing the
 * backlinks.
 */
export function reconcileLinkedFiles(content: string, svg: string): string {
  // Strip any existing section first so we always rebuild from scratch.
  const stripped = content.replace(LINKED_FILES_BLOCK_REGEX, "");

  const links = collectVaultLinks(svg);
  if (links.length === 0) return stripped;

  const section =
    `${LINKED_FILES_HEADING}\n` + links.map((l) => `- [[${l}]]`).join("\n");

  if (stripped.includes(SVGEDIT_SECTION_OPEN)) {
    // Insert under the section heading; buildBlock writes "\n\n## Drawing" after
    // SVGEDIT_SECTION_OPEN, so the existing blank line separates us from it.
    // Function replacer so "$" sequences in link text aren't treated as patterns.
    return stripped.replace(
      SVGEDIT_SECTION_OPEN,
      () => `${SVGEDIT_SECTION_OPEN}\n\n${section}`,
    );
  }
  return stripped + "\n\n" + section + "\n";
}

/** Generate the initial markdown content for a brand-new drawing file. */
export function createDrawingTemplate(compress: boolean, svg?: string): string {
  const content = svg ?? EMPTY_SVG;
  return `---
${FRONTMATTER_KEY_PLUGIN}: ${FRONTMATTER_PLUGIN_VALUE}
tags:
  - svg
---

${SWITCH_NOTICE}

${buildBlock(content, compress)}
`;
}
