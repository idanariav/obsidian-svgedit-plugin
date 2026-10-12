# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

## Editor commands reach Obsidian through one picker, not ~150 palette entries

svgedit has a command registry (`editor.commands`, added 2026-10-10 in the svgedit repo; part of the
`EditorHostApi` in `hostApi.d.ts`): `commands.list()` returns every editing action (id, translated label,
group, effective keys, `enabled` + `disabledReason`, params, `interactive`) and `commands.run(id, params?)`
runs one (throws `CommandError`, `code`: `unknown` | `disabled` | `badParams` | `internal`). The plugin's
Obsidian commands in `src/commands.ts` are all file-level (new, export, versions); none of the ~150 editing
actions reach the palette.

**Decision (2026-10-12): do not register one palette entry per editor command.** ~150 entries would bury the
plugin's own commands in Obsidian's palette. The registry stays reachable another way:
- **One palette entry, "SVG: run editor command…"**, only offered while a drawing is open: a fuzzy picker
  (`SuggestModal`) over `commands.list()` for the active view's editor, showing label, group and key, greyed
  with `disabledReason` when `enabled` is false, skipping `interactive` commands (they need a pointer);
  choosing one calls `commands.run(id)`. A command that needs `params` is not offered until the picker can ask for them.
- **Expose the registry on the plugin object** (`plugin.editorCommands(view)` returning `{ list, run }` for a
  view) so another plugin, or a future CLI / MCP bridge that lets an LLM drive a drawing, can call them without
  Obsidian's palette. The bridge itself is not planned until someone wants to attach an LLM.
- Obsidian hotkeys for single commands stay out unless asked; the editor has its own Hotkey Manager.

Needs `npm run sync-svgedit` first so the plugin picks up the new `hostApi.d.ts`. Medium.
