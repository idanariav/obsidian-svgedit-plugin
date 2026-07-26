/**
 * Populates svgedit-dist/ with the svgedit editor bundle.
 *
 * svgedit now ships a single self-contained ESM bundle (`Editor.js`) with CSS,
 * images, extensions and locales all inlined. This plugin imports that file at
 * BUILD time so esbuild bundles it straight into `main.js` — nothing from
 * svgedit-dist/ is shipped to the vault at runtime. So we copy only Editor.js.
 *
 * Alongside it we write svgedit-dist/SOURCE.json, recording exactly which
 * svgedit commit (or npm version) produced the bundle. That's what makes
 * "does plugin version X contain fix Y" a single lookup instead of git
 * archaeology: find the commit that set manifest.json's version to X, then
 * read SOURCE.json as of that same commit.
 *
 * Resolution order:
 *   1. $SVGEDIT_LOCAL_PATH env var (explicit override)
 *   2. Sibling ../svgedit directory (local dev convention)
 *   3. Install svgedit@SVGEDIT_VERSION from npm into a temp dir (CI / publishing)
 *
 * To bump the npm fallback version, update SVGEDIT_VERSION below.
 */

import { existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const SVGEDIT_VERSION = "7.4.1";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TARGET = join(ROOT, "svgedit-dist");

/** Git commit + dirty-state + commit timestamp of `repoRoot`, or null if it
 *  isn't a git repo (e.g. the npm-installed fallback has no git history to
 *  point at). `commitTimeMs` is used only for the freshness check below and
 *  left out of what gets written to SOURCE.json. */
function getGitInfo(repoRoot) {
  try {
    const commit = execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();
    const commitTimeMs = Number(execSync("git log -1 --format=%ct", { cwd: repoRoot }).toString().trim()) * 1000;
    const dirty = execSync("git status --porcelain", { cwd: repoRoot }).toString().trim().length > 0;
    return { commit, dirty, commitTimeMs };
  } catch {
    return null;
  }
}

/** Guard against recording a commit hash the bundle doesn't actually reflect:
 *  if Editor.js is older than its repo's last commit, the local `npm run
 *  build` predates that commit and SOURCE.json would lie about provenance.
 *  Only meaningful for a git-backed source (the npm fallback is always a
 *  fresh install, never stale). */
function checkFreshness(editorDir, gitInfo) {
  if (!gitInfo) return;
  const builtAtMs = statSync(join(editorDir, "Editor.js")).mtimeMs;
  if (builtAtMs < gitInfo.commitTimeMs) {
    console.error(
      `[fetch-svgedit-dist] The build at ${editorDir} is older than its repo's last commit ` +
      `(${gitInfo.commit.slice(0, 8)}) — it doesn't reflect the latest source.`,
    );
    console.error("  Run 'npm run build' in your local svgedit repo, then re-run this script.");
    process.exit(1);
  }
}

/** Write svgedit-dist/SOURCE.json describing where Editor.js came from. A
 *  dirty source tree means the bundle may include uncommitted changes not
 *  reflected by `commit` — flagged rather than silently recorded as truth. */
function writeSourceInfo({ commit, dirty, npmVersion }) {
  const info = { commit, dirty, ...(npmVersion ? { npmVersion } : {}), syncedAt: new Date().toISOString() };
  writeFileSync(join(TARGET, "SOURCE.json"), JSON.stringify(info, null, 2) + "\n");
  if (dirty) {
    console.warn("[fetch-svgedit-dist] WARNING: svgedit working tree has uncommitted changes — SOURCE.json's commit won't fully describe this bundle.");
  }
}

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
  const gitInfo = getGitInfo(envPath);
  checkFreshness(editorDir, gitInfo);
  copyDist(editorDir);
  writeSourceInfo(gitInfo ?? { commit: null, dirty: false });
  process.exit(0);
}

// 2. Sibling ../svgedit directory
const siblingRoot = resolve(ROOT, "../svgedit");
const siblingDist = join(siblingRoot, "dist/editor");
if (existsSync(siblingDist)) {
  console.log("[fetch-svgedit-dist] Found local sibling svgedit repo, using its build.");
  const gitInfo = getGitInfo(siblingRoot);
  checkFreshness(siblingDist, gitInfo);
  copyDist(siblingDist);
  writeSourceInfo(gitInfo ?? { commit: null, dirty: false });
  process.exit(0);
}

// 3. Install from npm
console.log(`[fetch-svgedit-dist] No local svgedit found — installing svgedit@${SVGEDIT_VERSION} from npm...`);
const tmpDir = join(ROOT, ".svgedit-tmp");
try {
  execSync(`npm install --prefix "${tmpDir}" svgedit@${SVGEDIT_VERSION}`, { stdio: "inherit" });
  const npmDist = join(tmpDir, "node_modules", "svgedit", "dist", "editor");
  copyDist(npmDist);
  writeSourceInfo({ commit: null, dirty: false, npmVersion: SVGEDIT_VERSION });
} finally {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
}
