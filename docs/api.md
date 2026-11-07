# Scripting API

The plugin exposes a small headless API for scripts and agents, so a drawing can be
read, rewritten and exported without opening it in the editor:

```js
const api = app.plugins.plugins["obsidian-svg-plugin"].api;
```

From a terminal, reach it through the [Obsidian CLI](https://help.obsidian.md/cli)'s
`obsidian eval` (Obsidian must be running).

| Method | What it does |
|---|---|
| `readDrawing(path)` | The drawing's stored SVG, or `null` when the file has none. Returned as saved, including the plugin's bookkeeping attributes on the root `<svg>` (canvas background, plugin version). |
| `writeDrawing(path, svg, { snapshot? })` | Replaces the drawing's SVG and then runs the file's auto-export, the same as a save in the editor (companions and frame files follow its [export settings](settings.md)). `snapshot: "<name>"` first saves the current drawing as a [version](commands.md) with that name, replacing an existing version of the same name; it throws when the versions list is already full. An open editor showing the file is flushed first and then reloaded with the new content. |
| `saveVersion(path, name, svg)` | Saves `svg` as a [version](commands.md) named `name` (replacing an existing version of the same name) without changing the live drawing or running its export, e.g. to offer a suggested revision the user can restore. Throws when the versions list is already full. |
| `exportDrawing(path)` | Runs the file's auto-export on its stored drawing, without changing it. |

`path` is vault-relative (e.g. `Content/Frameworks/Boat (framework).md`). All of them
return promises. `obsidian eval` drops the result of slow async work, so for anything
that takes more than a moment, store the result on `window` and read it with a second eval.

```bash
obsidian eval code='(async()=>{const a=app.plugins.plugins["obsidian-svg-plugin"].api;
  window.__svg=await a.readDrawing("Content/Frameworks/Boat (framework).md")})()'
obsidian eval code='window.__svg.length'
```
