import {
  App,
  MarkdownPostProcessorContext,
  TFile,
  normalizePath,
} from "obsidian";
import { isSvgDrawingFile } from "../data/frontmatter";
import { VIEW_TYPE_SVG } from "../constants";

/**
 * For every internal image embed (![[drawing.png]] or ![[drawing.svg]]) whose
 * companion .md file is a SVG drawing, rewrite the click handler to open the
 * source drawing in SvgView instead of navigating to the image file.
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
    if (!/\.(png|svg)$/i.test(src)) continue;

    const sourceMd = findSourceMd(app, src);
    if (!sourceMd) continue;

    embed.style.cursor = "pointer";
    embed.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const leaf = app.workspace.getLeaf(false);
      leaf.openFile(sourceMd, { active: true });
    });
  }
}

function findSourceMd(app: App, imageSrc: string): TFile | null {
  const mdPath = normalizePath(
    imageSrc.replace(/\.(png|svg)$/i, ".md"),
  );
  const candidate = app.vault.getAbstractFileByPath(mdPath);
  if (candidate instanceof TFile && isSvgDrawingFile(app, candidate)) {
    return candidate;
  }

  // Also try resolving relative to the vault root via metadataCache link resolution
  const resolved = app.metadataCache.getFirstLinkpathDest(
    imageSrc.replace(/\.(png|svg)$/i, ""),
    "",
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
