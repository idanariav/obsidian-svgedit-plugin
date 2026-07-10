/**
 * Static guard against SvgView re-declaring a field TextFileView already owns.
 * Obsidian's TextFileView internally owns `saving`, `dirty`, `data`,
 * `lastSavedData`, `saveAgain` and `requestSave` (undocumented in the `obsidian`
 * package's public .d.ts, so nothing else catches this). Shadowing one silently
 * breaks the base class's own logic instead of throwing — e.g. a private
 * `saving` field made `TextFileView.save()`'s own `if (this.saving) return;`
 * guard see it as always-busy, turning every save into a no-op with no error
 * (see .claude/techdebt.md history / commit eab19f5's incident). SvgView.ts
 * uses `svgSaving`/`svgDirty`/`currentData` specifically to avoid this.
 *
 * This can't be a runtime instantiation test: the installed `obsidian` package
 * is types-only (no JS at "main"), so `class SvgView extends TextFileView`
 * has nothing real to shadow at runtime. Instead this parses SvgView's own
 * class-member declarations (2-space-indented lines, the file's consistent
 * top-level member indent) and checks their names directly.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const SVG_VIEW_PATH = resolve(__dirname, "../../src/view/SvgView.ts");

const RESERVED_TEXTFILEVIEW_FIELDS = new Set([
  "saving",
  "dirty",
  "data",
  "lastSavedData",
  "saveAgain",
  "requestSave",
]);

function classMemberNames(source: string): string[] {
  const classBody = source.slice(source.indexOf("export class SvgView"));
  const names: string[] = [];
  // Top-level class members sit at exactly 2-space indent; anything nested
  // deeper is inside a method body, not a member declaration.
  const memberRegex = /^ {2}(?:private |protected |public |static |readonly |async )*([A-Za-z_$][\w$]*)/gm;
  let match: RegExpExecArray | null;
  while ((match = memberRegex.exec(classBody)) !== null) {
    names.push(match[1]);
  }
  return names;
}

describe("SvgView doesn't shadow TextFileView's reserved fields", () => {
  const members = classMemberNames(readFileSync(SVG_VIEW_PATH, "utf8"));

  it("found a plausible number of class members (sanity check on the parser itself)", () => {
    // Guards against the regex silently matching nothing after some future
    // reformatting, which would make the reserved-name check below pass vacuously.
    expect(members.length).toBeGreaterThan(10);
  });

  it("declares none of TextFileView's reserved field names", () => {
    const collisions = members.filter((name) => RESERVED_TEXTFILEVIEW_FIELDS.has(name));
    expect(collisions).toEqual([]);
  });
});
