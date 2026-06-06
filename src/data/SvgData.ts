import {
  SVGEDIT_SECTION_OPEN,
  DRAWING_SECTION_HEADING,
  DRAWING_FENCE_OPEN,
  DRAWING_FENCE_CLOSE,
  DRAWING_SECTION_END,
  EMPTY_SVG,
  FRONTMATTER_KEY_PLUGIN,
  FRONTMATTER_PLUGIN_VALUE,
  SWITCH_NOTICE,
  LINKED_FILES_HEADING,
  VAULT_LINK_ATTR,
} from "../constants";

// Matches the fenced SVG block between the ## Drawing heading and the %% terminator.
// Captures only the SVG content inside the fence. The optional `%%\n# SVGEdit Data`
// prefix may sit just above (new format); BLOCK_REGEX only needs the inner block.
const BLOCK_REGEX =
  /## Drawing\n```svg\n([\s\S]*?)\n```\s*\n%%/;

// Same block, including the optional `%%\n# SVGEdit Data` wrapper opening that
// precedes it in the current format. Matching the opening too means rebuilding
// the block also migrates legacy (un-wrapped) files to the wrapped layout.
const BLOCK_REPLACE_REGEX =
  /(?:%%\n# SVGEdit Data\n+)?## Drawing\n```svg\n[\s\S]*?\n```\s*\n%%/;

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
  return (
    `${SVGEDIT_SECTION_OPEN}\n\n` +
    `${DRAWING_SECTION_HEADING}\n${DRAWING_FENCE_OPEN}\n${svg}\n${DRAWING_FENCE_CLOSE}\n${DRAWING_SECTION_END}`
  );
}

// Matches the auto-managed "## Linked Files" section: the heading through every
// following line up to (but not including) the "%%\n# SVGEdit Data" opening that
// always follows it. Multiline so ^ anchors each line.
const LINKED_FILES_BLOCK_REGEX = new RegExp(
  `^${escapeRegExp(LINKED_FILES_HEADING)}\\n(?:.*\\n)*?(?=^${escapeRegExp(SVGEDIT_SECTION_OPEN)})`,
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
 * the section is removed entirely when none do. The section sits above the
 * %%-hidden "# SVGEdit Data" section so its wikilinks stay outside the comment
 * and produce real Obsidian backlinks.
 */
export function reconcileLinkedFiles(content: string, svg: string): string {
  // Strip any existing section first so we always rebuild from scratch.
  const stripped = content.replace(LINKED_FILES_BLOCK_REGEX, "");

  const links = collectVaultLinks(svg);
  if (links.length === 0) return stripped;

  const section =
    `${LINKED_FILES_HEADING}\n` +
    links.map((l) => `- [[${l}]]`).join("\n") +
    "\n\n";

  if (stripped.includes(SVGEDIT_SECTION_OPEN)) {
    // Function replacer so "$" sequences in link text aren't treated as patterns.
    return stripped.replace(SVGEDIT_SECTION_OPEN, () => section + SVGEDIT_SECTION_OPEN);
  }
  return stripped + "\n\n" + section.trimEnd() + "\n";
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
