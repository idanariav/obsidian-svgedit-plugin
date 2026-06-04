# Commands

These commands are available from Obsidian's Command Palette (`Ctrl/Cmd + P`). Some
only appear when they make sense — for example, the export commands only show up
while you have an SVG drawing open.

There is also a **ribbon icon** in the left sidebar ("New SVG drawing") that does the
same thing as the *New SVG drawing* command.

---

## New SVG drawing

Creates a brand-new drawing. A dialog asks you where to save it (pre-filled with
your configured [Drawings folder](settings.md#drawings-folder)) and what to name it.
The new file opens straight into the SVG editor with a blank canvas at your
[default canvas size](settings.md#canvas-width--canvas-height).

Use this whenever you want to start drawing from scratch.

---

## Convert note to SVG drawing

Turns the **currently open Markdown note** into an SVG drawing. This command only
appears when the active file is a normal Markdown note that isn't already a drawing.

It does three things:

- Marks the note as an SVG drawing (so the plugin knows to open it in the editor).
- Adds an empty drawing canvas to the note if it doesn't have one yet.
- Adds an `svg` tag to the note.

Handy when you started typing notes and decide you'd rather sketch instead, or want
to attach a drawing to an existing note.

---

## Insert file from vault into drawing

While editing a drawing, this lets you pick an image (or other supported file) from
your vault and drop it into the canvas. Only available when an SVG editor is the
active view.

Use it to trace over a screenshot, build a diagram on top of a reference image, or
combine existing assets into one drawing.

---

## Toggle drawing / markdown view

Flips the current file between the **SVG editor** and the **raw Markdown source**.
Only available when the open file is an SVG drawing.

- **Editor → Markdown:** your drawing is saved first, then you see the underlying
  Markdown (useful for editing note text, frontmatter, or inspecting the raw SVG).
- **Markdown → Editor:** switches back to the visual editor.

This is a one-time switch for the current file. It does **not** change which view a
drawing opens in by default — that's controlled by the
[Open as Markdown](settings.md#open-as-markdown-by-default) setting and the
[`svg-open-md`](frontmatter.md#svg-open-md) frontmatter field.

---

## Export drawing…

Opens an interactive export dialog. This is the most flexible way to export, letting
you choose everything for a single export without changing any settings:

- **Format** — PNG or SVG.
- **Transparent background** — for PNG exports (SVG keeps its own background).
- **Region** — export the **whole canvas**, or just a single
  [frame](frontmatter.md#svg-export-frame) you've drawn. The region list only shows
  frames that actually exist in the drawing.

When you export a specific frame, it's written to a **separate file** named after the
drawing plus the frame name (for example `diagram-hero-shot.png`). That way it never
clobbers the normal companion file that auto-export keeps up to date.

Only available when a drawing is open.

---

## Export drawing as SVG / Export drawing as PNG

Two quick, one-click export commands that skip the dialog. They use the drawing's
**effective settings** — meaning whatever you've configured globally, per-folder, or
in the file's frontmatter for transparency and export region.

Use these when you've already set up how a drawing should export and just want to
trigger it on demand. For a one-off with different options, use *Export drawing…*
instead.

---

## A note on automatic export

You usually don't need the export commands at all. By default the plugin writes
companion `.svg` and `.png` files **every time you save** a drawing. The export
commands are there for when you want to export on demand or with one-off options. See
[Auto-export settings](settings.md#auto-export) for how to control this.
