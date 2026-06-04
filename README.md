# SVG Draw for Obsidian

Embed and edit **SVG drawings** directly inside your Obsidian notes, powered by the
open-source [SVG-Edit](https://github.com/SVG-Edit/svgedit) editor.

Sketch diagrams, annotate images, and build vector graphics without leaving your
vault — every drawing lives in a normal Markdown note, and the plugin keeps a
ready-to-embed `.svg` and `.png` image in sync automatically.

---

## Features

- **A full vector editor inside Obsidian** — shapes, paths, text, layers, colors,
  and more, on a resizable canvas.
- **Drawings are just notes** — each drawing is a regular `.md` file, so it works
  with sync, version history, search, links, and tags like everything else.
- **Automatic image export** — companion `.svg` and `.png` files are written every
  time you save, so you can embed the result anywhere.
- **Click-through embeds** — clicking an embedded drawing image opens the editor for
  the source drawing, not the flat image.
- **Light / dark theme** that can follow Obsidian or be fixed.
- **Frames** — mark a region of the canvas to export just that part, embed it on its
  own (`![[drawing#frame]]`), or import it into another drawing.
- **Vault-linked content** — import an image (or a single frame) from your vault, or
  attach a link to a saved shape, and the drawing keeps a real backlink to the source note.
- **Flexible configuration** — set behavior globally, per-folder, or per-file.
- **Desktop and mobile.**

---

## Installation

> This plugin is not yet in the Community Plugins directory. Until then, install it
> manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. In your vault, create the folder
   `<your-vault>/.obsidian/plugins/obsidian-svg-plugin/` and copy the three files
   into it.
3. In Obsidian, go to **Settings → Community plugins**, enable community plugins if
   needed, and turn on **SVG Draw**.

---

## Getting started

1. Click the **SVG Draw** icon in the left ribbon (or run **New SVG drawing** from
   the Command Palette).
2. Choose a name and location, and a blank canvas opens in the editor.
3. Draw something, then save (`Ctrl/Cmd + S`).
4. A `.png` and `.svg` of your drawing appear next to the note automatically.

Want to turn notes you already have into a drawing? Open the note and run
**Convert note to SVG drawing**.

---

## Embedding a drawing in another note

Because each save produces a companion image, you embed a drawing the same way you'd
embed any image:

```markdown
![[my-diagram.png]]
```

The image renders in reading view, and **clicking it opens the drawing editor** so
you can make changes — your edits flow back to the embedded image on the next save.

### Embedding a single frame

If a drawing has a [frame](docs/settings.md), you can embed just that frame's region by
adding its name as a subpath — no separate image file needed:

```markdown
![[my-diagram#frame_1]]
```

The frame is rendered live from the drawing's current content, so it always reflects
the latest edits. Clicking it opens the source drawing. (`frame_1` is the frame's name;
use whatever you named the frame.)

---

## Linking vault files into a drawing

Two editor actions create a tracked link from the drawing back to a file in your vault:

- **Image tool → Import from vault** — pick an image from your vault and it's embedded
  on the canvas. If that image is the companion of another drawing (a note with the same
  name), the link points to the **source note**; otherwise it points to the image file.
  You can also pick a drawing directly: if it has frames, you're asked which frame to
  import (or the whole drawing), and only that region is inserted with a `[[note#frame]]`
  link.
- **Shape library → attach a link** — when you save an object to the shape library you
  can attach a link to any vault file. Every time you insert that shape, the link is
  recorded too.

Each tracked link is written as a wikilink in an auto-managed **`## Linked Files`**
section near the top of the note, so it shows up in Obsidian's graph and backlinks:

```markdown
## Linked Files
- [[source-note]]
- [[diagram.png]]
```

You don't edit this section by hand — the plugin rebuilds it on every save from the
objects currently on the canvas. A link stays as long as **any** object from that import
survives; recoloring, resizing, ungrouping, or deleting *some* of the pieces keeps it.
The link is removed only when **all** objects from that import are gone.

---

## How it works

A drawing is an ordinary Markdown note with a small marker in its frontmatter and the
vector image stored inside it. When you open the note, the plugin shows the visual
editor instead of the raw text. On save, it renders the drawing out to companion
image files so the picture is available to the rest of your vault.

You can always drop back to the plain Markdown with the
**Toggle drawing / markdown view** command.

---

## Documentation

- **[Commands](docs/commands.md)** — everything you can do from the Command Palette
  and ribbon.
- **[Settings](docs/settings.md)** — every option, what it does, and its possible
  values.
- **[Frontmatter fields](docs/frontmatter.md)** — per-file overrides you can add to a
  single drawing.

Tip: most behavior can be set at three levels — **globally**, **per-folder**, or
**per-file** — with the more specific level winning. See
[Settings](docs/settings.md) for details.

---

## Credits

Built on [SVG-Edit](https://github.com/SVG-Edit/svgedit), a powerful browser-based
SVG editor.
