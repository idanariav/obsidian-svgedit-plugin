import { App, PluginSettingTab, Setting } from "obsidian";
import type SvgPlugin from "../main";

export class SvgSettingsTab extends PluginSettingTab {
  plugin: SvgPlugin;

  constructor(app: App, plugin: SvgPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "SVG Draw" });

    // ── Export ───────────────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Auto-export");

    new Setting(containerEl)
      .setName("Export SVG on save")
      .setDesc("Write a companion .svg file next to the drawing on every save.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.autoExportSvg)
          .onChange(async (v) => {
            this.plugin.settings.autoExportSvg = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Export PNG on save")
      .setDesc("Write a companion .png file next to the drawing on every save.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.autoExportPng)
          .onChange(async (v) => {
            this.plugin.settings.autoExportPng = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("PNG scale")
      .setDesc("Pixel density multiplier for exported PNGs (1 = 1:1, 2 = 2×).")
      .addDropdown((d) =>
        d
          .addOptions({ "0.5": "0.5×", "1": "1×", "2": "2×", "4": "4×" })
          .setValue(String(this.plugin.settings.pngScale))
          .onChange(async (v) => {
            this.plugin.settings.pngScale = parseFloat(v);
            await this.plugin.saveSettings();
          }),
      );

    // ── Canvas defaults ───────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("New drawing defaults");

    new Setting(containerEl)
      .setName("Canvas width")
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.defaultCanvasWidth))
          .onChange(async (v) => {
            const n = parseInt(v);
            if (!isNaN(n) && n > 0) {
              this.plugin.settings.defaultCanvasWidth = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Canvas height")
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.defaultCanvasHeight))
          .onChange(async (v) => {
            const n = parseInt(v);
            if (!isNaN(n) && n > 0) {
              this.plugin.settings.defaultCanvasHeight = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Drawings folder")
      .setDesc(
        "Default vault folder for new drawings (e.g. Drawings). Leave blank for vault root.",
      )
      .addText((t) =>
        t
          .setPlaceholder("Drawings")
          .setValue(this.plugin.settings.drawingsFolder)
          .onChange(async (v) => {
            this.plugin.settings.drawingsFolder = v.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
