/**
 * Coverage for the "note with a Drawings frontmatter field" hover-preview
 * branch of markdownPostProcessor: resolving the linked drawings from
 * frontmatterLinks, rendering the first one with prev/next arrows when
 * there's more than one, cycling between them on arrow click without
 * triggering the click-through-to-note handler, and staying off when the
 * field setting is empty or the links don't resolve to actual drawings.
 *
 * The sibling "hover a link straight to a drawing note" path
 * (renderDrawingHoverPreview) predates this file and isn't re-covered here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile } from "../mocks/obsidian";
import { markdownPostProcessor } from "../../src/postprocessor/markdownPostProcessor";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { replaceSvg } from "../../src/data/SvgData";
import { FRONTMATTER_KEY_PLUGIN, FRONTMATTER_PLUGIN_VALUE } from "../../src/constants";

function drawingFile(svg: string): string {
  return replaceSvg("---\nplugin: svg-drawing\n---\n", svg, false);
}

interface FrontmatterLink {
  key: string;
  link: string;
  original: string;
}

function makeApp() {
  const files = new Map<string, TFile>();
  const contents = new Map<string, string>();
  const drawingPaths = new Set<string>();
  const frontmatterLinksByPath = new Map<string, FrontmatterLink[]>();
  const openFile = vi.fn();

  function addFile(path: string, basename: string): TFile {
    const f = new TFile();
    f.path = path;
    f.basename = basename;
    files.set(path, f);
    return f;
  }

  const drawingA = addFile("drawingA.md", "drawingA");
  const drawingB = addFile("drawingB.md", "drawingB");
  drawingPaths.add(drawingA.path);
  drawingPaths.add(drawingB.path);
  contents.set(drawingA.path, drawingFile('<svg><rect id="a" width="1" height="1"/></svg>'));
  contents.set(drawingB.path, drawingFile('<svg><rect id="b" width="1" height="1"/></svg>'));

  const notDrawing = addFile("notDrawing.md", "notDrawing"); // linked but not a drawing note
  contents.set(notDrawing.path, "just a normal note");

  const note = addFile("note.md", "note");
  frontmatterLinksByPath.set(note.path, [
    { key: "Drawings.0", link: "drawingA", original: "[[drawingA]]" },
    { key: "Drawings.1", link: "drawingB", original: "[[drawingB]]" },
  ]);

  const noteSingle = addFile("note-single.md", "note-single");
  frontmatterLinksByPath.set(noteSingle.path, [
    { key: "Drawings", link: "drawingA", original: "[[drawingA]]" },
  ]);

  const noteBadLink = addFile("note-bad-link.md", "note-bad-link");
  frontmatterLinksByPath.set(noteBadLink.path, [
    { key: "Drawings", link: "notDrawing", original: "[[notDrawing]]" },
  ]);

  const app = {
    vault: {
      getAbstractFileByPath: (p: string) => files.get(p) ?? null,
      cachedRead: async (f: TFile) => contents.get(f.path) ?? "",
    },
    metadataCache: {
      getFileCache: (f: TFile) => ({
        frontmatter: drawingPaths.has(f.path)
          ? { [FRONTMATTER_KEY_PLUGIN]: FRONTMATTER_PLUGIN_VALUE }
          : {},
        frontmatterLinks: frontmatterLinksByPath.get(f.path),
      }),
      getFirstLinkpathDest: (linktext: string) =>
        [...files.values()].find((f) => f.basename === linktext) ?? null,
    },
    workspace: {
      getLeaf: () => ({ openFile }),
    },
  };

  return { app, files, openFile };
}

/** Build a `.hover-popover > .markdown-embed > containerEl` DOM shell, as
 *  Obsidian's page-preview core plugin would when rendering a link's hover
 *  preview into a markdown post-processor call. */
function makePopover() {
  const popover = document.createElement("div");
  popover.className = "hover-popover";
  const nativeContent = document.createElement("div");
  nativeContent.className = "markdown-embed";
  popover.appendChild(nativeContent);
  const containerEl = document.createElement("div");
  nativeContent.appendChild(containerEl);
  return { popover, nativeContent, containerEl };
}

function ctxFor(sourcePath: string, containerEl: HTMLElement) {
  return { sourcePath, containerEl } as unknown as Parameters<typeof markdownPostProcessor>[1];
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe("markdownPostProcessor — note Drawings field hover preview", () => {
  let app: ReturnType<typeof makeApp>["app"];
  let openFile: ReturnType<typeof vi.fn>;
  const settings = { ...DEFAULT_SETTINGS, noteDrawingsField: "Drawings" };

  beforeEach(() => {
    const made = makeApp();
    app = made.app;
    openFile = made.openFile;
  });

  it("renders the first linked drawing with prev/next arrows when there's more than one", async () => {
    const { popover, nativeContent, containerEl } = makePopover();

    await markdownPostProcessor(containerEl, ctxFor("note.md", containerEl), app as any, settings);

    expect(nativeContent.style.display).toBe("none");
    const wrap = popover.querySelector(".svg-hover-preview");
    expect(wrap).not.toBeNull();
    expect(wrap!.querySelector(".svg-hover-preview-art svg rect")?.getAttribute("id")).toBe("a");
    expect(popover.querySelector(".svg-hover-preview-prev")).not.toBeNull();
    expect(popover.querySelector(".svg-hover-preview-next")).not.toBeNull();
  });

  it("cycles forward and wraps around backward through the linked drawings", async () => {
    const { popover, containerEl } = makePopover();
    await markdownPostProcessor(containerEl, ctxFor("note.md", containerEl), app as any, settings);

    const art = () => popover.querySelector(".svg-hover-preview-art svg rect")?.getAttribute("id");
    const next = popover.querySelector<HTMLElement>(".svg-hover-preview-next")!;
    const prev = popover.querySelector<HTMLElement>(".svg-hover-preview-prev")!;

    expect(art()).toBe("a");
    next.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    expect(art()).toBe("b");

    next.dispatchEvent(new MouseEvent("click", { bubbles: true })); // wraps back to first
    await flush();
    expect(art()).toBe("a");

    prev.dispatchEvent(new MouseEvent("click", { bubbles: true })); // wraps to last
    await flush();
    expect(art()).toBe("b");
  });

  it("opens the hovered note (not the shown drawing) when the preview area is clicked", async () => {
    const { popover, containerEl } = makePopover();
    await markdownPostProcessor(containerEl, ctxFor("note.md", containerEl), app as any, settings);

    popover.querySelector<HTMLElement>(".svg-hover-preview")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openFile.mock.calls[0][0].path).toBe("note.md");
  });

  it("does not open the note when an arrow is clicked (stopPropagation)", async () => {
    const { popover, containerEl } = makePopover();
    await markdownPostProcessor(containerEl, ctxFor("note.md", containerEl), app as any, settings);

    popover.querySelector<HTMLElement>(".svg-hover-preview-next")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    expect(openFile).not.toHaveBeenCalled();
  });

  it("renders without arrows when only one drawing is linked", async () => {
    const { popover, containerEl } = makePopover();
    await markdownPostProcessor(containerEl, ctxFor("note-single.md", containerEl), app as any, settings);

    expect(popover.querySelector(".svg-hover-preview")).not.toBeNull();
    expect(popover.querySelector(".svg-hover-preview-prev")).toBeNull();
    expect(popover.querySelector(".svg-hover-preview-next")).toBeNull();
  });

  it("does nothing when noteDrawingsField is unset (feature off)", async () => {
    const { popover, nativeContent, containerEl } = makePopover();
    await markdownPostProcessor(
      containerEl,
      ctxFor("note.md", containerEl),
      app as any,
      { ...DEFAULT_SETTINGS, noteDrawingsField: "" },
    );

    expect(popover.querySelector(".svg-hover-preview")).toBeNull();
    expect(nativeContent.style.display).not.toBe("none");
  });

  it("does nothing when the linked entries don't resolve to actual drawing notes", async () => {
    const { popover, containerEl } = makePopover();
    await markdownPostProcessor(containerEl, ctxFor("note-bad-link.md", containerEl), app as any, settings);

    expect(popover.querySelector(".svg-hover-preview")).toBeNull();
  });
});
