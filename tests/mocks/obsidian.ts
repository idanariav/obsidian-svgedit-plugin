/**
 * Minimal runtime stand-in for the `obsidian` package, for tests that need to
 * actually construct/drive a class extending it. The installed `obsidian`
 * package is types-only — `"main": ""`, no runtime JS at all — so
 * `class SvgView extends TextFileView` (and RestoreBackupModal extends Modal)
 * has nothing real to extend without a mock in place (see
 * tests/view/SvgView-reserved-fields.test.ts for why most SvgView coverage
 * avoids this route instead).
 *
 * Deliberately partial: only what src/view/SvgView.ts's onload/initEditor/
 * setViewData path (and its transitive imports' module-eval-time needs) touch
 * today. Expand as needed for a future test that drives more of SvgView —
 * e.g. a real save()/backup-restore flow would need `Vault`/`Notice`/IndexedDB
 * (see src/data/drawingBackup.ts) wired up too.
 */

import { vi } from "vitest";

function empty(this: HTMLElement): void {
  while (this.firstChild) this.removeChild(this.firstChild);
}

function createEl(
  this: HTMLElement,
  tag: string,
  opts?: { cls?: string | string[]; attr?: Record<string, string>; text?: string },
): HTMLElement {
  const el = document.createElement(tag);
  if (opts?.cls) el.className = Array.isArray(opts.cls) ? opts.cls.join(" ") : opts.cls;
  if (opts?.attr) for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v);
  if (opts?.text) el.textContent = opts.text;
  this.appendChild(el);
  return el;
}

function createDiv(this: HTMLElement, cls?: string): HTMLElement {
  return createEl.call(this, "div", cls ? { cls } : undefined);
}

function addClass(this: HTMLElement, cls: string): void {
  this.classList.add(cls);
}

function toggleClass(this: HTMLElement, cls: string, value: boolean): void {
  this.classList.toggle(cls, value);
}

/** Obsidian augments HTMLElement.prototype with these DOM convenience methods
 *  at app startup; jsdom has no idea about them, so install them once. */
function installDomExtensions(): void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.empty ??= empty;
  proto.createEl ??= createEl;
  proto.createDiv ??= createDiv;
  proto.addClass ??= addClass;
  proto.toggleClass ??= toggleClass;
}
installDomExtensions();

export class TFile {
  path = "";
  basename = "";
}

/** Bare enough for `around(WorkspaceLeaf.prototype, ...)` (monkey-around) to
 *  patch: it just needs real own methods on the prototype to wrap. Tests
 *  construct instances and call setViewState/detach directly rather than
 *  going through a real Workspace. */
export class WorkspaceLeaf {
  id?: string;
  view: unknown;
  detach(): void {}
  async setViewState(_state: unknown, _eState?: unknown): Promise<void> {}
}

export class Scope {
  register(): void {}
}

export const Platform = { isMobile: false };

export const setIcon = vi.fn();

export function normalizePath(path: string): string {
  return path;
}

export class Modal {
  app: unknown;
  contentEl: HTMLElement = document.createElement("div");
  constructor(app: unknown) {
    this.app = app;
  }
  open(): void {}
  close(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  addButton(cb: (btn: unknown) => unknown): this {
    cb({ setButtonText: () => ({ setCta: () => ({ onClick: () => {} }), onClick: () => {} }) });
    return this;
  }
}

export class TextFileView {
  app: any;
  leaf: any;
  contentEl: HTMLElement;
  file: TFile | null = null;
  data = "";
  scope: unknown;

  constructor(leaf: any) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.contentEl = document.createElement("div");
  }

  register(_cb: () => void): void {}
  registerEvent(_ref: unknown): void {}

  async save(_clear?: boolean): Promise<void> {
    this.data = (this as unknown as { getViewData(): string }).getViewData();
  }

  async onUnloadFile(_file: TFile): Promise<void> {}
}
