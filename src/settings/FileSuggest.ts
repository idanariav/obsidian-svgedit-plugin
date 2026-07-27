import { AbstractInputSuggest, App, TFile } from "obsidian";
import { isSvgDrawingFile } from "../data/frontmatter";
import { extractSvg } from "../data/SvgData";

/** True when `path` is `folder` itself or nested (at any depth) under it. Empty
 *  `folder` means unrestricted (the whole vault). */
function isUnderFolder(path: string, folder: string): boolean {
  if (!folder) return true;
  return path === folder || path.startsWith(folder + "/");
}

/**
 * Autocomplete suggestions of existing Sketch Editor drawings for a text input.
 * Only markdown files recognized as drawings are offered, optionally scoped to
 * a folder (and its subfolders) via `getFolder`.
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    private inputEl: HTMLInputElement,
    private onSelectCb: (value: string) => void,
    private getFolder: () => string = () => "",
  ) {
    super(app, inputEl);
  }

  async getSuggestions(query: string): Promise<TFile[]> {
    const lower = query.toLowerCase();
    const folder = this.getFolder().trim().replace(/\/$/, "");
    const candidates = this.app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path.toLowerCase().includes(lower) && isUnderFolder(file.path, folder),
      );

    const recognized = candidates.filter((file) => isSvgDrawingFile(this.app, file));
    if (!lower) return recognized;

    // Frontmatter-based recognition misses unrendered Templater template files:
    // a `<%* ... %>` script block in the frontmatter isn't valid YAML, so
    // metadataCache can't see a `sketch-editor-plugin: parsed` key in it even
    // though the file has a real Drawing block below. Fall back to the same
    // content check resolveTemplateSvg uses, for the remaining candidates once
    // there's a query to keep this from reading every note in the vault on focus.
    const unrecognized = candidates.filter((file) => !recognized.includes(file));
    for (const file of unrecognized) {
      if (extractSvg(await this.app.vault.cachedRead(file))) recognized.push(file);
    }
    return recognized;
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    this.inputEl.trigger("input");
    this.onSelectCb(file.path);
    this.close();
  }
}
