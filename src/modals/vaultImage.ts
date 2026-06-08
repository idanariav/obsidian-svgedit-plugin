import { App, FuzzySuggestModal, TFile } from "obsidian";
import { IMAGE_EXTENSIONS } from "../constants";
import { isSvgDrawingFile } from "../data/frontmatter";
import { extractSvg } from "../data/SvgData";

/** Host bridge svgedit feature-detects on `window` to offer "import/link from vault". */
export interface SvgEditHost {
  pickVaultImage(): Promise<
    | { dataUrl: string; link: string; locked?: boolean }
    // An unlocked whole-drawing import carries the source's full SVG so svgedit
    // inserts it as editable elements rather than a flattened <image>. `dataUrl`
    // is still provided for the import dialog's preview thumbnail.
    | { dataUrl: string; link: string; editableSvg: string }
    | null
  >;
  /** List the vault's linkable files so the editor can offer them inline (a
   *  native <datalist>) instead of opening a separate host picker. Each entry
   *  pairs the searchable display path with the wikilink to record. */
  listVaultFiles(): { path: string; link: string }[];
}

declare global {
  interface Window {
    svgEditHost?: SvgEditHost;
  }
}

/**
 * Open a fuzzy file picker and resolve with the chosen file, or null if the
 * modal is dismissed without a choice. `filter` narrows the candidate files.
 */
export function pickVaultFile(
  app: App,
  placeholder: string,
  filter?: (f: TFile) => boolean,
): Promise<TFile | null> {
  return new Promise((resolve) => {
    let chosen: TFile | null = null;
    const modal = new (class extends FuzzySuggestModal<TFile> {
      getItems(): TFile[] {
        const files = app.vault.getFiles();
        return filter ? files.filter(filter) : files;
      }
      getItemText(file: TFile): string {
        return file.path;
      }
      onChooseItem(file: TFile): void {
        chosen = file;
        resolve(file);
      }
      onClose(): void {
        // Defer so onChooseItem (which also closes) wins the resolve race.
        window.setTimeout(() => resolve(chosen), 0);
      }
    })(app);
    modal.setPlaceholder(placeholder);
    modal.open();
  });
}

/** Read a vault file and encode it as a `data:` URL suitable for an SVG <image> href. */
export async function fileToDataUri(app: App, file: TFile): Promise<string> {
  const binary = await app.vault.readBinary(file);
  const b64 = arrayBufferToBase64(binary);
  const mime = getMimeType(file.extension);
  return `data:${mime};base64,${b64}`;
}

/**
 * Encode an SVG string as an `image/svg+xml` data URL. Uses UTF-8-safe base64
 * (`btoa` alone throws on non-Latin1 characters, which frame text may contain).
 */
export function svgToDataUri(svg: string): string {
  const b64 = arrayBufferToBase64(new TextEncoder().encode(svg).buffer);
  return `data:image/svg+xml;base64,${b64}`;
}

/** Read a drawing file and return its embedded SVG string, or null if absent. */
export async function readDrawingSvg(app: App, file: TFile): Promise<string | null> {
  const content = await app.vault.cachedRead(file);
  return extractSvg(content);
}

/**
 * Open a fuzzy picker over frame names plus a leading "Whole drawing" entry.
 * Resolves with the chosen frame name, "" for the whole drawing, or null if
 * dismissed.
 */
export function pickFrame(app: App, frames: string[]): Promise<string | null> {
  const WHOLE = "Whole drawing";
  const items = [WHOLE, ...frames];
  return new Promise((resolve) => {
    let chosen: string | null = null;
    const modal = new (class extends FuzzySuggestModal<string> {
      getItems(): string[] {
        return items;
      }
      getItemText(item: string): string {
        return item;
      }
      onChooseItem(item: string): void {
        chosen = item === WHOLE ? "" : item;
        resolve(chosen);
      }
      onClose(): void {
        // Defer so onChooseItem (which also closes) wins the resolve race.
        window.setTimeout(() => resolve(chosen), 0);
      }
    })(app);
    modal.setPlaceholder("Pick a frame to import (or the whole drawing)…");
    modal.open();
  });
}

/**
 * Open a fuzzy picker to choose how an imported object should behave:
 * "unlocked" (an independent copy that never syncs) or "locked" (its content is
 * re-baked from the source whenever the embedding drawing is opened). For an
 * unlocked whole-drawing import the copy is editable SVG elements; otherwise
 * (frame crops, raster images) it is a frozen <image> snapshot. Resolves with
 * the chosen mode, or null if dismissed.
 */
export function pickImportMode(app: App): Promise<"locked" | "unlocked" | null> {
  const UNLOCKED = "Unlocked — an independent copy (won't sync)";
  const LOCKED = "Locked — auto-syncs from the source on open";
  const items = [UNLOCKED, LOCKED];
  return new Promise((resolve) => {
    let chosen: "locked" | "unlocked" | null = null;
    const modal = new (class extends FuzzySuggestModal<string> {
      getItems(): string[] {
        return items;
      }
      getItemText(item: string): string {
        return item;
      }
      onChooseItem(item: string): void {
        chosen = item === LOCKED ? "locked" : "unlocked";
        resolve(chosen);
      }
      onClose(): void {
        // Defer so onChooseItem (which also closes) wins the resolve race.
        window.setTimeout(() => resolve(chosen), 0);
      }
    })(app);
    modal.setPlaceholder("Import as locked or unlocked?");
    modal.open();
  });
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "bmp": return "image/bmp";
    case "svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

/**
 * Compute the wikilink text to record for a picked vault file, resolved against
 * the drawing that will hold the link.
 *
 * If `file` is an image that is the companion of a drawing (a sibling `<stem>.md`
 * exists and is an svg-plugin drawing), the link points to that source note so
 * the drawing references the real note rather than its rendered image. Otherwise
 * the link points to `file` itself.
 */
export function resolveVaultLink(app: App, file: TFile, drawingPath: string): string {
  const target = drawingSourceFor(app, file) ?? file;
  return app.metadataCache.fileToLinktext(target, drawingPath);
}

/**
 * True if an image file has a sibling `<stem>.md` note (e.g. "art/logo.png" →
 * "art/logo.md"). Such images are typically the rendered export of a drawing,
 * so the import picker offers the `.md` note instead of the duplicate image.
 */
export function hasCompanionMd(app: App, file: TFile): boolean {
  const companionPath = file.path.slice(0, -file.extension.length) + "md";
  return app.vault.getAbstractFileByPath(companionPath) instanceof TFile;
}

/**
 * Resolve the svg-plugin drawing a picked file represents, if any:
 * the file itself when it's a drawing note, or its sibling `<stem>.md` companion
 * when an image's source note is a drawing (e.g. "art/logo.png" → "art/logo.md").
 * Returns null for plain files with no drawing source.
 */
export function drawingSourceFor(app: App, file: TFile): TFile | null {
  if (file.extension.toLowerCase() === "md") {
    return isSvgDrawingFile(app, file) ? file : null;
  }
  if (IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) {
    const companionPath = file.path.slice(0, -file.extension.length) + "md";
    const companion = app.vault.getAbstractFileByPath(companionPath);
    if (companion instanceof TFile && isSvgDrawingFile(app, companion)) {
      return companion;
    }
  }
  return null;
}
