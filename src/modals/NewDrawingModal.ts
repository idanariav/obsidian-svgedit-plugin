import { App, Modal, Setting, normalizePath, TFolder } from "obsidian";
import { createDrawingTemplate } from "../data/SvgData";

export class NewDrawingModal extends Modal {
  private name = "Untitled";
  private folder: string;
  private onSubmit: (file: { path: string; content: string }) => void;

  constructor(
    app: App,
    defaultFolder: string,
    onSubmit: (file: { path: string; content: string }) => void,
  ) {
    super(app);
    this.folder = defaultFolder;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "New SVG Drawing" });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("File name (without extension)")
      .addText((text) =>
        text
          .setValue(this.name)
          .onChange((v) => (this.name = v.trim()))
          .inputEl.focus(),
      );

    new Setting(contentEl)
      .setName("Folder")
      .setDesc("Vault path for the new file (leave blank for vault root)")
      .addText((text) =>
        text.setValue(this.folder).onChange((v) => (this.folder = v.trim())),
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Create")
        .setCta()
        .onClick(() => {
          if (!this.name) return;
          const dir = this.folder ? this.folder.replace(/\/$/, "") + "/" : "";
          const path = normalizePath(`${dir}${this.name}.md`);
          this.onSubmit({ path, content: createDrawingTemplate() });
          this.close();
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
