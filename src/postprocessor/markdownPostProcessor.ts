import {
  App,
  MarkdownPostProcessorContext,
  TFile,
  normalizePath,
} from "obsidian";
import { isSvgDrawingFile } from "../data/frontmatter";
import { extractSvg } from "../data/SvgData";
import { listFrames, prepareSvgForExport } from "../export/frames";

/**
 * Two kinds of internal embeds are handled:
 *
 * 1. `![[drawing#frame]]` — a drawing note embedded with a frame subpath renders
 *    that frame's region inline (cropped from the drawing's current SVG).
 * 2. `![[drawing.png]]` / `![[drawing.svg]]` — an image whose companion .md is a
 *    drawing gets a click handler that opens the source drawing in SvgView
 *    instead of navigating to the image file.
 */
export async function markdownPostProcessor(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  app: App,
): Promise<void> {
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
