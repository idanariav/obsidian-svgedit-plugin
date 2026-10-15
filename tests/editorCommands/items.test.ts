import { describe, it, expect } from "vitest";
import { describe as describeCommand, needsParams, pickableCommands, readParams, type EditorCommandInfo } from "../../src/editorCommands/items";

const cmd = (over: Partial<EditorCommandInfo>): EditorCommandInfo => ({
  id: "x", label: "X", group: "Tools", keys: [], enabled: true, interactive: false, ...over,
});

describe("pickableCommands", () => {
  it("leaves out commands that open a dialog or file picker", () => {
    const out = pickableCommands([cmd({ id: "a" }), cmd({ id: "open", interactive: true })]);
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });

  it("keeps unavailable commands but lists them after the ones that work, order otherwise kept", () => {
    const out = pickableCommands([
      cmd({ id: "off1", enabled: false, disabledReason: "Select something first" }),
      cmd({ id: "on1" }),
      cmd({ id: "off2", enabled: false }),
      cmd({ id: "on2" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["on1", "on2", "off1", "off2"]);
  });
});

describe("describe", () => {
  it("shows the reason for an unavailable command", () => {
    expect(describeCommand(cmd({ enabled: false, disabledReason: "Select two shapes" }))).toBe("Select two shapes");
  });
  it("falls back to a generic reason when the editor gave none", () => {
    expect(describeCommand(cmd({ enabled: false }))).toBe("Not available right now");
  });
  it("shows group and effective keys for an available one", () => {
    expect(describeCommand(cmd({ group: "Align", keys: ["meta+d", "ctrl+d"] }))).toBe("Align · meta+d, ctrl+d");
    expect(describeCommand(cmd({ group: "Align" }))).toBe("Align");
  });
});

describe("needsParams / readParams", () => {
  const specs = {
    n: { type: "number" as const, required: true },
    label: { type: "string" as const },
    on: { type: "boolean" as const },
  };

  it("asks only for commands that declare params", () => {
    expect(needsParams(cmd({}))).toBe(false);
    expect(needsParams(cmd({ params: {} }))).toBe(false);
    expect(needsParams(cmd({ params: specs }))).toBe(true);
  });

  it("types the values and leaves blank optional ones for the editor's defaults", () => {
    expect(readParams(specs, { n: " 12.5 ", label: "", on: true })).toEqual({ params: { n: 12.5, on: true } });
  });

  it("reports a missing required value or a non-number", () => {
    expect(readParams(specs, { n: "", on: false })).toEqual({ error: '"n" is required' });
    expect(readParams(specs, { n: "abc", on: false })).toEqual({ error: '"n" must be a number' });
  });
});
