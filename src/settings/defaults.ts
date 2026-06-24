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
   *  drawings. Only its drawing content is used — the template's frontmatter and
   *  other markdown are ignored. Empty = start from a blank canvas. */
  defaultTemplate: string;
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
  /** Vault folder where downloaded custom fonts are stored as .woff2 files.
   *  Backs the svgedit userDataAdapter's font methods; as normal vault files
   *  they sync across devices independently of plugin-settings sync. */
  fontsFolder: string;
}

export const DEFAULT_SETTINGS: SvgPluginSettings = {
  autoExportSvg: true,
  autoExportPng: true,
  pngScale: 1,
  defaultCanvasWidth: 800,
  defaultCanvasHeight: 600,
  drawingsFolder: "",
  defaultTemplate: "",
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
  fontsFolder: "svgedit-fonts",
};
