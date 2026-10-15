# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

## Editor command picker: commands that need parameters, and the outside bridge

Built 2026-10-12 (1.0.48): the palette entry "Run editor command…" (`src/modals/EditorCommandModal.ts`, logic in
`src/editorCommands/items.ts`) lists every non-`interactive` command of the active drawing — greyed with
`disabledReason` when unavailable, sorted after the ones that work — and `plugin.editorCommands(view?)` /
`SvgView.editorCommands()` expose `{ list, run }`. Decision kept: no palette entry per command (~150 would bury the
plugin's own), no Obsidian hotkeys per command (the editor has its own Hotkey Manager).

Left open:
- Parameter prompt (`EditorCommandParamsModal`, 2026-10-15): a command with `params` opens a form (text / toggle / dropdown) before
  running. No editor command declares `params` yet, so it is covered by unit tests with fake commands only.
- No LLM / CLI / MCP bridge yet; `plugin.editorCommands()` is the seam for one. Not planned until someone wants to attach an LLM.
- Verified by unit tests against a fake editor only; the picker has not been driven inside Obsidian.
