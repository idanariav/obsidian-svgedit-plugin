import { App, FuzzySuggestModal, TFile } from "obsidian";
import { IMAGE_EXTENSIONS } from "../constants";
import { isSvgDrawingFile } from "../data/frontmatter";

/** Host bridge svgedit feature-detects on `window` to offer "import/link from vault". */
export interface SvgEditHost {
  pickVaultImage(): Promise<{ dataUrl: string; link: string } | null>;
  pickVaultFile(): Promise<{ link: string } | null>;
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
  let target = file;
  if (IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) {
    // Sibling note with the same stem (e.g. "art/logo.png" → "art/logo.md").
    const companionPath = file.path.slice(0, -file.extension.length) + "md";
    const companion = app.vault.getAbstractFileByPath(companionPath);
    if (companion instanceof TFile && isSvgDrawingFile(app, companion)) {
      target = companion;
    }
  }
  return app.metadataCache.fileToLinktext(target, drawingPath);
}
