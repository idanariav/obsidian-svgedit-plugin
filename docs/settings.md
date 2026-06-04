# Settings

Open these from **Settings → Community plugins → SVG Draw**. They control how
drawings open, how they look, and how they're exported.

Many settings come in three layers that build on each other:

1. **Global defaults** (the settings on this page)
2. **Folder overrides** (apply to drawings in a chosen folder)
3. **Per-file [frontmatter](frontmatter.md)** (applies to a single drawing)

Each layer overrides the one above it, so a single drawing can opt out of a folder
rule, and a folder can opt out of the global default. Folder overrides can be set to
**Inherit** to fall back to the global value.

---

## Open mode

### Open as Markdown by default

- **Values:** On / Off (default **Off**)
- When **Off**, drawings open directly in the SVG editor.
- When **On**, drawings open as a normal Markdown note instead. You can still switch
  to the editor anytime with the
  [Toggle drawing / markdown view](commands.md#toggle-drawing--markdown-view) command.

This only sets the **default** for newly opened files. Use it if you often want to
read the note text around a drawing without entering the editor.

---

## Appearance

### Editor theme

- **Values:** Match Obsidian / Light / Dark (default **Match Obsidian**)
- **Match Obsidian** makes the editor follow Obsidian's current light/dark mode.
- **Light** / **Dark** force a fixed theme for the editor regardless of Obsidian's
  appearance.

This only affects the editor's interface (toolbars, panels, canvas chrome) — it does
not change the colors in your actual drawing. Toggling the theme from inside the
editor updates this setting too, and the choice is remembered across files and
sessions.

---

## Auto-export

The plugin can write companion image files next to your drawing automatically on
**every save**, so the rendered image is always available to embed in other notes.

### Export SVG on save

- **Values:** On / Off (default **On**)
- When On, a companion `.svg` file is written next to the drawing on each save.

### Export PNG on save

- **Values:** On / Off (default **On**)
- When On, a companion `.png` file is written next to the drawing on each save.

### Transparent PNG background

- **Values:** On / Off (default **Off**)
- When **On**, exported PNGs have a transparent background.
- When **Off**, a white background is painted behind the drawing.
- Applies to PNG only — SVG exports always keep their own background.

### Export region (frame name)

- **Values:** blank, or a frame name (default **blank**)
- **Blank** exports the whole canvas.
- Enter the name of a **frame** (a rectangle you draw with the editor's Frame tool
  to mark an export region) to crop all exports to that frame's bounds.
- If no frame with that name exists in a drawing, the whole canvas is exported
  instead.
- Frame rectangles themselves are **always stripped** from exports, so they never
  show up in the final image.

See [`svg-export-frame`](frontmatter.md#svg-export-frame) for setting this per-file.

### PNG scale

- **Values:** 0.5× / 1× / 2× / 4× (default **1×**)
- A pixel-density multiplier for exported PNGs. Higher values produce a larger,
  sharper image (good for retina displays or printing) at the cost of file size. SVG
  exports are unaffected — they're resolution-independent.

---

## File sync

### Keep companion files in sync

- **Values:** On / Off (default **Off**)
- When **On**, renaming or deleting a drawing automatically renames or deletes its
  companion `.svg` and `.png` files too, so they don't get left behind or go stale.
- When **Off**, companion files are left untouched when you move, rename, or delete a
  drawing.

---

## New drawing defaults

These apply to drawings created with the
[New SVG drawing](commands.md#new-svg-drawing) command.

### Canvas width / Canvas height

- **Values:** any positive number of pixels (defaults **800 × 600**)
- The starting canvas size for a new drawing. You can always resize the canvas later
  inside the editor.

### Drawings folder

- **Values:** a vault folder path, or blank (default **blank** = vault root)
- The default folder offered when you create a new drawing (for example `Drawings`).
  Leave it blank to default to the vault root.

---

## Folder overrides

Folder overrides let a whole folder of drawings behave differently from your global
defaults — without editing each file. Click **+ Add folder**, enter a vault-relative
folder path, and set any of:

- **Open as** — SVG editor, Markdown view, or Inherit.
- **Auto-export PNG** — Yes, No, or Inherit.
- **Transparent PNG background** — Yes, No, or Inherit.
- **Export region (frame name)** — a frame name, or blank to inherit.

Each option can be set to **Inherit** to fall back to the global default. When a
drawing sits in a folder that matches more than one override, the **most specific
(longest) matching path wins**.

Per-file [frontmatter](frontmatter.md) still takes priority over folder overrides.

---

## Export folder mappings

By default, companion `.svg` / `.png` files are written **right next to** the
drawing. Mappings let you send them somewhere else — useful for keeping source
drawings and rendered assets in separate folders.

Click **+ Add mapping** and set:

- **Source folder** — drawings in this folder (and its sub-folders) use the custom
  path.
- **Export folder** — where their companion files are written instead.

If a drawing matches more than one mapping, the **longest matching source path
wins**. Drawings that match no mapping export next to themselves as usual.
