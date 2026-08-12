import {
  App,
  MarkdownPostProcessorContext,
  TFile,
  normalizePath,
} from "obsidian";
import { isSvgDrawingFile } from "../data/frontmatter";
import { extractSvg, getCanvasBg, decodeGradientBg, bakeGradientIntoSvg } from "../data/SvgData";
import { listFrames, prepareSvgForExport } from "../export/frames";
import type { SvgPluginSettings } from "../settings/defaults";

/**
 * Two kinds of internal embeds are handled:
 *
 * 1. `![[drawing#frame]]` — a drawing note embedded with a frame subpath renders
 *    that frame's region inline (cropped from the drawing's current SVG).
 * 2. `![[drawing.png]]` / `![[drawing.svg]]` — an image whose companion .md is a
 *    drawing gets a click handler that opens the source drawing in SvgView
 *    instead of navigating to the image file.
 *
 * Plus, inside a hover-preview popover:
 *
 * - Hovering a link to a drawing note itself replaces the raw markdown (the
 *   switch notice + hidden data block) with the rendered drawing — see
 *   renderDrawingHoverPreview.
 * - Hovering a link to a regular note that has links in its
 *   `settings.noteDrawingsField` frontmatter field replaces the note preview
 *   with one of those drawings, with prev/next arrows when there's more than
 *   one — see renderNoteDrawingsHoverPreview.
 */
export async function markdownPostProcessor(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  app: App,
  settings: SvgPluginSettings,
): Promise<void> {
  // `containerEl` is the (undocumented) element the post-processor renders into.
  // When it sits inside a `.hover-popover`, we're rendering a link's hover
  // preview rather than the document itself.
  const containerEl = (ctx as unknown as { containerEl?: HTMLElement }).containerEl;
  if (containerEl?.closest(".hover-popover")) {
    const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (file instanceof TFile) {
      if (isSvgDrawingFile(app, file)) {
        await renderDrawingHoverPreview(app, file, containerEl);
        return;
      }
      if (settings.noteDrawingsField) {
        const drawings = resolveNoteDrawings(app, file, settings.noteDrawingsField);
        if (drawings.length > 0) {
          await renderNoteDrawingsHoverPreview(app, file, containerEl, drawings);
          return;
        }
      }
    }
  }

  const embeds = el.querySelectorAll<HTMLElement>(".internal-embed");
  if (embeds.length === 0) return;

  for (const embed of Array.from(embeds)) {
    const src = embed.getAttribute("src");
    if (!src) continue;

    const hashIdx = src.indexOf("#");
    if (hashIdx > 0) {
      await renderFrameEmbed(embed, src, hashIdx, ctx, app);
      continue;
    }

    if (!/\.(png|svg)$/i.test(src)) continue;
    const sourceMd = findSourceMd(app, src, ctx.sourcePath);
    if (!sourceMd) continue;
    bindOpenSource(embed, app, sourceMd);
  }
}

/**
 * Render `![[drawing#frame]]` as the cropped frame, inline. Leaves the embed
 * untouched (default Obsidian behavior) if the base isn't a drawing or the
 * subpath doesn't name a frame.
 */
async function renderFrameEmbed(
  embed: HTMLElement,
  src: string,
  hashIdx: number,
  ctx: MarkdownPostProcessorContext,
  app: App,
): Promise<void> {
  if (embed.dataset.svgFrame) return; // already rendered

  const base = src.slice(0, hashIdx);
  const subpath = src.slice(hashIdx + 1).trim();
  if (!subpath) return;

  const file = app.metadataCache.getFirstLinkpathDest(base, ctx.sourcePath);
  if (!(file instanceof TFile) || !isSvgDrawingFile(app, file)) return;

  const svg = extractSvg(await app.vault.cachedRead(file));
  if (!svg) return;

  const frame = listFrames(svg).find((f) => f.name === subpath);
  if (!frame) return;

  const cropped = prepareSvgForExport(svg, frame.name);
  const svgEl = new DOMParser().parseFromString(cropped, "image/svg+xml")
    .documentElement;

  embed.empty();
  embed.dataset.svgFrame = "1";
  embed.addClass("svg-frame-embed");
  embed.appendChild(document.importNode(svgEl, true));
  bindOpenSource(embed, app, file);
}

/**
 * Parse a drawing's raw SVG text into a preview-ready element: frame rects
 * stripped (as in export), the canvas background restored (it's editor chrome,
 * not part of the document — see SvgData.ts's CANVAS_BG_ATTR comment — so a
 * gradient is baked back in as a backing rect and a solid color is applied as
 * inline CSS), and a synthesized viewBox if the drawing is missing one (svgedit
 * doesn't always keep viewBox in sync with width/height after a canvas resize;
 * without it the CSS fit-to-box sizing can't scale the content down — it just
 * clips to the shrunk box).
 */
function buildDrawingPreviewElement(svg: string): Element {
  const bgToken = getCanvasBg(svg);
  const gradientXml = bgToken ? decodeGradientBg(bgToken) : null;
  let prepared = prepareSvgForExport(svg);
  if (gradientXml) prepared = bakeGradientIntoSvg(prepared, gradientXml);

  const svgEl = new DOMParser().parseFromString(prepared, "image/svg+xml").documentElement;

  if (!svgEl.hasAttribute("viewBox")) {
    const w = svgEl.getAttribute("width");
    const h = svgEl.getAttribute("height");
    if (w && h) svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  if (bgToken && !gradientXml) {
    svgEl.setAttribute("style", `${svgEl.getAttribute("style") ?? ""};background-color:${bgToken}`);
  }

  return svgEl;
}

/**
 * Replace a drawing note's hover preview with the rendered drawing.
 *
 * A drawing note's markdown is just a switch notice and a `%%`-hidden data
 * block, so its native page preview shows nothing useful. The whole drawing is
 * rendered into the popover instead, and clicking it opens the drawing. The
 * native markdown content is hidden, and a dataset flag on the popover keeps
 * this to a single render even though the post-processor fires once per
 * rendered block.
 */
async function renderDrawingHoverPreview(
  app: App,
  file: TFile,
  containerEl: HTMLElement,
): Promise<void> {
  const popover = containerEl.closest<HTMLElement>(".hover-popover");
  if (!popover || popover.dataset.svgHoverPreview) return;
  popover.dataset.svgHoverPreview = "1"; // claim synchronously before awaiting

  const svg = extractSvg(await app.vault.cachedRead(file));
  if (!svg) {
    delete popover.dataset.svgHoverPreview; // nothing to show; let native render
    return;
  }

  // Hide the native markdown content and inject the drawing alongside it.
  const nativeContent = containerEl.closest<HTMLElement>(".markdown-embed");
  if (nativeContent) nativeContent.style.display = "none";

  const wrap = popover.createDiv({ cls: "svg-hover-preview" });
  wrap.appendChild(document.importNode(buildDrawingPreviewElement(svg), true));
  bindOpenSource(wrap, app, file);
}

/**
 * Resolve the drawing files linked from a note's `fieldName` frontmatter
 * field (a single link or a list, as written by "New drawing for this file" —
 * see `addFrontmatterLink` in commands.ts). Entries that don't resolve to an
 * actual drawing note are skipped.
 */
function resolveNoteDrawings(app: App, file: TFile, fieldName: string): TFile[] {
  const links = app.metadataCache.getFileCache(file)?.frontmatterLinks;
  if (!links) return [];

  const seen = new Set<string>();
  const drawings: TFile[] = [];
  for (const fl of links) {
    if (fl.key !== fieldName && !fl.key.startsWith(`${fieldName}.`)) continue;
    const dest = app.metadataCache.getFirstLinkpathDest(fl.link, file.path);
    if (dest instanceof TFile && isSvgDrawingFile(app, dest) && !seen.has(dest.path)) {
      seen.add(dest.path);
      drawings.push(dest);
    }
  }
  return drawings;
}

/**
 * Replace a regular note's hover preview with one of the drawings linked from
 * its `noteDrawingsField` frontmatter, with prev/next arrows to cycle between
 * them when there's more than one. Clicking anywhere opens the hovered note
 * (not the drawing) — same click-through as `renderDrawingHoverPreview`, just
 * pointed at the note being hovered instead of the drawing being shown.
 */
async function renderNoteDrawingsHoverPreview(
  app: App,
  file: TFile,
  containerEl: HTMLElement,
  drawings: TFile[],
): Promise<void> {
  const popover = containerEl.closest<HTMLElement>(".hover-popover");
  if (!popover || popover.dataset.svgHoverPreview) return;
  popover.dataset.svgHoverPreview = "1"; // claim synchronously before awaiting

  const nativeContent = containerEl.closest<HTMLElement>(".markdown-embed");
  if (nativeContent) nativeContent.style.display = "none";

  const wrap = popover.createDiv({ cls: "svg-hover-preview" });
  bindOpenSource(wrap, app, file);
  const artEl = wrap.createDiv({ cls: "svg-hover-preview-art" });

  let index = 0;
  const showAt = async (i: number): Promise<void> => {
    artEl.empty();
    const svg = extractSvg(await app.vault.cachedRead(drawings[i]));
    if (svg) artEl.appendChild(document.importNode(buildDrawingPreviewElement(svg), true));
  };

  if (drawings.length > 1) {
    const step = (delta: number) => (evt: MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation(); // don't let the click-through-to-note handler on `wrap` fire
      index = (index + delta + drawings.length) % drawings.length;
      void showAt(index);
    };
    wrap.createDiv({ cls: "svg-hover-preview-nav svg-hover-preview-prev", text: "‹" })
      .addEventListener("click", step(-1));
    wrap.createDiv({ cls: "svg-hover-preview-nav svg-hover-preview-next", text: "›" })
      .addEventListener("click", step(1));
  }

  await showAt(index);
}

/** Make clicking the embed open the source drawing in SvgView. */
function bindOpenSource(embed: HTMLElement, app: App, sourceMd: TFile): void {
  embed.style.cursor = "pointer";
  embed.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    const leaf = app.workspace.getLeaf(false);
    leaf.openFile(sourceMd, { active: true });
  });
}

function findSourceMd(app: App, imageSrc: string, sourcePath: string): TFile | null {
  const mdPath = normalizePath(
    imageSrc.replace(/\.(png|svg)$/i, ".md"),
  );
  const candidate = app.vault.getAbstractFileByPath(mdPath);
  if (candidate instanceof TFile && isSvgDrawingFile(app, candidate)) {
    return candidate;
  }

  // Also try resolving relative to the source note via metadataCache link resolution
  const resolved = app.metadataCache.getFirstLinkpathDest(
    imageSrc.replace(/\.(png|svg)$/i, ""),
    sourcePath,
  );
  if (resolved) {
    const mdPath2 = normalizePath(resolved.path.replace(/\.(png|svg)$/i, ".md"));
    const candidate2 = app.vault.getAbstractFileByPath(mdPath2);
    if (candidate2 instanceof TFile && isSvgDrawingFile(app, candidate2)) {
      return candidate2;
    }
  }

  return null;
}
