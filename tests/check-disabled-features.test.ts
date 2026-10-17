/**
 * SvgView.ts turns svgedit's built-in features *off* by name (`disabledFeatures`) instead of listing every one it
 * wants, so new svgedit tools reach the plugin without a change here. The one way that goes wrong is a name that no
 * longer matches a built-in (a rename), which would silently leave the feature on. This checks every disabled name
 * against svgedit's `defaultExtensions` (ConfigObj.ts).
 *
 * Requires the sibling ../svgedit checkout (same convention as scripts/fetch-svgedit-dist.mjs); skips if it isn't
 * present, since there's nothing to diff against.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "..");
const SVGEDIT_CONFIG = resolve(ROOT, "../svgedit/src/editor/ConfigObj.ts");
const SVG_VIEW = resolve(ROOT, "src/view/SvgView.ts");

const namesIn = (source: string, start: RegExp): string[] | null => {
  const match = source.match(start);
  if (!match || match.index === undefined) return null;
  const from = match.index + match[0].length;
  const body = source.slice(from, source.indexOf("]", from));
  return [...body.matchAll(/["']([\w-]+)["']/g)].map((m) => m[1]);
};

describe.skipIf(!existsSync(SVGEDIT_CONFIG))("SvgView disabledFeatures names real svgedit built-ins", () => {
  it("every disabled name is in svgedit's defaultExtensions", () => {
    const defaults = namesIn(readFileSync(SVGEDIT_CONFIG, "utf8"), /this\.defaultExtensions\s*=\s*\[/);
    const disabled = namesIn(readFileSync(SVG_VIEW, "utf8"), /disabledFeatures:\s*\[/);
    expect(defaults, `Could not find defaultExtensions in ${SVGEDIT_CONFIG}`).not.toBeNull();
    expect(disabled, `Could not find disabledFeatures: [...] in ${SVG_VIEW}`).not.toBeNull();

    const known = new Set(defaults!.map((n) => (n.startsWith("ext-") ? n : `ext-${n}`)));
    const unknown = disabled!.filter((n) => !known.has(n.startsWith("ext-") ? n : `ext-${n}`));
    expect(unknown, "disabledFeatures names that are not svgedit built-ins (renamed or removed?)").toEqual([]);
  });

  it("does not list every extension by hand any more", () => {
    expect(readFileSync(SVG_VIEW, "utf8")).not.toMatch(/noDefaultExtensions/);
  });
});
