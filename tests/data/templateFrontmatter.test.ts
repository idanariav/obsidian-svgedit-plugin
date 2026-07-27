import { describe, it, expect } from "vitest";
import { stripTemplaterSyntax, applyTemplateFrontmatter } from "../../src/data/templateFrontmatter";

describe("stripTemplaterSyntax", () => {
  it("drops the <%* ... -%> script block and any line with a leftover <% %> tag", () => {
    // Mirrors the real sketch_template.md frontmatter shape this feature was
    // built against: a script block, a tp.file.include, static placeholder
    // fields, and fields whose value only Templater's engine can compute.
    const block = [
      "<%*",
      "await tp.user.renameIfUntitled(tp)",
      "const title = tp.file.title",
      "const tagName = `Type/Sketch`",
      "const imageName = `${title}.png`",
      "-%>",
      "<% tp.file.include('[[metadata_template]]') %>",
      "sketch-editor-plugin: parsed",
      "Description:",
      "KeyProblem:",
      "Image: \"[[<%imageName %>]]\"",
      "tags: [<% tagName %>]",
      "ContentStatus: Ideas",
      "aliases:",
    ].join("\n");

    expect(stripTemplaterSyntax(block).split("\n")).toEqual([
      "sketch-editor-plugin: parsed",
      "Description:",
      "KeyProblem:",
      "ContentStatus: Ideas",
      "aliases:",
    ]);
  });

  it("passes plain YAML through untouched when there's no Templater syntax", () => {
    const block = "sketch-editor-plugin: parsed\nsketch-editor-auto-export:";
    expect(stripTemplaterSyntax(block)).toBe(block);
  });

  it("handles a script block that closes with a bare %> (no trim marker)", () => {
    const block = ["<%*", "const x = 1", "%>", "Version: 0"].join("\n");
    expect(stripTemplaterSyntax(block).trim()).toBe("Version: 0");
  });
});

describe("applyTemplateFrontmatter", () => {
  it("fills in fields the note doesn't already have", () => {
    const fm: Record<string, unknown> = {};
    applyTemplateFrontmatter(fm, { Description: null, ContentStatus: "Ideas" });
    expect(fm).toEqual({ Description: null, ContentStatus: "Ideas" });
  });

  it("never overwrites a field the note already set", () => {
    const fm: Record<string, unknown> = { Source: ["[[Some Note]]"] };
    applyTemplateFrontmatter(fm, { Source: null });
    expect(fm.Source).toEqual(["[[Some Note]]"]);
  });

  it("skips the plugin's own marker key and tags even if present in the template", () => {
    const fm: Record<string, unknown> = {};
    applyTemplateFrontmatter(fm, { "sketch-editor-plugin": "parsed", tags: ["Type/Sketch"] });
    expect(fm).toEqual({});
  });
});
