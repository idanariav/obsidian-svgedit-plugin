import { DropdownComponent, Modal, Notice, Setting, SliderComponent, ToggleComponent } from "obsidian";
import type SvgPlugin from "../main";
import type { SvgView } from "../view/SvgView";
import { listFonts } from "../data/fontVault";
import { refreshLockedEmbeds } from "../data/lockedEmbeds";
import { prepareSvgForCompare, type CompareFont, type CompareImage } from "../export/compare";

/** "current" or a snapshot id. */
type SourceId = string;
const CURRENT = "current";
const BLINK_MS = 700;

/**
 * Side-by-side / overlay comparison of two drawing versions (or a version and
 * the live canvas), opened from VersionsModal. Each side is rendered as an
 * <img> of a self-contained SVG (fonts and background baked in, see
 * compare.ts), so it shows exactly what an export would. Overlay stacks B over
 * A with an opacity slider, or blinks between them, which makes small moves and
 * size changes visible that side by side hides. Restore is offered per side.
 */
export class CompareModal extends Modal {
  private readonly view: SvgView;
  private a: SourceId = CURRENT;
  private b: SourceId;
  private mode: "side" | "overlay" = "side";
  private showComments = true;
  private opacity = 50;
  private blink = false;
  private blinkTimer: number | null = null;
  private fonts: CompareFont[] | null = null;
  private urls: string[] = [];
  private stageEl: HTMLElement | null = null;

  /** `onRestored` lets the opener (VersionsModal) close too after a Restore here. */
  constructor(
    private readonly plugin: SvgPlugin,
    view: SvgView,
    versionId: string,
    private readonly onRestored?: () => void,
  ) {
    super(plugin.app);
    this.view = view;
    this.b = versionId;
  }

  onOpen(): void {
    this.modalEl.addClass("svg-plugin-compare-modal");
    void this.render();
  }

  private sources(): Array<{ id: SourceId; name: string }> {
    return [{ id: CURRENT, name: "Current drawing" }, ...this.view.listSnapshots().map((s) => ({ id: s.id, name: s.name }))];
  }

  private nameOf(id: SourceId): string {
    return this.sources().find((s) => s.id === id)?.name ?? "";
  }

  private async image(id: SourceId): Promise<CompareImage | null> {
    const stored = id === CURRENT ? this.view.currentSvg() : this.view.listSnapshots().find((s) => s.id === id)?.svg;
    if (!stored) return null;
    this.fonts ??= await listFonts(this.app.vault, this.plugin.settings.fontsFolder);
    const svg = await refreshLockedEmbeds(this.app, stored, this.view.file?.path ?? "");
    return prepareSvgForCompare(svg, { showComments: this.showComments, fonts: this.fonts });
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    this.stopBlink();
    contentEl.empty();
    this.titleEl.setText("Compare versions");

    // One compact toolbar, so both images fit below it without scrolling.
    const bar = contentEl.createDiv({ cls: "svg-plugin-compare-toolbar" });
    const field = (label: string) => {
      const el = bar.createEl("label", { cls: "svg-plugin-compare-field" });
      el.createSpan({ text: label });
      return el;
    };
    const pick = (label: string, value: SourceId, set: (v: SourceId) => void) => {
      const d = new DropdownComponent(field(label));
      for (const s of this.sources()) d.addOption(s.id, s.name);
      d.setValue(value).onChange((v) => { set(v); void this.render(); });
    };
    const overlay = this.mode === "overlay";
    pick(overlay ? "A (bottom)" : "Left", this.a, (v) => (this.a = v));
    pick(overlay ? "B (top)" : "Right", this.b, (v) => (this.b = v));
    new DropdownComponent(field("View"))
      .addOptions({ side: "Side by side", overlay: "Overlay" })
      .setValue(this.mode)
      .onChange((v) => { this.mode = v as "side" | "overlay"; void this.render(); });
    new ToggleComponent(field("Comments"))
      .setValue(this.showComments)
      .onChange((v) => { this.showComments = v; void this.render(); });

    let topImg: HTMLImageElement | null = null;
    if (overlay) {
      new ToggleComponent(field("Blink"))
        .setValue(this.blink)
        .onChange((v) => { this.blink = v; void this.render(); });
      if (!this.blink) {
        new SliderComponent(field("B opacity"))
          .setLimits(0, 100, 1)
          .setValue(this.opacity)
          .onChange((v) => {
            this.opacity = v;
            if (topImg) topImg.style.opacity = String(v / 100);
          });
      }
    }

    this.stageEl = contentEl.createDiv({ cls: `svg-plugin-compare-stage is-${this.mode}` });
    const stage = this.stageEl;
    this.revokeUrls();
    const [imgA, imgB] = await Promise.all([this.image(this.a), this.image(this.b)]);
    if (stage !== this.stageEl) return; // a newer render replaced this one while we awaited
    if (!imgA || !imgB) {
      stage.createEl("p", { text: "Open the drawing in the editor to compare versions." });
      return;
    }
    const url = (im: CompareImage) => {
      const u = URL.createObjectURL(new Blob([im.svg], { type: "image/svg+xml;charset=utf-8" }));
      this.urls.push(u);
      return u;
    };
    const maxW = Math.max(imgA.width, imgB.width);

    if (this.mode === "side") {
      for (const [id, im] of [[this.a, imgA], [this.b, imgB]] as const) {
        const pane = stage.createDiv({ cls: "svg-plugin-compare-pane" });
        pane.createEl("img", { attr: { src: url(im), alt: this.nameOf(id) } });
        this.caption(pane, id);
      }
      return;
    }

    // Overlay: both at one scale (relative to the wider canvas), top-left aligned.
    const box = stage.createDiv({ cls: "svg-plugin-compare-overlay" });
    box.style.aspectRatio = `${maxW} / ${Math.max(imgA.height * (maxW / imgA.width), imgB.height * (maxW / imgB.width))}`;
    for (const [im, top] of [[imgA, false], [imgB, true]] as const) {
      const el = box.createEl("img", { attr: { src: url(im) } });
      el.style.width = `${(im.width / maxW) * 100}%`;
      if (top) topImg = el;
    }
    if (topImg) topImg.style.opacity = String(this.blink ? 1 : this.opacity / 100);
    const captions = stage.createDiv({ cls: "svg-plugin-compare-captions" });
    this.caption(captions.createDiv(), this.a, "A");
    this.caption(captions.createDiv(), this.b, "B");
    if (this.blink && topImg) {
      const el = topImg;
      this.blinkTimer = window.setInterval(() => {
        el.style.opacity = el.style.opacity === "0" ? "1" : "0";
      }, BLINK_MS);
    }
  }

  private caption(parent: HTMLElement, id: SourceId, prefix?: string): void {
    const s = new Setting(parent).setName(prefix ? `${prefix}: ${this.nameOf(id)}` : this.nameOf(id));
    if (id !== CURRENT) {
      s.addButton((b) =>
        b.setButtonText("Restore").setCta().onClick(async () => {
          await this.view.restoreSnapshot(id);
          new Notice(`Version "${this.nameOf(id)}" restored`);
          this.close();
          this.onRestored?.();
        }),
      );
    }
  }

  private stopBlink(): void {
    if (this.blinkTimer !== null) window.clearInterval(this.blinkTimer);
    this.blinkTimer = null;
  }

  private revokeUrls(): void {
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
  }

  onClose(): void {
    this.stopBlink();
    this.revokeUrls();
    this.contentEl.empty();
  }
}
