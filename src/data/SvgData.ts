import {
  DRAWING_SECTION_HEADING,
  DRAWING_FENCE_OPEN,
  DRAWING_FENCE_CLOSE,
  DRAWING_SECTION_END,
  EMPTY_SVG,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
  SWITCH_NOTICE,
} from "../constants";

// Matches the fenced SVG block between the ## Drawing heading and the %% terminator.
// Captures only the SVG content inside the fence.
const BLOCK_REGEX =
  /## Drawing\n```svg\n([\s\S]*?)\n```\s*\n%%/;

const BLOCK_REPLACE_REGEX =
  /## Drawing\n```svg\n[\s\S]*?\n```\s*\n%%/;

/** Extract the SVG string from a markdown drawing file. Returns null if not found. */
export function extractSvg(content: string): string | null {
  const m = BLOCK_REGEX.exec(content);
  return m ? m[1] : null;
}

/** Replace the SVG block in an existing markdown drawing file with new SVG content. */
export function replaceSvg(content: string, newSvg: string): string {
  const block = buildBlock(newSvg);
  if (BLOCK_REPLACE_REGEX.test(content)) {
    return content.replace(BLOCK_REPLACE_REGEX, block);
  }
  return content + "\n\n" + block;
}

function buildBlock(svg: string): string {
  return `${DRAWING_SECTION_HEADING}\n${DRAWING_FENCE_OPEN}\n${svg}\n${DRAWING_FENCE_CLOSE}\n${DRAWING_SECTION_END}`;
}

/** Generate the initial markdown content for a brand-new drawing file. */
export function createDrawingTemplate(svg?: string): string {
  const content = svg ?? EMPTY_SVG;
  return `---
${FRONTMATTER_KEY_PLUGIN}: ${FRONTMATTER_PLUGIN_VALUE}
tags:
  - svg
---

${SWITCH_NOTICE}

${buildBlock(content)}
`;
}
