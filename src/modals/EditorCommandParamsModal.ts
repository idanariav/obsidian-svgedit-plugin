import { App, Modal, Setting } from "obsidian";
import { readParams, type EditorCommandInfo, type ParamSpec } from "../editorCommands/items";

/**
 * Asks for the parameters of an editor command (`HostCommandInfo.params`) and
 * hands the typed values to `onSubmit`. Invalid input stays in the dialog.
 */
export class EditorCommandParamsModal extends Modal {
  private readonly raw: Record<string, string | boolean> = {};
  private errorEl?: HTMLElement;

  constructor(
    app: App,
    private readonly command: EditorCommandInfo,
    private readonly onSubmit: (params: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.command.label });
    for (const [name, spec] of Object.entries(this.command.params ?? {})) this.addField(name, spec);
    this.errorEl = contentEl.createEl("p", { cls: "svg-plugin-command-hint" });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Run").setCta().onClick(() => this.submit()))
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }

  private addField(name: string, spec: ParamSpec): void {
    const setting = new Setting(this.contentEl).setName(spec.required ? `${name} *` : name);
    const initial = spec.default;
    if (spec.type === "boolean") {
      this.raw[name] = initial === true;
      setting.addToggle((t) => t.setValue(initial === true).onChange((v) => (this.raw[name] = v)));
    } else if (spec.type === "enum") {
      this.raw[name] = String(initial ?? spec.values?.[0] ?? "");
      setting.addDropdown((d) => {
        for (const v of spec.values ?? []) d.addOption(v, v);
        d.setValue(String(this.raw[name])).onChange((v) => (this.raw[name] = v));
      });
    } else {
      this.raw[name] = initial === undefined ? "" : String(initial);
      setting.addText((t) => t.setValue(String(this.raw[name])).onChange((v) => (this.raw[name] = v)));
    }
  }

  private submit(): void {
    const res = readParams(this.command.params ?? {}, this.raw);
    if ("error" in res) {
      this.errorEl?.setText(res.error);
      return;
    }
    this.close();
    this.onSubmit(res.params);
  }
}
