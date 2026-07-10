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

## Cross-instance SVG id/ref collisions keep resurfacing as new facets

Multiple svgedit instances (one per open pane) mount into the same top-level
`document`, so any element `id` — and anything that references one via
`url(#id)`/`href`/`filter` — resolves document-wide, not per-instance. This
family of bugs has been found and patched **four separate times**, each a
different id-minting site rather than a shared root cause:

1. Load-time: two drawings' own ids collided → `namespaceSvgIds()` stamps a
   per-file nonce (`src/data/SvgData.ts`, this repo).
2. Template-derived drawings shared one baked nonce → re-namespace when the
   baked nonce doesn't match the current file's derived nonce (this repo).
3. Canvas-background gradient ids used a reset-to-0 runtime counter → namespaced
   with the drawing's nonce (`packages/svgcanvas/core/elem-get-set.js`, the fork).
4. Paste between two open drawings only checked the pasting canvas's own
   subtree for collisions, not the whole document → fixed to fall back to
   `ownerDocument.querySelector` (`packages/svgcanvas/core/draw.js`, the fork).
5. Path node-edit grips (`pathpointgrip_N`, `ctrlpointgrip_Nc1`/`c2`) were
   looked up via bare `document.getElementById` after creation instead of
   using the just-created element (or the instance-scoped `this.ctrlpts`
   refs already held by `Segment`) → with two panes both editing a path at
   the same node index, the global lookup returned whichever pane's grip
   came first in DOM order, wiring dblclick handlers/highlight colors to the
   wrong pane's grip (`packages/svgcanvas/core/path-method.js`, the fork).

6. `ext-grid`'s grid pattern/clip used hardcoded literal ids (`gridpattern`,
   `gridclip`) referenced via `fill:url(#gridpattern)` /
   `clip-path:url(#gridclip)` — a native SVG paint/clip reference, resolved
   by the browser itself document-wide, not through any of svgedit's scoped
   `$id` lookups. Two panes with the grid on could end up rendering one
   pane's grid color/shape via the *other* pane's pattern
   (`src/editor/extensions/ext-grid/ext-grid.js`, the fork).

Addressed as a systemic mechanism rather than a sixth ad hoc patch: audited
every SVG-content id-minting site in `packages/svgcanvas` and every
extension. Ordinary content ids all already funnel through
`getNextId()`/`getNextIdWithPrefix()` (`packages/svgcanvas/core/draw.js`),
which check document-wide uniqueness via `getElem_` (fix #4) — that half of
the "one shared uniqueness check" idea already existed and audits clean. What
was missing was the other half: a few call sites (facet #3's background
gradient, and now #6's grid pattern/clip) mint a *hardcoded* id by
convention, referenced via `url(#id)`/`href="#id"`, without going through
that path — each one had hand-rolled its own nonce-suffixing inline instead
of sharing logic. Added `Drawing#getNonceId(base)` /
`SvgCanvas#getNonceId(base)` (`packages/svgcanvas/core/draw.js` +
`packages/svgcanvas/svgcanvas.js`) as the one canonical helper for this case,
refactored #3's background-gradient fix onto it, and used it to fix #6. Any
future extension or core code minting a `url()`/`href`-referenced literal id
should call this instead of re-deriving the nonce by hand.

Not done: genuinely isolating each editor instance's DOM via Shadow
DOM/`getRootNode()`-scoped lookups instead of nonce-suffixing string ids —
would prevent this specific bug shape architecturally rather than by
convention, but is a much larger, riskier change (svgedit's canvas is real
SVG DOM, not canvas-based rendering, so paint-server refs would still need to
resolve correctly across a shadow boundary). Not pursued given the lighter
fix above closes every currently-known case. If a *seventh* hardcoded
referenced id turns up, that's the signal the convention-based approach isn't
holding and the Shadow DOM redesign is worth the cost.

Related but distinct — found during this audit, not fixed (out of scope: not
an id/ref collision, a **UI-chrome cross-talk** bug): several web components
resolve "my editor's root" via `document.querySelector('.svg_editor')`
(first match in the whole document) instead of an instance-scoped lookup
(e.g. `this.closest('.svg_editor')`, available since each is a light-DOM
custom element). With two panes open, every one of these sync their
dark/light theme to whichever pane's `.svg_editor` happens to come first in
the DOM, not their own: `seFontSelect.js`, `seFontLibrary.js`,
`seShapeLibrary.js`, `colorPicker/ColorDialog.js`, `seTraceDialog.js`,
`imageImportDialog.js`, `seTextPromptDialog.js` (all under
`src/editor/components`/`src/editor/dialogs`). `contextmenu.js`'s
`contextMenuExtensions` registry is also module-level singleton state shared
by every instance, and `commandSearch.js`/`EditorStartup.js` resolve command
targets via bare `document.getElementById`. Worth its own techdebt entry with
a design pass if picked up.

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
