import { App, TFile } from "obsidian";
import { VAULT_LINK_ATTR, VAULT_LOCKED_ATTR, VAULT_EXTERNAL_ATTR } from "../constants";
import {
  drawingSourceFor,
  readDrawingSvg,
  fileToDataUri,
  fileToResourceUrl,
  svgToDataUri,
} from "../modals/vaultImage";
import { prepareSvgForExport } from "../export/frames";

const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * Re-bake every "locked" import (`[data-vault-locked]`) from its current source,
 * and re-resolve every "linked" import (`[data-vault-external]`) to a fresh
 * vault resource path, so a drawing always shows the latest version of what it
 * embeds/references. Unlocked imports (which carry only `data-vault-link`) are
 * left as frozen snapshots.
 *
 * The source is resolved from the element's `data-vault-link` wikilink text
 * (e.g. `note` or `note#frame`). Drawing sources are re-rendered as SVG (cropped
 * to the frame when one is named); plain image sources are re-read as-is. Any
 * link that no longer resolves is left untouched, keeping the last good snapshot.
 */
export async function refreshLockedEmbeds(
  app: App,
  svg: string,
  drawingPath: string,
): Promise<string> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const tracked = Array.from(
    doc.querySelectorAll(`image[${VAULT_LOCKED_ATTR}], image[${VAULT_EXTERNAL_ATTR}]`),
  );
  if (tracked.length === 0) return svg;

  let changed = false;
  for (const el of tracked) {
    const link = el.getAttribute(VAULT_LINK_ATTR)?.trim();
    if (!link) continue;

    const hashIdx = link.indexOf("#");
    const base = hashIdx >= 0 ? link.slice(0, hashIdx) : link;
    const frame = hashIdx >= 0 ? link.slice(hashIdx + 1) : "";

    const file = app.metadataCache.getFirstLinkpathDest(base, drawingPath);
    if (!(file instanceof TFile)) continue;

    const href = el.hasAttribute(VAULT_EXTERNAL_ATTR)
      ? fileToResourceUrl(app, file)
      : await bakeHref(app, file, frame);
    if (!href) continue;

    setImageHref(el, href);
    changed = true;
  }

  return changed ? new XMLSerializer().serializeToString(doc) : svg;
}

/**
 * Resolve every "linked" import (`[data-vault-external]`) to a fresh embedded
 * data URI, for a one-off export snapshot. Linked images stay external
 * (an `app://` resource URL) in the live drawing so it stays lightweight — but
 * that URL only resolves inside this vault's running Obsidian instance, so
 * PNG/SVG export must embed the bytes instead or the exported file (rasterized
 * or opened outside Obsidian) shows a broken image.
 */
export async function bakeExternalEmbedsForExport(
  app: App,
  svg: string,
  drawingPath: string,
): Promise<string> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const external = Array.from(doc.querySelectorAll(`image[${VAULT_EXTERNAL_ATTR}]`));
  if (external.length === 0) return svg;

  let changed = false;
  for (const el of external) {
    const link = el.getAttribute(VAULT_LINK_ATTR)?.trim();
    if (!link) continue;
    const base = link.split("#")[0];
    const file = app.metadataCache.getFirstLinkpathDest(base, drawingPath);
    if (!(file instanceof TFile)) continue;

    setImageHref(el, await fileToDataUri(app, file));
    changed = true;
  }

  return changed ? new XMLSerializer().serializeToString(doc) : svg;
}

/** Produce a fresh data-URI for a locked source, or null if it can't be read. */
async function bakeHref(app: App, file: TFile, frame: string): Promise<string | null> {
  const drawing = drawingSourceFor(app, file);
  if (drawing) {
    const srcSvg = await readDrawingSvg(app, drawing);
    if (!srcSvg) return null;
    return svgToDataUri(prepareSvgForExport(srcSvg, frame));
  }
  return fileToDataUri(app, file);
}

/** Set both `href` and `xlink:href` so any svgedit serialization picks it up. */
function setImageHref(el: Element, href: string): void {
  el.setAttribute("href", href);
  el.setAttributeNS(XLINK_NS, "xlink:href", href);
}
