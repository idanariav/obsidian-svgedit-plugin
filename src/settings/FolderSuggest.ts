import { AbstractInputSuggest, App, TFolder } from "obsidian";

/**
 * Autocomplete suggestions of existing vault folders for a text input.
 * The vault root is offered as an empty value (rendered as "/ (vault root)").
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    private inputEl: HTMLInputElement,
    private onSelectCb: (value: string) => void,
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFolder[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getAllFolders(true)
      .filter((folder) => folder.path.toLowerCase().includes(lower));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.isRoot() ? "/ (vault root)" : folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    const value = folder.isRoot() ? "" : folder.path;
    this.inputEl.value = value;
    this.inputEl.trigger("input");
    this.onSelectCb(value);
    this.close();
  }
}
