# Tech Debt / Future Work

Running log of deferred refactors, follow-ups, and "do it properly later"
items surfaced during work sessions but intentionally **not** scheduled or
executed at the time. This is a reference backlog, not a roadmap — nothing
here should be picked up unless explicitly requested in a future session.

When adding an entry: say what it is, why it wasn't done now, and roughly
how big/risky it is. When an item is finally addressed, delete its entry
(git history keeps the record).

---

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
