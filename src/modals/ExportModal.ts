import { Modal, Notice, Setting } from "obsidian";
import type SvgPlugin from "../main";
import type { SvgView } from "../view/SvgView";
import { exportSvg, exportPng, frameFileSuffix } from "../export/exporter";
import { listFrames } from "../export/frames";
import { resolveEffectiveSettings } from "../data/frontmatter";

/** Export a specific saved drawing version instead of the live canvas — see
 *  the `source` constructor param. */
export interface ExportModalSource {
  svg: string;
  /** Shown in the modal title and folded into the output filename so a
   *  snapshot export never collides with the normal companion export. */
  label: string;
}

/**
 * Interactive export dialog: pick format (PNG/SVG), transparency, and the export
 * region (whole canvas or a named frame from the current drawing). Defaults are
 * seeded from the file's resolved settings; the actual export runs through the
 * same exportSvg/exportPng pipeline as auto-export.
 */
export class ExportModal extends Modal {
  private readonly plugin: SvgPlugin;
  private readonly view: SvgView;
  private readonly source?: ExportModalSource;

  private format: "png" | "svg" = "png";
  private transparent: boolean;
  private frameName: string;

  /** `source`: export a saved version's stored SVG instead of the live
   *  canvas, without restoring it into the editor first. Note the stored SVG
   *  lacks the live canvas's font/image embedding (see getExportSvgString),
   *  so a version export may not embed custom fonts. */
  constructor(plugin: SvgPlugin, view: SvgView, source?: ExportModalSource) {
    super(plugin.app);
    this.plugin = plugin;
    this.view = view;
    this.source = source;
    const effective = resolveEffectiveSettings(plugin.app, view.file!, plugin.settings);
    this.transparent = effective.transparentBackground;
    this.frameName = effective.exportFrame;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.source ? `Export "${this.source.label}"` : "Export drawing" });

    const svgString = this.source?.svg ?? this.view.getExportSvgString() ?? "";
    const frames = listFrames(svgString);

    // Drop a stale default (e.g. a frame name that no longer exists) so the
    // region dropdown opens on a valid value.
    if (this.frameName && !frames.some((f) => f.name === this.frameName)) {
      this.frameName = "";
    }

    new Setting(contentEl)
      .setName("Format")
      .addDropdown((d) =>
        d
          .addOptions({ png: "PNG", svg: "SVG" })
          .setValue(this.format)
          .onChange((v) => { this.format = v as "png" | "svg"; }),
      );

    new Setting(contentEl)
      .setName("Transparent background")
      .setDesc("Applies to PNG export; SVG keeps its own background.")
      .addToggle((t) =>
        t
          .setValue(this.transparent)
          .onChange((v) => { this.transparent = v; }),
      );

    const regionOptions: Record<string, string> = { "": "Whole canvas" };
    for (const f of frames) regionOptions[f.name] = f.name;

    new Setting(contentEl)
      .setName("Region")
      .setDesc(
        frames.length
          ? "Whole canvas writes the usual companion file; a frame writes a separate <name>-<frame> file."
          : "No frames in this drawing — exporting the whole canvas.",
      )
      .addDropdown((d) =>
        d
          .addOptions(regionOptions)
          .setValue(this.frameName)
          .setDisabled(frames.length === 0)
          .onChange((v) => { this.frameName = v; }),
      );

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("Export")
        .setCta()
        .onClick(() => void this.doExport(svgString)),
    );
  }

  private async doExport(svgString: string): Promise<void> {
    const file = this.view.file;
    if (!file) return;
    // A one-off frame export goes to a distinct, frame-suffixed file so it is
    // never overwritten by the whole-canvas companion that auto-export-on-save
    // (re)writes. Whole-canvas exports use the normal companion path. A
    // version export is likewise suffixed with its label so it can't collide
    // with the normal companion file or another version's export.
    const suffix =
      (this.source ? frameFileSuffix(this.source.label) : "") + frameFileSuffix(this.frameName);
    try {
      if (this.format === "svg") {
        await exportSvg(this.app, file, svgString, this.plugin.settings, this.frameName, suffix);
      } else {
        await exportPng(
          this.app, file, svgString,
          this.plugin.settings.pngScale,
          this.transparent,
          this.plugin.settings,
          this.frameName,
          suffix,
          this.view.getCanvasBgColor(),
        );
      }
      new Notice(`Exported ${this.format.toUpperCase()}`);
      this.close();
    } catch (e: unknown) {
      new Notice(`Export failed: ${(e as Error).message}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
