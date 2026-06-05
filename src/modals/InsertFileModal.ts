import {
  App,
  FuzzySuggestModal,
  TFile,
  Notice,
} from "obsidian";
import { SvgView } from "../view/SvgView";
import { IMAGE_EXTENSIONS } from "../constants";
import { fileToDataUri, pickImportMode, resolveVaultLink } from "./vaultImage";

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
    // Locked imports re-bake from their source on every open; unlocked ones stay
    // a frozen snapshot. Both record a vault link so the drawing keeps a backlink.
    const mode = await pickImportMode(this.app);
    if (mode === null) return; // dismissed the mode picker
    const dataUri = await fileToDataUri(this.app, file);
    const link = resolveVaultLink(this.app, file, this.view.file?.path ?? "");
    const lockedAttr = mode === "locked" ? ` data-vault-locked="1"` : "";
    const fragment =
      `<image href="${dataUri}" data-vault-link="${escapeAttr(link)}"${lockedAttr}` +
      ` x="50" y="50" width="200" height="200"/>`;
    await this.view.insertSvgFragment(fragment);
  }

  private async insertWikiLink(file: TFile): Promise<void> {
    const linkText = this.app.metadataCache.fileToLinktext(file, "");
    const escaped = linkText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fragment = `<text x="50" y="80" font-family="sans-serif" font-size="16" fill="currentColor">[[${escaped}]]</text>`;
    await this.view.insertSvgFragment(fragment);
  }
}

/** Escape a value for safe inclusion in a double-quoted XML attribute. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
