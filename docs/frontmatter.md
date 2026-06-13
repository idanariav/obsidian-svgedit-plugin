# Frontmatter fields

Frontmatter is the small block of properties at the very top of a note, written
between `---` lines. This plugin uses a few frontmatter keys to mark a note as a
drawing and to override settings for **that single file**.

Per-file frontmatter is the **highest-priority** layer: it overrides both
[folder overrides](settings.md#folder-overrides) and the
[global defaults](settings.md). Anything you don't set here simply falls back to those
lower layers.

Example:

```yaml
---
sketch-editor-plugin: parsed
sketch-editor-open-md: false
sketch-editor-auto-export: [svg, png]
sketch-editor-transparent-bg: true
sketch-editor-export-frame: Hero shot
tags:
  - svg
---
```

> The keys were previously named with an `svg-` prefix (`svg-plugin`,
> `svg-open-md`, …). Older drawings using those names are still read for backward
> compatibility; they switch to the `sketch-editor-` names on the next save.

You normally won't write these by hand — the
[New SVG drawing](commands.md#new-svg-drawing) and
[Convert note to SVG drawing](commands.md#convert-note-to-svg-drawing) commands add
the required ones for you. The override fields below are optional and can be added
when you want a specific file to behave differently.

---

## sketch-editor-plugin

- **Values:** `parsed`
- **This is the marker that tells the plugin a note is a drawing.** Without it, the
  note is treated as ordinary Markdown and won't open in the SVG editor.
- It's added automatically when you create or convert a drawing. You generally
  shouldn't remove it (that would "un-mark" the drawing) or add it by hand.

---

## sketch-editor-open-md

- **Values:** `true` / `false`
- Controls whether **this file** opens as Markdown (`true`) or in the SVG editor
  (`false`).
- Overrides the global [Open as Markdown by default](settings.md#open-as-markdown-by-default)
  setting and any folder override for this one file.
- Use it to keep one specific drawing opening as a note (or as a drawing) regardless
  of your folder/global defaults.

---

## sketch-editor-auto-export

- **Values:** a list of formats — `svg`, `png`, or both. Examples:
  - `sketch-editor-auto-export: [svg, png]` — export both companions on save
  - `sketch-editor-auto-export: png` — export only the `.png`
  - `sketch-editor-auto-export: []` (or leave the value blank) — export **nothing** for this file
  - omit the key entirely — inherit the folder/global [Export SVG on save](settings.md#export-svg-on-save)
    and [Export PNG on save](settings.md#export-png-on-save) settings
- Controls which companion files **this file** writes on save, overriding the global
  and folder settings for both formats at once.
- Use it to skip export for a heavy drawing, switch a single file to SVG-only, or
  force a format on in a folder where it's otherwise off.

> Note: present-but-empty (`[]` or a blank value) is different from omitting the key.
> Empty means "export nothing"; omitting means "inherit the lower layers".
>
> The legacy boolean key `sketch-editor-auto-export-png: true` / `false` (and its
> older `svg-auto-export-png` alias) is still honored as a fallback for older files
> (it controls PNG only), but new files should use `sketch-editor-auto-export`.

---

## sketch-editor-transparent-bg

- **Values:** `true` / `false`
- Controls whether **this file's** PNG export uses a transparent background (`true`)
  or a white fill (`false`).
- Overrides the global [Transparent PNG background](settings.md#transparent-png-background)
  setting and folder overrides for this file.
- Applies to PNG only; SVG exports keep their own background.

---

## sketch-editor-export-frame

- **Values:** a frame name (text), or omit / leave blank for the whole canvas
- A **frame** is a rectangle you draw with the editor's Frame tool to mark an export
  region; you give it a name in the editor.
- Set this to a frame's name to **crop all exports of this file** to that frame's
  bounds — handy when a large canvas contains one region you actually want to share.
- If the named frame doesn't exist in the drawing, the whole canvas is exported
  instead.
- Frame rectangles are always removed from the exported image, so they never appear
  in the result.
- Overrides the global [Export region](settings.md#export-region-frame-name) setting
  and folder overrides for this file.

---

## tags

- Not required by the plugin, but the convert command adds an `svg` tag to make
  drawings easy to find and filter in Obsidian. You can add, change, or remove tags
  freely — they don't affect how the drawing behaves.
