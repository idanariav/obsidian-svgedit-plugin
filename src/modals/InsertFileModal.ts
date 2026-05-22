import {
  App,
  FuzzySuggestModal,
  TFile,
  Notice,
} from "obsidian";
import { SvgView } from "../view/SvgView";
import { IMAGE_EXTENSIONS } from "../constants";

export class InsertFileModal extends FuzzySuggestModal<TFile> {
  private view: SvgView;

  constructor(app: App, view: SvgView) {
    super(app);
    this.view = view;
    this.setPlaceholder("Pick a vault file to insert into the drawing…");
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  async onChooseItem(file: TFile): Promise<void> {
    const ext = file.extension.toLowerCase();
    try {
      if (IMAGE_EXTENSIONS.has(ext)) {
        await this.insertImage(file);
      } else {
        await this.insertWikiLink(file);
      }
    } catch (e: unknown) {
      new Notice(`Insert failed: ${(e as Error).message}`);
    }
  }

  private async insertImage(file: TFile): Promise<void> {
    const binary = await this.app.vault.readBinary(file);
    const b64 = arrayBufferToBase64(binary);
    const mime = getMimeType(file.extension);
    const dataUri = `data:${mime};base64,${b64}`;

    const fragment = `<image href="${dataUri}" x="50" y="50" width="200" height="200"/>`;
    await this.view.insertSvgFragment(fragment);
  }

  private async insertWikiLink(file: TFile): Promise<void> {
    const linkText = this.app.metadataCache.fileToLinktext(file, "");
    const escaped = linkText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fragment = `<text x="50" y="80" font-family="sans-serif" font-size="16" fill="currentColor">[[${escaped}]]</text>`;
    await this.view.insertSvgFragment(fragment);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function getMimeType(ext: string): string {
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
