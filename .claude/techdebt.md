# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

## No CI

`npm test` runs vitest (`vitest.config.mts`, `tests/**/*.test.ts`), covering:
the `SvgView` extensions-list sync check, an `extractSvg`/`replaceSvg`
round-trip (incl. the CRLF regression case), `src/export/frames.ts`,
`src/export/raster.ts` (real Chromium rasterization via Playwright —
`tests/export/raster.test.ts`), a static guard that `SvgView` doesn't declare
a field name reserved by Obsidian's `TextFileView`
(`tests/view/SvgView-reserved-fields.test.ts`), and the `SvgView` init race
around `editorReady` (`tests/view/SvgView-init-race.test.ts`, built against
`tests/mocks/obsidian.ts` — a minimal runtime stand-in for the types-only
`obsidian` package, aliased in for tests via `vitest.config.mts`; expand it
if a future test needs to drive more of `SvgView`, e.g. a real
save()/backup-restore flow needs `Vault`/IndexedDB wired up too).

Not done now: no `.github/workflows` runs `npm test` on push/PR yet.

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
