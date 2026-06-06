import { App, PluginSettingTab, Setting } from "obsidian";
import type SvgPlugin from "../main";
import type { ExportFolderMapping } from "./defaults";
import { FolderSuggest } from "./FolderSuggest";

/** "inherit" maps to undefined; "true"/"false" map to the matching boolean. */
type TriState = "inherit" | "true" | "false";

function toTriState(value: boolean | undefined): TriState {
  if (value === undefined) return "inherit";
  return value ? "true" : "false";
}

function fromTriState(value: TriState): boolean | undefined {
  if (value === "inherit") return undefined;
  return value === "true";
}

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

    // ── Open mode ────────────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Open mode");

    new Setting(containerEl)
      .setName("Open as Markdown by default")
      .setDesc(
        "When no per-file or per-folder override exists, open drawings in Markdown view instead of the SVG editor.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.openAsMarkdown)
          .onChange(async (v) => {
            this.plugin.settings.openAsMarkdown = v;
            await this.plugin.saveSettings();
          }),
      );

    // ── Appearance ───────────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Appearance");

    new Setting(containerEl)
      .setName("Editor theme")
      .setDesc(
        "Default theme for the SVG editor. \"Match Obsidian\" follows Obsidian's light/dark mode; "
        + "toggling the theme inside the editor updates this setting.",
      )
      .addDropdown((d) =>
        d
          .addOptions({
            auto: "Match Obsidian",
            light: "Light",
            dark: "Dark",
          })
          .setValue(this.plugin.settings.editorTheme)
          .onChange(async (v) => {
            this.plugin.settings.editorTheme = v as "auto" | "light" | "dark";
            await this.plugin.saveSettings();
            this.plugin.refreshOpenEditorThemes();
          }),
      );

    // ── Storage ──────────────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Storage");

    new Setting(containerEl)
      .setName("Compress drawing data")
      .setDesc(
        "Store the drawing compressed inside the note to keep files slim. "
        + "Turn off for readable, plain-text SVG (better git diffs and search). "
        + "Existing drawings migrate to the chosen format the next time they're saved.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.compressDrawingData)
          .onChange(async (v) => {
            this.plugin.settings.compressDrawingData = v;
            await this.plugin.saveSettings();
          }),
      );

    // ── Auto-export ──────────────────────────────────────────────────────────
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
      .setName("Transparent PNG background")
      .setDesc(
        "Export PNGs with a transparent background. When off, a white fill is painted behind the drawing.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.transparentBackground)
          .onChange(async (v) => {
            this.plugin.settings.transparentBackground = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Export region (frame name)")
      .setDesc(
        "Leave blank to export the whole canvas. Enter a frame name to crop exports to the matching frame. "
        + "If no frame matches, the whole canvas is exported. Frame rects are always stripped from exports.",
      )
      .addText((t) =>
        t
          .setPlaceholder("Whole canvas")
          .setValue(this.plugin.settings.exportFrame)
          .onChange(async (v) => {
            this.plugin.settings.exportFrame = v.trim();
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

    // ── File sync ────────────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("File sync");

    new Setting(containerEl)
      .setName("Keep companion files in sync")
      .setDesc(
        "When a drawing is renamed or deleted, automatically rename/delete its companion .svg and .png files.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.keepInSync)
          .onChange(async (v) => {
            this.plugin.settings.keepInSync = v;
            await this.plugin.saveSettings();
          }),
      );

    // ── Excalidraw import ─────────────────────────────────────────────────────
    // ── Conversion ────────────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Conversion");

    new Setting(containerEl)
      .setName("Add tag on conversion")
      .setDesc(
        "When converting a note into an SVG drawing, add a frontmatter tag to "
        + "mark it.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.addDrawingTag)
          .onChange(async (v) => {
            this.plugin.settings.addDrawingTag = v;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.addDrawingTag) {
      new Setting(containerEl)
        .setName("Tag text")
        .setDesc("The tag added to converted drawings (without a leading #).")
        .addText((t) =>
          t
            .setPlaceholder("svg")
            .setValue(this.plugin.settings.drawingTag)
            .onChange(async (v) => {
              this.plugin.settings.drawingTag = v;
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(containerEl).setHeading().setName("Excalidraw import");

    new Setting(containerEl)
      .setName("Remove Excalidraw data after converting")
      .setDesc(
        "When converting an Excalidraw drawing to SVG, delete the original "
        + "\"# Excalidraw Data\" section from the note. Off keeps it as inert text.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.removeExcalidrawData)
          .onChange(async (v) => {
            this.plugin.settings.removeExcalidrawData = v;
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
      .addText((t) => {
        new FolderSuggest(this.app, t.inputEl, async (v) => {
          this.plugin.settings.drawingsFolder = v.trim();
          await this.plugin.saveSettings();
        });
        t
          .setPlaceholder("Drawings")
          .setValue(this.plugin.settings.drawingsFolder)
          .onChange(async (v) => {
            this.plugin.settings.drawingsFolder = v.trim();
            await this.plugin.saveSettings();
          });
      });

    // ── Folder overrides ─────────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Folder overrides");

    containerEl.createEl("p", {
      text: "Per-folder settings override the global defaults above. "
        + "Use \"Inherit\" to fall back to the global value. "
        + "Individual file frontmatter (svg-open-md, svg-auto-export-png, svg-transparent-bg, svg-export-frame) takes highest priority.",
      cls: "setting-item-description",
    });

    // "Add folder" button
    new Setting(containerEl)
      .addButton((btn) =>
        btn
          .setButtonText("+ Add folder")
          .setCta()
          .onClick(async () => {
            this.plugin.settings.folderConfigs.push({ folder: "" });
            await this.plugin.saveSettings();
            this.display(); // re-render
          }),
      );

    // Render one block per folder config
    for (let i = 0; i < this.plugin.settings.folderConfigs.length; i++) {
      this.renderFolderBlock(containerEl, i);
    }

    // ── Export folder mappings ────────────────────────────────────────────────
    new Setting(containerEl).setHeading().setName("Export folder mappings");

    containerEl.createEl("p", {
      text: "Map drawings in a source folder to a different export folder for their companion .svg and .png files. "
        + "Longest-prefix match wins. If no mapping matches, companions are exported next to the drawing.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .addButton((btn) =>
        btn
          .setButtonText("+ Add mapping")
          .setCta()
          .onClick(async () => {
            this.plugin.settings.exportFolderMappings.push({ sourceFolder: "", exportFolder: "" });
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    for (let i = 0; i < this.plugin.settings.exportFolderMappings.length; i++) {
      this.renderMappingRow(containerEl, i);
    }
  }

  private renderMappingRow(containerEl: HTMLElement, index: number): void {
    const mapping: ExportFolderMapping = this.plugin.settings.exportFolderMappings[index];

    const wrapper = containerEl.createDiv("svg-plugin-mapping-row");
    wrapper.style.cssText =
      "border: 1px solid var(--background-modifier-border); " +
      "border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;";

    new Setting(wrapper)
      .setName("Source folder")
      .setDesc("Drawings in this vault folder (and sub-folders) use the custom export path.")
      .addText((t) => {
        new FolderSuggest(this.app, t.inputEl, async (v) => {
          this.plugin.settings.exportFolderMappings[index].sourceFolder = v.trim();
          await this.plugin.saveSettings();
        });
        t
          .setPlaceholder("Content/Concepts")
          .setValue(mapping.sourceFolder)
          .onChange(async (v) => {
            this.plugin.settings.exportFolderMappings[index].sourceFolder = v.trim();
            await this.plugin.saveSettings();
          });
      })
      .addButton((btn) =>
        btn
          .setIcon("trash")
          .setTooltip("Remove this mapping")
          .onClick(async () => {
            this.plugin.settings.exportFolderMappings.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(wrapper)
      .setName("Export folder")
      .setDesc("Companion files are written here instead of next to the drawing.")
      .addText((t) => {
        new FolderSuggest(this.app, t.inputEl, async (v) => {
          this.plugin.settings.exportFolderMappings[index].exportFolder = v.trim();
          await this.plugin.saveSettings();
        });
        t
          .setPlaceholder("Assets/Concepts")
          .setValue(mapping.exportFolder)
          .onChange(async (v) => {
            this.plugin.settings.exportFolderMappings[index].exportFolder = v.trim();
            await this.plugin.saveSettings();
          });
      });
  }

  private renderFolderBlock(containerEl: HTMLElement, index: number): void {
    const cfg = this.plugin.settings.folderConfigs[index];

    const wrapper = containerEl.createDiv("svg-plugin-folder-block");
    wrapper.style.cssText =
      "border: 1px solid var(--background-modifier-border); " +
      "border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;";

    // Folder path + remove button
    new Setting(wrapper)
      .setName("Folder path")
      .setDesc("Vault-relative path, e.g. Drawings/work")
      .addText((t) => {
        new FolderSuggest(this.app, t.inputEl, async (v) => {
          this.plugin.settings.folderConfigs[index].folder = v.trim();
          await this.plugin.saveSettings();
        });
        t
          .setPlaceholder("Folder/Path")
          .setValue(cfg.folder)
          .onChange(async (v) => {
            this.plugin.settings.folderConfigs[index].folder = v.trim();
            await this.plugin.saveSettings();
          });
      })
      .addButton((btn) =>
        btn
          .setIcon("trash")
          .setTooltip("Remove this folder override")
          .onClick(async () => {
            this.plugin.settings.folderConfigs.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    // Open as
    new Setting(wrapper)
      .setName("Open as")
      .setDesc("How to open drawings in this folder by default.")
      .addDropdown((d) =>
        d
          .addOptions({
            inherit: "Inherit (global default)",
            "false": "SVG editor",
            "true": "Markdown view",
          })
          .setValue(toTriState(cfg.openAsMarkdown))
          .onChange(async (v) => {
            this.plugin.settings.folderConfigs[index].openAsMarkdown = fromTriState(v as TriState);
            await this.plugin.saveSettings();
          }),
      );

    // Auto-export PNG
    new Setting(wrapper)
      .setName("Auto-export PNG")
      .setDesc("Whether to write a companion .png file on save.")
      .addDropdown((d) =>
        d
          .addOptions({
            inherit: "Inherit (global default)",
            "true": "Yes",
            "false": "No",
          })
          .setValue(toTriState(cfg.autoExportPng))
          .onChange(async (v) => {
            this.plugin.settings.folderConfigs[index].autoExportPng = fromTriState(v as TriState);
            await this.plugin.saveSettings();
          }),
      );

    // Transparent background
    new Setting(wrapper)
      .setName("Transparent PNG background")
      .setDesc("Whether exported PNGs use a transparent background.")
      .addDropdown((d) =>
        d
          .addOptions({
            inherit: "Inherit (global default)",
            "true": "Yes — transparent",
            "false": "No — white fill",
          })
          .setValue(toTriState(cfg.transparentBackground))
          .onChange(async (v) => {
            this.plugin.settings.folderConfigs[index].transparentBackground = fromTriState(v as TriState);
            await this.plugin.saveSettings();
          }),
      );

    // Export region (frame name)
    new Setting(wrapper)
      .setName("Export region (frame name)")
      .setDesc("Blank inherits the global value. Enter a frame name to crop exports to it for drawings in this folder.")
      .addText((t) =>
        t
          .setPlaceholder("Inherit")
          .setValue(cfg.exportFrame ?? "")
          .onChange(async (v) => {
            const trimmed = v.trim();
            this.plugin.settings.folderConfigs[index].exportFrame = trimmed === "" ? undefined : trimmed;
            await this.plugin.saveSettings();
          }),
      );
  }
}
