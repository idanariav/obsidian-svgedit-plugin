import type { App } from "obsidian";

/** Cap on the log file's size in characters; once exceeded the oldest content
 *  is dropped so a long debug session can't grow the file unbounded. */
const MAX_LOG_CHARS = 500_000;
/** How long to batch log lines before writing, so a burst of edits (e.g.
 *  dragging a path node) doesn't turn into one disk write per event. */
const FLUSH_DELAY_MS = 500;

/** Append-only action log for diagnosing hard-to-reproduce editor bugs (e.g. a
 *  path node edit that doesn't persist). Only active while the "Debug
 *  logging" setting is on — each call re-checks the live setting via
 *  `isEnabled`, so toggling it takes effect immediately for every open view
 *  without needing to push state to them. Writes land in the plugin's own
 *  config dir (not the vault), so the log never shows up in search/graph view
 *  and isn't synced. */
export class DebugLog {
  private buffer: string[] = [];
  private flushTimer: number | null = null;
  private flushing: Promise<void> = Promise.resolve();

  constructor(
    private readonly app: App,
    private readonly logPath: string,
    private readonly isEnabled: () => boolean,
  ) {}

  log(event: string, detail?: Record<string, unknown>): void {
    if (!this.isEnabled()) return;
    const line = `${new Date().toISOString()} ${event}${detail ? " " + JSON.stringify(detail) : ""}\n`;
    this.buffer.push(line);
    if (this.flushTimer === null) {
      this.flushTimer = window.setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, FLUSH_DELAY_MS);
    }
  }

  /** Write any buffered lines now (e.g. before the plugin unloads). Best-effort. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const lines = this.buffer.join("");
    this.buffer = [];
    this.flushing = this.flushing.then(() => this.append(lines)).catch(() => {});
    await this.flushing;
  }

  private async append(lines: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    try {
      if (await adapter.exists(this.logPath)) {
        await adapter.append(this.logPath, lines);
      } else {
        await adapter.write(this.logPath, lines);
      }
      const stat = await adapter.stat(this.logPath);
      if (stat && stat.size > MAX_LOG_CHARS * 2) {
        const existing = await adapter.read(this.logPath);
        await adapter.write(this.logPath, existing.slice(-MAX_LOG_CHARS));
      }
    } catch { /* best-effort */ }
  }

  /** Current log contents, or "" if none/on error. Used by the "Copy debug
   *  log" settings button. */
  async read(): Promise<string> {
    await this.flush();
    try {
      const adapter = this.app.vault.adapter;
      return (await adapter.exists(this.logPath)) ? await adapter.read(this.logPath) : "";
    } catch {
      return "";
    }
  }

  /** Empty the log file. Used by the "Clear debug log" settings button. */
  async clear(): Promise<void> {
    this.buffer = [];
    try {
      await this.app.vault.adapter.write(this.logPath, "");
    } catch { /* best-effort */ }
  }
}
