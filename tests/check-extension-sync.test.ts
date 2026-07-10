/**
 * Guards against the extensions list in SvgView.ts drifting from svgedit's
 * defaultExtensions (ConfigObj.js). That list is a hand-maintained mirror
 * (see the comment above `extensions:` in SvgView.ts) with three deliberate
 * omissions: ext-opensave and ext-storage (need browser file-system /
 * localStorage APIs unavailable in Obsidian) and ext-overview_window
 * (disabled upstream for performance). Anything else missing, or any addition
 * not in svgedit's defaults, means the two have drifted and someone should
 * look at why.
 *
 * Requires the sibling ../svgedit checkout (same convention as
 * scripts/fetch-svgedit-dist.mjs); skips if it isn't present, since there's
 * nothing to diff against.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "..");
const SVGEDIT_CONFIG = resolve(ROOT, "../svgedit/src/editor/ConfigObj.js");
const SVG_VIEW = resolve(ROOT, "src/view/SvgView.ts");

const KNOWN_OMISSIONS = new Set([
  "ext-opensave",
  "ext-storage",
  "ext-overview_window",
]);

function extractArray(source: string, arrayStartRegex: RegExp): string[] | null {
  const match = source.match(arrayStartRegex);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const end = source.indexOf("]", start);
  const body = source.slice(start, end);
  return [...body.matchAll(/["']([\w-]+)["']/g)].map((m) => m[1]);
}

describe.skipIf(!existsSync(SVGEDIT_CONFIG))(
  "SvgView extensions list stays in sync with svgedit's defaults",
  () => {
    it("has no missing or unexpected extensions", () => {
      const defaultExtensions = extractArray(
        readFileSync(SVGEDIT_CONFIG, "utf8"),
        /this\.defaultExtensions\s*=\s*\[/,
      );
      const pluginExtensions = extractArray(
        readFileSync(SVG_VIEW, "utf8"),
        /extensions:\s*\[/,
      );

      expect(defaultExtensions, `Could not find defaultExtensions in ${SVGEDIT_CONFIG}`).not.toBeNull();
      expect(pluginExtensions, `Could not find extensions: [...] in ${SVG_VIEW}`).not.toBeNull();

      const pluginSet = new Set(pluginExtensions);
      const missing = defaultExtensions!.filter(
        (ext) => !pluginSet.has(ext) && !KNOWN_OMISSIONS.has(ext),
      );
      const unexpected = pluginExtensions!.filter(
        (ext) => !defaultExtensions!.includes(ext),
      );

      expect(
        missing,
        "svgedit default extensions missing from SvgView.ts. If intentional, add them to KNOWN_OMISSIONS.",
      ).toEqual([]);
      expect(
        unexpected,
        "SvgView.ts extensions not present in svgedit's defaults.",
      ).toEqual([]);
    });
  },
);
