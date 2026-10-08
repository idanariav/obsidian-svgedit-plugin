# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

The entries below came out of a UI/UX review (2026-10-07), run from the
svgedit repo. Findings about the editor itself, are in
`../svgedit/.claude/techdebt.md`.

## Theme is set in three places, UI mode in two

The theme comes from Obsidian's own theme, the plugin's "Editor theme" setting,
and the editor's moon button (`ext-theme-toggle`, in `SvgView`'s extension
list). UI mode is set both by the "Editor UI mode (desktop/mobile)" settings
and by "Tablet mode" in the editor's main menu. Users can't tell which one
wins. Suggestion: follow Obsidian by default, drop `ext-theme-toggle` from the
plugin's extensions, and hide the menu's tablet toggle when the host manages
UI mode. That last part needs a small config flag in the fork. Small.

## Two different export flows

The editor's main menu still has "Export", which opens svgedit's own dialog and
downloads the file the way a browser would. The plugin has "Export drawing…"
(`ExportModal`), which supports frames, vault folders and PNG scale. The two
behave differently. Either route the editor's menu item to `ExportModal` (a
host hook in the fork, like `svgEditHost`) or hide it. Small to medium; needs
changes in both repos.
