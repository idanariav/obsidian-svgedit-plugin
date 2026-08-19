/** Maps drawings in a source folder to a different export destination folder. */
export interface ExportFolderMapping {
  sourceFolder: string; // e.g., "Content/Concepts"
  exportFolder: string; // e.g., "Assets/Concepts"
}

/** Per-folder override — undefined means "inherit from global" */
export interface FolderConfig {
  folder: string;
  openAsMarkdown?: boolean;
  autoExportSvg?: boolean;
  autoExportPng?: boolean;
  transparentBackground?: boolean;
  /** Name of the frame to crop exports to. Empty/undefined inherits the global value. */
  exportFrame?: string;
}

/** One saved entry in the shape library. Mirrors the svgedit fork's user-shape
 *  schema (see userShapes.js); persisted here so it survives plugin updates. */
export interface UserShapeEntry {
  svgContent: string;
  bbox: { x: number; y: number; width: number; height: number };
  /** Provenance wikilink stamped onto inserted elements, when set. */
  linkedFile?: string;
}

/** The saved shape library: ordered categories + their shapes. Matches the
 *  store shape the svgedit userDataAdapter reads/writes. */
export interface UserShapeStore {
  categories: string[];
  shapes: Record<string, Record<string, UserShapeEntry>>;
  /** Display-name overrides per category id (built-in or user). Lets the editor
   *  rename categories — including read-only built-ins — non-destructively. */
  categoryLabels?: Record<string, string>;
  /** Built-in category ids hidden from the library (restorable; bundled data
   *  is never mutated). */
  hidden?: string[];
}

/** One saved style preset ("class"). Mirrors the svgedit fork's classLibrary
 *  schema; persisted here so presets sync via data.json instead of the editor's
 *  per-device localStorage. */
export interface ClassLibraryEntry {
  name: string;
  scope: "text" | "shape" | "any";
  attrs: Record<string, string>;
}

/** One user-curated canvas-size preset. Mirrors the svgedit fork's
 *  seCanvasSettings schema; persisted here so presets sync via data.json
 *  instead of the editor's per-device localStorage. */
export interface CanvasPreset {
  ratio: string;
  w: number;
  h: number;
}

/** One saved canvas "layout" (template). Mirrors the svgedit fork's
 *  canvasLayouts schema; persisted here so layouts sync via data.json instead of
 *  the editor's per-device localStorage. `svg` holds the full captured canvas. */
export interface CanvasLayout {
  name: string;
  w: number;
  h: number;
  bg: string;
  svg: string;
}

/** Resolved, concrete settings for a specific file (no undefined values). */
export interface EffectiveDrawingSettings {
  openAsMarkdown: boolean;
  autoExportSvg: boolean;
  autoExportPng: boolean;
  transparentBackground: boolean;
  /** Name of the frame to crop exports to. Empty string = export the whole canvas. */
  exportFrame: string;
}

export interface SvgPluginSettings {
  autoExportSvg: boolean;
  autoExportPng: boolean;
  pngScale: number;
  defaultCanvasWidth: number;
  defaultCanvasHeight: number;
  drawingsFolder: string;
  /** Vault path of a drawing whose Sketch Editor Data seeds new/converted
   *  drawings. New (not converted) drawings prefer creating via Templater
   *  itself when installed (see integrations/templater.ts), so the template's
   *  own script/frontmatter render normally; otherwise they inherit its static
   *  frontmatter fields (see resolveTemplateFrontmatter in commands.ts) without
   *  overwriting fields the note already has. Empty = start from a blank canvas. */
  defaultTemplate: string;
  /** Vault path of a drawing whose Sketch Editor Data seeds "Convert note to
   *  SVG drawing". Read directly (via extractSvg) — no Templater execution —
   *  so if defaultTemplate relies on Templater to dynamically embed a drawing,
   *  point this at that literal drawing file instead of at defaultTemplate.
   *  Empty = start from a blank canvas. */
  defaultDrawingTemplate: string;
  /** Restricts the "Default template" and "Default drawing template" file
   *  suggesters to this folder (and its subfolders). Empty = search the whole
   *  vault. */
  templatesFolder: string;
  /** Global default: open drawings in Markdown view (false = SVG view). */
  openAsMarkdown: boolean;
  /** Global default: export PNGs with transparent background (false = white fill). */
  transparentBackground: boolean;
  /** Global default frame name to crop exports to. Empty = export the whole canvas. */
  exportFrame: string;
  /** Per-folder overrides, applied before per-file frontmatter. */
  folderConfigs: FolderConfig[];
  /** When true, rename/delete of a drawing also renames/deletes its companion files. */
  keepInSync: boolean;
  /** When converting an Excalidraw drawing, remove the original Excalidraw data
   *  (the "# Excalidraw Data" section) from the note. False keeps it as inert text. */
  removeExcalidrawData: boolean;
  /** When converting a markdown note into an svgedit drawing, add a frontmatter
   *  tag to mark it. When false, no tag is stamped. */
  addDrawingTag: boolean;
  /** The tag text added on conversion when addDrawingTag is true (no leading #). */
  drawingTag: string;
  /** Custom export destinations: drawings in sourceFolder export to exportFolder. */
  exportFolderMappings: ExportFolderMapping[];
  /** Persisted svgedit editor theme. "auto" follows Obsidian's light/dark mode;
   *  "light"/"dark" is the user's explicit in-editor choice, remembered across
   *  files and sessions. */
  editorTheme: "auto" | "light" | "dark";
  /** svgedit UI mode used when Obsidian runs on a desktop/PC. "tablet" enables
   *  svgedit's touch-first shell; "desktop" uses the standard layout. */
  uiModeDesktop: "desktop" | "tablet";
  /** svgedit UI mode used when Obsidian runs on a mobile device. */
  uiModeMobile: "desktop" | "tablet";
  /** When true, the drawing SVG is stored LZString-compressed in the note to
   *  keep files slim. When false it is stored as readable SVG (better git diffs
   *  and plain-text search). Existing files migrate to the chosen format on the
   *  next save; reads handle both formats either way. */
  compressDrawingData: boolean;
  /** Custom palette color overrides (swatch index → color). Backs the svgedit
   *  userDataAdapter so palette customizations live in data.json and survive
   *  plugin updates instead of in the editor's unreachable localStorage. */
  paletteOverrides: Record<string, string>;
  /** Saved shape library. Backs the svgedit userDataAdapter (see paletteOverrides). */
  userShapes: UserShapeStore;
  /** Custom hotkey bindings (action id → list of canonical key combos). Backs the
   *  svgedit userDataAdapter so keyboard customizations live in data.json and
   *  survive plugin updates instead of in the editor's localStorage. */
  hotkeyOverrides: Record<string, string[]>;
  /** How many seconds after the last edit an open drawing with unsaved changes is
   *  flushed to its note. The timer is demand-armed: it counts from when you stop
   *  drawing, not on a fixed clock. Switching away, toggling view and closing
   *  always flush (and re-export) regardless; this just bounds how much
   *  in-progress work a crash could lose. 0 disables the timer. */
  autosaveSeconds: number;
  /** Ordered list of favorited action ids backing the right-click quick-action
   *  menu. Backs the svgedit userDataAdapter so favorites live in data.json and
   *  survive plugin updates instead of in the editor's localStorage. Empty =
   *  the editor's built-in default seed (cut/copy/paste/delete). */
  favorites: string[];
  /** Saved style-preset "class" library. Backs the svgedit userDataAdapter so
   *  presets live in data.json and sync across vaults instead of the editor's
   *  per-device localStorage. */
  classLibrary: ClassLibraryEntry[];
  /** User-curated canvas-size presets shown in the editor's Canvas settings
   *  popover. Backs the svgedit userDataAdapter so presets live in data.json and
   *  sync across vaults instead of the editor's per-device localStorage. Empty =
   *  the editor's built-in default presets. */
  canvasPresets: CanvasPreset[];
  /** Saved canvas layouts (templates) shown in the editor's Canvas settings
   *  popover. Backs the svgedit userDataAdapter so layouts live in data.json and
   *  sync across vaults instead of the editor's per-device localStorage. Each
   *  entry stores the full captured canvas SVG, so this can be sizable. */
  canvasLayouts: CanvasLayout[];
  /** Vault folder where downloaded custom fonts are stored as .woff2 files.
   *  Backs the svgedit userDataAdapter's font methods; as normal vault files
   *  they sync across devices independently of plugin-settings sync. */
  fontsFolder: string;
  /** Suffix appended to the note's name to build the new drawing's filename in
   *  the "New drawing for this file" command (e.g. "claim x" → "claim x (drawing)").
   *  Empty uses the note's name as-is. */
  newDrawingSuffix: string;
  /** Frontmatter field added to a drawing created via "New drawing for this
   *  file", set to a link back to the note. Empty = don't add a link. */
  newDrawingLinkField: string;
  /** When true, the plugin appends timestamped editor lifecycle/edit/save events
   *  to a local log file (see src/debug/debugLog.ts) — meant for capturing the
   *  sequence of actions leading up to a hard-to-reproduce bug. Off by default;
   *  the log lives outside the vault (plugin config dir), never syncs, and isn't
   *  read by anything else in the plugin. Also drives svgedit's dev-mode
   *  snapshot logger (see SvgView's setDebugLogger calls) — one toggle for
   *  both, rather than a second setting. Desynced selection/path-grip/group
   *  state that used to render in a separate on-canvas overlay now lands as
   *  "debug-snapshot" lines in this same log. */
  debugLogging: boolean;
  /** Frontmatter field added to the note by "New drawing for this file",
   *  containing a list of links to its drawings (a note can have more than
   *  one). Empty = don't add a link. */
  noteDrawingsField: string;
}

export const DEFAULT_SETTINGS: SvgPluginSettings = {
  autoExportSvg: true,
  autoExportPng: true,
  pngScale: 1,
  defaultCanvasWidth: 800,
  defaultCanvasHeight: 600,
  drawingsFolder: "",
  defaultTemplate: "",
  defaultDrawingTemplate: "",
  templatesFolder: "",
  openAsMarkdown: false,
  transparentBackground: false,
  exportFrame: "",
  folderConfigs: [],
  keepInSync: false,
  removeExcalidrawData: false,
  addDrawingTag: true,
  drawingTag: "svg",
  exportFolderMappings: [],
  editorTheme: "auto",
  uiModeDesktop: "desktop",
  uiModeMobile: "tablet",
  compressDrawingData: true,
  autosaveSeconds: 15,
  paletteOverrides: {},
  userShapes: { categories: [], shapes: {} },
  hotkeyOverrides: {},
  favorites: [],
  classLibrary: [],
  canvasPresets: [],
  canvasLayouts: [],
  fontsFolder: "svgedit-fonts",
  newDrawingSuffix: " (drawing)",
  newDrawingLinkField: "",
  noteDrawingsField: "",
  debugLogging: false,
};
