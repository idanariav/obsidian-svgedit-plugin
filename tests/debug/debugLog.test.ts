import { describe, it, expect } from "vitest";
import { DebugLog } from "../../src/debug/debugLog";

/** Minimal in-memory stand-in for Obsidian's DataAdapter, covering only the
 *  methods DebugLog calls (exists/read/write/append/stat). */
function makeFakeAdapter() {
  const files = new Map<string, string>();
  return {
    files,
    adapter: {
      async exists(path: string) {
        return files.has(path);
      },
      async read(path: string) {
        return files.get(path) ?? "";
      },
      async write(path: string, data: string) {
        files.set(path, data);
      },
      async append(path: string, data: string) {
        files.set(path, (files.get(path) ?? "") + data);
      },
      async stat(path: string) {
        const content = files.get(path);
        return content === undefined ? null : { size: content.length, ctime: 0, mtime: 0, type: "file" as const };
      },
    },
  };
}

function makeFakeApp(adapter: ReturnType<typeof makeFakeAdapter>["adapter"]) {
  return { vault: { adapter } } as unknown as import("obsidian").App;
}

describe("DebugLog", () => {
  it("does nothing while disabled", async () => {
    const { adapter, files } = makeFakeAdapter();
    const log = new DebugLog(makeFakeApp(adapter), "debug.log", () => false);
    log.log("editor-init-start");
    await log.flush();
    expect(files.size).toBe(0);
  });

  it("buffers and flushes timestamped, JSON-detailed lines once enabled", async () => {
    const { adapter, files } = makeFakeAdapter();
    const log = new DebugLog(makeFakeApp(adapter), "debug.log", () => true);
    log.log("svg-changed", { file: "a.md", bytes: 42 });
    log.log("save-success", { ms: 5 });
    await log.flush();

    const contents = files.get("debug.log") ?? "";
    const lines = contents.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z svg-changed \{"file":"a\.md","bytes":42\}$/);
    expect(lines[1]).toMatch(/save-success \{"ms":5\}$/);
  });

  it("read() flushes pending lines first", async () => {
    const { adapter } = makeFakeAdapter();
    const log = new DebugLog(makeFakeApp(adapter), "debug.log", () => true);
    log.log("view-load", { bytes: 10 });
    const contents = await log.read();
    expect(contents).toContain("view-load");
  });

  it("clear() empties the log and future reads see nothing until logged again", async () => {
    const { adapter } = makeFakeAdapter();
    const log = new DebugLog(makeFakeApp(adapter), "debug.log", () => true);
    log.log("editor-init-start");
    await log.flush();
    await log.clear();
    expect(await log.read()).toBe("");
  });

  it("truncates the file once it grows past the size cap", async () => {
    const { adapter, files } = makeFakeAdapter();
    const log = new DebugLog(makeFakeApp(adapter), "debug.log", () => true);
    // Seed the file past the 1,000,000-char truncation threshold (2x the cap)
    // directly, then trigger one more append to run the cap check.
    files.set("debug.log", "x".repeat(1_000_001));
    log.log("save-success", { ms: 1 });
    await log.flush();

    const contents = files.get("debug.log") ?? "";
    expect(contents.length).toBeLessThan(1_000_001);
    expect(contents).toContain("save-success");
  });
});
