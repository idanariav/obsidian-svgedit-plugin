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
