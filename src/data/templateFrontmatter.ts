import { FRONTMATTER_KEY_PLUGIN } from "../constants";

/**
 * Drop Templater syntax from a raw frontmatter block, leaving only lines that
 * could be valid plain YAML: a `<%* ... %>` script block is removed entirely,
 * then any remaining line still containing an inline `<% ... %>` tag (a value
 * only Templater's own engine could compute, e.g. `tags: [<% tagName %>]`) is
 * dropped rather than kept half-rendered. A line referencing
 * `tp.file.include(...)` — which tells Templater to splice in a *different*
 * file's frontmatter — is dropped the same way, since following it would mean
 * reimplementing Templater's include resolution; see resolveTemplateFrontmatter
 * in commands.ts (or, better, tryCreateDrawingViaTemplater, which runs the
 * template through Templater itself instead of relying on this).
 */
export function stripTemplaterSyntax(frontmatterBlock: string): string {
  const withoutScriptBlocks = frontmatterBlock.replace(/<%\*[\s\S]*?-?%>\n?/g, "");
  return withoutScriptBlocks
    .split("\n")
    .filter((line) => !line.includes("<%") && !line.includes("%>"))
    .join("\n");
}

/** Fill in frontmatter keys from the template that the note doesn't already
 *  have. Skips the plugin's own marker key and "tags" (merged separately via
 *  applyDrawingTag in commands.ts) so the template can't clobber plugin-managed
 *  fields. */
export function applyTemplateFrontmatter(
  fm: Record<string, unknown>,
  fields: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (key === FRONTMATTER_KEY_PLUGIN || key === "tags") continue;
    if (fm[key] === undefined) fm[key] = value;
  }
}
