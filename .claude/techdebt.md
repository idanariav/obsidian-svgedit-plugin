# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

## Expose the editor's command registry in Obsidian's command palette

svgedit now has a command registry (`editor.commands`, added 2026-10-10 in the svgedit repo; part of the
`EditorHostApi` in `hostApi.d.ts`): `commands.list()` returns every editing action (id, translated label,
group, effective keys, `enabled` + `disabledReason`, params, `interactive`) and `commands.run(id, params?)`
runs one (throws `CommandError`, `code`: `unknown` | `disabled` | `badParams` | `internal`). The plugin's
Obsidian commands in `src/commands.ts` are all file-level (new, export, versions); none of the ~150 editing
actions reach the palette. Idea: register a palette entry per non-`interactive` command for the active view's
editor (ids are stable and persisted, safe to use as Obsidian command ids), optionally let users bind
Obsidian hotkeys to them, and skip entries whose `enabled` is false. Needs `npm run sync-svgedit` first so the
plugin picks up the new `hostApi.d.ts`. Medium.
