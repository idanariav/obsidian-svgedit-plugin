# CLAUDE.md — obsidian-svgedit-plugin

## Repo responsibility

This repo is the **Obsidian plugin wrapper** around the svgedit editor.
It depends on the svgedit fork at `../svgedit` but does **not** affect it.

---

## ⚠️ Before touching any file — determine the correct repo

Ask: *"Would this change make sense for any svgedit consumer, not just Obsidian?"*

| Yes → belongs in `../svgedit` | No → belongs here |
|---|---|
| Shadow DOM component styles | Obsidian CSS overrides (`styles.css`) |
| SVG toolbar icon colors/shapes | Obsidian integration glue (`src/`) |
| Editor behavior or layout | Plugin settings, commands, views |
| Anything under `src/editor/` in the fork | `injectThemeGuard()` and similar Obsidian-specific workarounds |

---

## 🚫 Never edit `svgedit-dist/` directly

`svgedit-dist/` is a **build artifact**. It is populated by:

```bash
# 1. Make source changes in the svgedit fork
cd ../svgedit && npm run build

# 2. Copy the fresh build into this repo
cd ../obsidian-svgedit-plugin && npm run sync-svgedit
```

Any direct edit to `svgedit-dist/` will be silently overwritten the next time
`sync-svgedit` runs. If you find yourself editing a file in `svgedit-dist/`,
stop — find the source file in `../svgedit/src/` and make the change there.

**The only exception:** if `../svgedit` is unavailable (e.g. CI without the
sibling repo), `sync-svgedit` falls back to installing from npm. In that case
the dist is read-only and no patching should occur.

---

## What belongs in this repo

| Path | Purpose |
|---|---|
| `src/` | Obsidian plugin TypeScript — views, commands, settings |
| `styles.css` | Obsidian-scoped CSS overrides for the editor container |
| `scripts/fetch-svgedit-dist.mjs` | Sync script (do not change without updating the fork's build) |
| `svgedit-dist/` | **Build artifact — never edit manually** |

---

## Workflow for a change that spans both repos

1. Make and commit the source change in `../svgedit`
2. `cd ../svgedit && npm run build`
3. `cd ../obsidian-svgedit-plugin && npm run sync-svgedit`
4. Commit the updated `svgedit-dist/` here with a message referencing the fork commit

---

## Testing features

**Only ever use the test vault: `/Users/idanariav/Documents/test_vault`.**
Never test against the user's other vaults — they hold real data.

### In Obsidian (full integration)

1. `npm run build` (runs `tsc` then esbuild → emits `main.js`)
2. Copy the changed artifacts into the vault's plugin dir
   (`<test_vault>/.obsidian/plugins/obsidian-svg-plugin/`): `main.js`, plus
   `styles.css` / `manifest.json` only if those changed.
3. Reload the plugin in Obsidian (toggle it off/on in Settings → Community
   plugins, or run "Reload app without saving") to pick up the new build.
4. `test_svg.md` is a ready-made drawing that already contains a `[data-frame]`
   frame — handy for exercising frame/export behavior.

Do **not** relaunch the user's running Obsidian with a debug port — it's
single-instance and would disrupt their session. Ask first if live UI driving
is truly needed.

### Headless (logic only, no Obsidian)

DOM-dependent code (`src/export/raster.ts`, `src/export/frames.ts`) can be
verified without Obsidian using the sibling fork's dev deps:

- `jsdom` for parsing/serialization checks; `playwright` (Chromium) when real
  `<img>`/`<canvas>` rasterization matters — jsdom and a real browser differ
  on SVG serialization and rendering.
- Run the throwaway script from **inside `../svgedit`** so Node resolves that
  repo's `node_modules` (this repo doesn't depend on jsdom/playwright). Read the
  real SVG out of a `test_vault` `.md` drawing to test against authentic input.
