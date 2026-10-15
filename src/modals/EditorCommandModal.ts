import { App, Notice, SuggestModal } from "obsidian";
import { EditorCommandParamsModal } from "./EditorCommandParamsModal";
import {
  describe,
  needsParams,
  pickableCommands,
  searchText,
  type EditorCommandInfo,
  type EditorCommands,
} from "../editorCommands/items";

/**
 * "SVG: run editor command…" — one palette entry that reaches every editor
 * command of the active drawing, instead of ~150 entries in Obsidian's palette.
 * Unavailable commands are listed greyed with their reason; choosing one shows
 * that reason instead of running.
 */
export class EditorCommandModal extends SuggestModal<EditorCommandInfo> {
  constructor(app: App, private readonly commands: EditorCommands) {
    super(app);
    this.setPlaceholder("Run an editor command…");
  }

  getSuggestions(query: string): EditorCommandInfo[] {
    const q = query.trim().toLowerCase();
    const all = pickableCommands(this.commands.list());
    if (!q) return all;
    // Every word must appear, so "align left" finds "Align left edges".
    const words = q.split(/\s+/);
    return all.filter((c) => {
      const text = searchText(c).toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }

  renderSuggestion(c: EditorCommandInfo, el: HTMLElement): void {
    el.toggleClass("svg-plugin-command-disabled", !c.enabled);
    el.createDiv({ text: c.label });
    el.createEl("small", { text: describe(c), cls: "svg-plugin-command-hint" });
  }

  onChooseSuggestion(c: EditorCommandInfo): void {
    if (!c.enabled) {
      new Notice(`${c.label}: ${c.disabledReason ?? "not available right now"}`);
      return;
    }
    if (needsParams(c)) {
      new EditorCommandParamsModal(this.app, c, (params) => this.run(c, params)).open();
      return;
    }
    this.run(c);
  }

  private run(c: EditorCommandInfo, params?: Record<string, unknown>): void {
    try {
      if (params) this.commands.run(c.id, params);
      else this.commands.run(c.id);
    } catch (e) {
      new Notice(`${c.label}: ${(e as Error).message}`);
    }
  }
}
