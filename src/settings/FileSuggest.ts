import { AbstractInputSuggest, App, TFile } from "obsidian";
import { isSvgDrawingFile } from "../data/frontmatter";

/**
 * Autocomplete suggestions of existing Sketch Editor drawings for a text input.
 * Only markdown files recognized as drawings are offered.
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    private inputEl: HTMLInputElement,
    private onSelectCb: (value: string) => void,
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFile[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path.toLowerCase().includes(lower) &&
          isSvgDrawingFile(this.app, file),
      );
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
