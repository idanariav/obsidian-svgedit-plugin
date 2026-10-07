/**
 * Populates svgedit-dist/ with the svgedit editor bundle.
 *
 * svgedit now ships a single self-contained ESM bundle (`Editor.js`) with CSS,
 * images, extensions and locales all inlined. This plugin imports that file at
 * BUILD time so esbuild bundles it straight into `main.js` — nothing from
 * svgedit-dist/ is shipped to the vault at runtime. So we copy only Editor.js.
 *
 * Alongside it we write svgedit-dist/SOURCE.json, recording exactly which
 * svgedit commit (or GitHub release) produced the bundle. That's what makes
 * "does plugin version X contain fix Y" a single lookup instead of git
 * archaeology: find the commit that set manifest.json's version to X, then
 * read SOURCE.json as of that same commit.
 *
 * Resolution order:
 *   0. SVGEDIT_FORCE_RELEASE=1 skips 1 and 2 (use it to sync the bundle of the
 *      pinned release, which is what a fresh clone / CI gets)
 *   1. $SVGEDIT_LOCAL_PATH env var (explicit override)
 *   2. Sibling ../svgedit directory (local dev convention)
 *   3. Download the `Editor.js` asset of the fork's GitHub release
 *      SVGEDIT_RELEASE (CI / fresh clone). Skipped when svgedit-dist/SOURCE.json
 *      already records that release. Fails loudly if the download fails — it
 *      never falls back to upstream svgedit from npm, which would silently
 *      bundle an editor without this fork's features.
 *
 * To move to a newer fork release, bump SVGEDIT_RELEASE below (or run once with
 * SVGEDIT_RELEASE=<tag|latest> in the environment to try one). Releases are cut
 * in the fork — see its docs/ReleaseInstructions.md.
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, statSync } from "fs";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const FORK_REPO = "idanariav/svgedit";
const SVGEDIT_RELEASE = process.env.SVGEDIT_RELEASE || "v7.4.1-fork.2";

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
 *  Only meaningful for a git-backed source (a downloaded release is always
 *  fresh, never stale). */
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
function writeSourceInfo({ commit, dirty, release, sha256 }) {
  const info = { commit, dirty, ...(release ? { release, sha256 } : {}), syncedAt: new Date().toISOString() };
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
const forceRelease = Boolean(process.env.SVGEDIT_FORCE_RELEASE);
const envPath = forceRelease ? undefined : process.env.SVGEDIT_LOCAL_PATH;
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
if (!forceRelease && existsSync(siblingDist)) {
  console.log("[fetch-svgedit-dist] Found local sibling svgedit repo, using its build.");
  const gitInfo = getGitInfo(siblingRoot);
  checkFreshness(siblingDist, gitInfo);
  copyDist(siblingDist);
  writeSourceInfo(gitInfo ?? { commit: null, dirty: false });
  process.exit(0);
}

// 3. Download the fork's GitHub release asset
const sourcePath = join(TARGET, "SOURCE.json");
if (SVGEDIT_RELEASE !== "latest" && existsSync(join(TARGET, "Editor.js")) && existsSync(sourcePath)) {
  try {
    if (JSON.parse(readFileSync(sourcePath, "utf8")).release === SVGEDIT_RELEASE) {
      console.log(`[fetch-svgedit-dist] svgedit-dist already holds release ${SVGEDIT_RELEASE}; nothing to do.`);
      process.exit(0);
    }
  } catch {
    // unreadable SOURCE.json: fall through and re-download
  }
}

const base = SVGEDIT_RELEASE === "latest"
  ? `https://github.com/${FORK_REPO}/releases/latest/download`
  : `https://github.com/${FORK_REPO}/releases/download/${SVGEDIT_RELEASE}`;
const url = `${base}/Editor.js`;
console.log(`[fetch-svgedit-dist] No local svgedit found — downloading ${url}`);
let bytes;
try {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 100_000) throw new Error(`asset is only ${bytes.length} bytes — not an editor bundle`);
} catch (err) {
  console.error(`[fetch-svgedit-dist] Could not download the svgedit bundle: ${err.message}`);
  console.error(`  Release ${SVGEDIT_RELEASE} of ${FORK_REPO} must exist and carry an Editor.js asset.`);
  console.error("  Alternatively clone the fork next to this repo (../svgedit), run 'npm run build' there,");
  console.error("  or set SVGEDIT_LOCAL_PATH. Refusing to fall back to upstream svgedit from npm.");
  process.exit(1);
}
mkdirSync(TARGET, { recursive: true });
writeFileSync(join(TARGET, "Editor.js"), bytes);
writeSourceInfo({
  commit: null,
  dirty: false,
  release: SVGEDIT_RELEASE,
  sha256: createHash("sha256").update(bytes).digest("hex"),
});
console.log(`[fetch-svgedit-dist] Wrote Editor.js (${bytes.length} bytes) from release ${SVGEDIT_RELEASE}`);
