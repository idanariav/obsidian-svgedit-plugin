/**
 * Populates svgedit-dist/ with the svgedit editor bundle.
 *
 * svgedit now ships a single self-contained ESM bundle (`Editor.js`) with CSS,
 * images, extensions and locales all inlined. This plugin imports that file at
 * BUILD time so esbuild bundles it straight into `main.js` — nothing from
 * svgedit-dist/ is shipped to the vault at runtime. So we copy only Editor.js.
 *
 * Resolution order:
 *   1. $SVGEDIT_LOCAL_PATH env var (explicit override)
 *   2. Sibling ../svgedit directory (local dev convention)
 *   3. Install svgedit@SVGEDIT_VERSION from npm into a temp dir (CI / publishing)
 *
 * To bump the npm fallback version, update SVGEDIT_VERSION below.
 */

import { existsSync, mkdirSync, copyFileSync, rmSync } from "fs";
import { execSync } from "child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const SVGEDIT_VERSION = "7.4.1";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TARGET = join(ROOT, "svgedit-dist");

function copyDist(editorDir) {
  const src = join(editorDir, "Editor.js");
  if (!existsSync(src)) {
    console.error(`[fetch-svgedit-dist] Bundle not found at ${src}`);
    console.error("  Run 'npm run build' in your local svgedit repo first.");
    process.exit(1);
  }
  mkdirSync(TARGET, { recursive: true });
  copyFileSync(src, join(TARGET, "Editor.js"));
  console.log(`[fetch-svgedit-dist] Copied Editor.js bundle from ${editorDir}`);
}

// 1. Explicit env var override
const envPath = process.env.SVGEDIT_LOCAL_PATH;
if (envPath) {
  const editorDir = join(envPath, "dist", "editor");
  if (!existsSync(editorDir)) {
    console.error(`[fetch-svgedit-dist] SVGEDIT_LOCAL_PATH set but dist not found at ${editorDir}`);
    console.error("  Run 'npm run build' in your local svgedit repo first.");
    process.exit(1);
  }
  copyDist(editorDir);
  process.exit(0);
}

// 2. Sibling ../svgedit directory
const siblingDist = resolve(ROOT, "../svgedit/dist/editor");
if (existsSync(siblingDist)) {
  console.log("[fetch-svgedit-dist] Found local sibling svgedit repo, using its build.");
  copyDist(siblingDist);
  process.exit(0);
}

// 3. Install from npm
console.log(`[fetch-svgedit-dist] No local svgedit found — installing svgedit@${SVGEDIT_VERSION} from npm...`);
const tmpDir = join(ROOT, ".svgedit-tmp");
try {
  execSync(`npm install --prefix "${tmpDir}" svgedit@${SVGEDIT_VERSION}`, { stdio: "inherit" });
  const npmDist = join(tmpDir, "node_modules", "svgedit", "dist", "editor");
  copyDist(npmDist);
} finally {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
}
