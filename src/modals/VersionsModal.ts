import { Modal, Notice, Setting } from "obsidian";
import type SvgPlugin from "../main";
import type { SvgView } from "../view/SvgView";
import type { DrawingSnapshot } from "../data/SvgData";
import { ExportModal } from "./ExportModal";
import { MAX_DRAWING_SNAPSHOTS } from "../constants";

/** A short relative-time label ("just now", "5m ago", "3h ago", "2d ago"). */
function formatRelativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Drawing-versioning manager: lists up to MAX_DRAWING_SNAPSHOTS saved
 * snapshots of the current drawing with Restore/Rename/Replace/Delete/Export
 * actions, plus saving the live canvas as a new version. When all slots are
 * full, "Replace with current" on an existing row is the only way to save new
 * content — the always-visible list doubles as the "pick a slot to replace"
 * prompt, so there's no separate confirmation dialog. Destructive actions
 * (Delete/Replace/Restore) act immediately, matching the rest of the
 * plugin's modals.
 */
export class VersionsModal extends Modal {
  private readonly plugin: SvgPlugin;
  private readonly view: SvgView;
  private renamingId: string | null = null;
  private newName = "";

  constructor(plugin: SvgPlugin, view: SvgView) {
    super(plugin.app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Drawing versions" });

    const snapshots = this.view.listSnapshots();
    if (snapshots.length === 0) {
      contentEl.createEl("p", { text: "No saved versions yet." });
    }
    for (const snapshot of snapshots) this.renderRow(snapshot);
    this.renderSaveNew(snapshots.length);
  }

  private renderRow(snapshot: DrawingSnapshot): void {
    const { contentEl } = this;

    if (this.renamingId === snapshot.id) {
      new Setting(contentEl)
        .addText((text) =>
          text
            .setValue(this.newName)
            .onChange((v) => { this.newName = v; })
            .inputEl.focus(),
        )
        .addButton((b) =>
          b.setButtonText("Save").setCta().onClick(() => void this.commitRename(snapshot.id)),
        )
        .addButton((b) =>
          b.setButtonText("Cancel").onClick(() => { this.renamingId = null; this.render(); }),
        );
      return;
    }

    new Setting(contentEl)
      .setName(snapshot.name)
      .setDesc(`Saved ${formatRelativeTime(snapshot.createdAt)}`)
      .addButton((b) =>
        b.setButtonText("Restore").setCta().onClick(() => void this.doRestore(snapshot.id)),
      )
      .addButton((b) =>
        b.setButtonText("Rename").onClick(() => {
          this.renamingId = snapshot.id;
          this.newName = snapshot.name;
          this.render();
        }),
      )
      .addButton((b) =>
        b.setButtonText("Replace with current").onClick(() => void this.doReplace(snapshot.id)),
      )
      .addButton((b) =>
        b.setButtonText("Export").onClick(() => {
          new ExportModal(this.plugin, this.view, { svg: snapshot.svg, label: snapshot.name }).open();
        }),
      )
      .addButton((b) =>
        b.setWarning().setButtonText("Delete").onClick(() => void this.doDelete(snapshot.id)),
      );
  }

  private renderSaveNew(count: number): void {
    const { contentEl } = this;
    const atCapacity = count >= MAX_DRAWING_SNAPSHOTS;
    new Setting(contentEl)
      .setName("Save current as new version")
      .setDesc(
        atCapacity
          ? `All ${MAX_DRAWING_SNAPSHOTS} slots are full — replace or delete a version above to save new content.`
          : `Version ${count + 1}`,
      )
      .addButton((b) =>
        b
          .setButtonText("Save")
          .setCta()
          .setDisabled(atCapacity)
          .onClick(() => void this.doSaveNew(count)),
      );
  }

  private async doSaveNew(count: number): Promise<void> {
    await this.view.saveSnapshot(`Version ${count + 1}`);
    new Notice("Saved new version");
    this.render();
  }

  private async doReplace(id: string): Promise<void> {
    await this.view.replaceSnapshot(id);
    new Notice("Version updated");
    this.render();
  }

  private async doDelete(id: string): Promise<void> {
    await this.view.deleteSnapshot(id);
    this.render();
  }

  private async doRestore(id: string): Promise<void> {
    await this.view.restoreSnapshot(id);
    new Notice("Version restored");
    this.close();
  }

  private async commitRename(id: string): Promise<void> {
    const name = this.newName.trim();
    if (name) await this.view.renameSnapshot(id, name);
    this.renamingId = null;
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
