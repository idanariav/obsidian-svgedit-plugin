import { App, Modal, Setting } from "obsidian";

export type RestoreChoice = "restore" | "discard" | "cancel";

/**
 * Shown when a drawing opens empty but a non-empty backup exists. Offers to
 * restore the backup, keep the empty drawing (dropping the backup), or cancel
 * (load empty but keep the backup for next time).
 */
export class RestoreBackupModal extends Modal {
  private basename: string;
  private onChoose: (choice: RestoreChoice) => void;
  private chosen = false;

  constructor(app: App, basename: string, onChoose: (choice: RestoreChoice) => void) {
    super(app);
    this.basename = basename;
    this.onChoose = onChoose;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Recover drawing?" });
    contentEl.createEl("p", {
      text:
        `"${this.basename}" opened empty, but a non-empty backup from a ` +
        `previous session exists. Restore it?`,
    });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Restore backup").setCta().onClick(() => this.choose("restore")),
      )
      .addButton((b) =>
        b.setButtonText("Keep empty").onClick(() => this.choose("discard")),
      )
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => this.choose("cancel")),
      );
  }

  private choose(choice: RestoreChoice): void {
    this.chosen = true;
    this.onChoose(choice);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    // Dismissed without picking (Esc / click-away) → keep the file as-is and
    // preserve the backup for a future attempt.
    if (!this.chosen) this.onChoose("cancel");
  }
}
