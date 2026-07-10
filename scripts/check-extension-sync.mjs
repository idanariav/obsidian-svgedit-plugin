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
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SVGEDIT_CONFIG = resolve(ROOT, "..", "svgedit/src/editor/ConfigObj.js");
const SVG_VIEW = join(ROOT, "src/view/SvgView.ts");

const KNOWN_OMISSIONS = new Set([
  "ext-opensave",
  "ext-storage",
  "ext-overview_window",
]);

function extractArray(source, arrayStartRegex) {
  const match = source.match(arrayStartRegex);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = source.indexOf("]", start);
  const body = source.slice(start, end);
  return [...body.matchAll(/["']([\w-]+)["']/g)].map((m) => m[1]);
}

if (!existsSync(SVGEDIT_CONFIG)) {
  console.log(
    "[check-extension-sync] ../svgedit not found alongside this repo; skipping.",
  );
  process.exit(0);
}

const defaultExtensions = extractArray(
  readFileSync(SVGEDIT_CONFIG, "utf8"),
  /this\.defaultExtensions\s*=\s*\[/,
);
const pluginExtensions = extractArray(
  readFileSync(SVG_VIEW, "utf8"),
  /extensions:\s*\[/,
);

if (!defaultExtensions) {
  console.error(
    `[check-extension-sync] Could not find defaultExtensions in ${SVGEDIT_CONFIG}`,
  );
  process.exit(1);
}
if (!pluginExtensions) {
  console.error(
    `[check-extension-sync] Could not find extensions: [...] in ${SVG_VIEW}`,
  );
  process.exit(1);
}

const pluginSet = new Set(pluginExtensions);
const missing = defaultExtensions.filter(
  (ext) => !pluginSet.has(ext) && !KNOWN_OMISSIONS.has(ext),
);
const unexpected = pluginExtensions.filter(
  (ext) => !defaultExtensions.includes(ext),
);

if (missing.length || unexpected.length) {
  if (missing.length) {
    console.error(
      "[check-extension-sync] svgedit default extensions missing from SvgView.ts:",
      missing,
    );
  }
  if (unexpected.length) {
    console.error(
      "[check-extension-sync] SvgView.ts extensions not in svgedit's defaults:",
      unexpected,
    );
  }
  console.error(
    "If this is intentional, update KNOWN_OMISSIONS in scripts/check-extension-sync.mjs " +
      "and the comment above `extensions:` in src/view/SvgView.ts.",
  );
  process.exit(1);
}

console.log(
  `[check-extension-sync] OK — ${pluginExtensions.length} extensions in sync with svgedit's defaults.`,
);
