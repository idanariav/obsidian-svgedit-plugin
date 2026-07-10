# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

## No test framework in this repo

There is no jest/vitest/mocha, and no CI (no `.github/workflows`). The only
thing resembling a test today is `scripts/check-extension-sync.mjs`
(wired to `npm test`), a plain Node script that diffs the hand-maintained
`extensions: [...]` list in `src/view/SvgView.ts` against svgedit's
`defaultExtensions` (`../svgedit/src/editor/ConfigObj.js`) — added after that
list silently drifted (missing `ext-repeat` and six other upstream defaults;
carrying a stale `ext-eyedropper` inclusion). A real regression test would
look different (a unit test asserting the diff), but standing up a whole
framework for one assertion wasn't worth it in the moment.

Not done now: pick a framework (vitest is the obvious choice — same as
`../svgedit`, keeps tooling consistent across the two repos), wire `npm
test` to it, decide whether to add CI. Medium effort, low risk — mostly
plumbing, plus rewriting `check-extension-sync.mjs`'s logic as an actual test.

Candidate tests worth adding once a framework exists, roughly in priority
order:

- **Promote `check-extension-sync.mjs`** into a real test instead of a
  standalone script — same diff logic, but fails the test suite instead of
  a separate `npm test` invocation.
- **extractSvg/replaceSvg round-trip, including CRLF input** — regression
  test for the CRLF empty-open bug (CRLF line endings broke LF-only block
  regexes → empty open + data loss; fixed by `normalizeEol`).
- **SvgView init race** — toggling the md↔SVG view before
  `svgEditor.init()` resolves must not blank the drawing (the `editorReady`
  flag exists specifically to guard this; a passing-today test would catch
  a future regression if that flag's check is ever removed or reordered).
- **Frame export (`src/export/frames.ts`) and raster export
  (`src/export/raster.ts`)** — CLAUDE.md already documents these as
  headless-testable via jsdom/playwright (run from inside `../svgedit` so
  Node resolves those dev deps), but no actual test files exist yet, only
  the documented recipe for throwaway scripts.
- **TextFileView reserved-field guard** — assert `SvgView` doesn't declare
  fields (`saving`, `dirty`, `data`, etc.) that shadow Obsidian's
  `TextFileView` base class; this class of bug has bitten this repo before.

## `installViewStatePatch` monkey-patches a private Obsidian API

`src/postprocessor/setViewStatePatch.ts` patches
`WorkspaceLeaf.prototype.setViewState` (via `monkey-around`) to redirect
drawing files from the markdown view to the SVG view. It's already known to
be incomplete — `src/main.ts`'s `file-open` handler exists specifically as a
fallback for "open paths the setViewState patch misses (notably the Quick
Switcher reusing the single markdown leaf on mobile)". There's no test
coverage for the redirect logic itself (bypass-leaf handling, same-file mode
changes vs. new-file opens, the markdown-mode-leaves override).

Not done now: works today, and there's no cleaner public Obsidian API for
"redirect this markdown file to a custom view type based on its frontmatter."
Worth revisiting if a future Obsidian release changes `setViewState`'s
signature/behavior (patch would silently stop firing or throw), or if another
edge case like the mobile Quick Switcher one turns up needing its own
fallback.

## Toggling the plugin off/on doesn't reload svgedit's custom elements

`src/compat/customElementsGuard.ts` makes `customElements.define()` a no-op
for already-registered tag names, to stop the plugin's *second* load (Obsidian
re-evaluates `main.js` from scratch on every disable/enable, but
`window.customElements` survives) from throwing on svgedit's ~39
`customElements.define('se-button', ...)` calls. Side effect: if a shadow-DOM
component's source changes between two plugin (re)loads in the same Obsidian
window, the second load's new class is silently discarded and the *first*
load's class keeps rendering every instance of that tag — so CLAUDE.md's
documented dev loop ("toggle the plugin off/on... to pick up the new build")
does **not** actually pick up changes to svgedit's custom-element components.
Only a full Obsidian window reload does.

Not done now: this only matters for iterative dev testing (not a user-facing
bug — real users only ever load the plugin once per window), and there's no
clean fix short of tracking which tag names' constructors actually changed
and calling some redefinition path the CustomElementRegistry doesn't natively
support. Low effort to at least document in CLAUDE.md's testing section so
future sessions don't waste time debugging "why didn't my change show up."
