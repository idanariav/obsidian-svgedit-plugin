/**
 * Frame support for export.
 *
 * A "frame" is a `<rect data-frame="1">` element (created by the svgedit Frame
 * tool) with a child `<title>` giving its name. Frames mark export regions: they
 * must never appear in an exported image, and an export can optionally be cropped
 * to a single frame's bounds.
 */

export interface FrameInfo {
  /** Frame element id (unique within the document). */
  id: string;
  /** Frame name from its `<title>`, falling back to "Frame N". */
  name: string;
}

/** List the frames present in an SVG string, in document order. */
export function listFrames(svgString: string): FrameInfo[] {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  return Array.from(doc.querySelectorAll("[data-frame]")).map((f, i) => ({
    id: f.id,
    name: frameName(f, i),
  }));
}

/**
 * Produce the SVG string to export.
 *
 * Frame rects are always stripped so they never appear in the output. When
 * `frameName` names a frame present in the drawing, the viewBox is narrowed to
 * that frame's bounds and an explicit intrinsic width/height is set (the raster
 * path reads these to size the canvas) so only that region is exported. If the
 * name is empty or matches no frame, the whole canvas is exported.
 */
export function prepareSvgForExport(svgString: string, frameName = ""): string {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const root = doc.documentElement;

  // Resolve the crop box from the named frame *before* removing frames.
  const crop = frameName ? findFrameBounds(root, frameName) : null;

  // Frames mark export regions and must never appear in an exported image.
  root.querySelectorAll("[data-frame]").forEach((f) => f.remove());

  if (crop) {
    root.setAttribute("viewBox", `${crop.x} ${crop.y} ${crop.w} ${crop.h}`);
    root.setAttribute("width", String(crop.w));
    root.setAttribute("height", String(crop.h));
  }

  return new XMLSerializer().serializeToString(root);
}

function frameName(frame: Element, index: number): string {
  const title = frame.querySelector("title")?.textContent?.trim();
  return title || `Frame ${index + 1}`;
}

/**
 * Find the bounds of the first frame whose name matches `name`. Frame x/y/
 * width/height attributes are authoritative (svgedit bakes transforms into them
 * on edit). Returns null if no frame matches or it has no usable size.
 */
function findFrameBounds(
  root: Element,
  name: string,
): { x: number; y: number; w: number; h: number } | null {
  const frames = Array.from(root.querySelectorAll("[data-frame]"));
  const match = frames.find((f, i) => frameName(f, i) === name);
  if (!match) return null;

  const num = (attr: string): number => Number(match.getAttribute(attr));
  const x = num("x");
  const y = num("y");
  const w = num("width");
  const h = num("height");
  if (!w || !h) return null;
  return { x, y, w, h };
}
