import { describe, it, expect, vi } from "vitest";
import { createSvgeditLogSink, describeLogData } from "../../src/debug/svgeditLogSink";

describe("describeLogData", () => {
  it("serializes Errors to name/message/stack", () => {
    const out = describeLogData(new TypeError("nope")) as Record<string, unknown>;
    expect(out).toMatchObject({ name: "TypeError", message: "nope" });
    expect(typeof out.stack).toBe("string");
  });

  it("reduces DOM nodes to a short tag", () => {
    const el = document.createElement("div");
    el.id = "x";
    expect(describeLogData(el)).toBe("<div#x>");
  });

  it("survives cyclic objects and passes primitives through", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(typeof describeLogData(a)).toBe("string");
    expect(describeLogData("s")).toBe("s");
    expect(describeLogData(undefined)).toBeUndefined();
  });
});

describe("createSvgeditLogSink", () => {
  it("writes svgedit-<level> lines to the debug log", () => {
    const debugLog = { log: vi.fn() };
    createSvgeditLogSink(debugLog, () => true)("warn", { message: "m", data: 3 });
    expect(debugLog.log).toHaveBeenCalledWith("svgedit-warn", { message: "m", data: 3 });
  });

  it("goes quiet once the plugin is no longer live", () => {
    const debugLog = { log: vi.fn() };
    let live = true;
    const sink = createSvgeditLogSink(debugLog, () => live);
    live = false;
    sink("error", { message: "late" });
    expect(debugLog.log).not.toHaveBeenCalled();
  });

  it("tolerates a missing debug log", () => {
    expect(() => createSvgeditLogSink(undefined, () => true)("warn", { message: "m" })).not.toThrow();
  });
});
