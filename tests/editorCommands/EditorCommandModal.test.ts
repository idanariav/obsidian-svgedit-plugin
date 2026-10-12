import { describe, it, expect, beforeEach, vi } from "vitest";
import { Notice } from "obsidian";
import { EditorCommandModal } from "../../src/modals/EditorCommandModal";
import type { EditorCommandInfo, EditorCommands } from "../../src/editorCommands/items";

const cmd = (over: Partial<EditorCommandInfo>): EditorCommandInfo => ({
  id: "x", label: "X", group: "Tools", keys: [], enabled: true, interactive: false, ...over,
});

const LIST: EditorCommandInfo[] = [
  cmd({ id: "align_left", label: "Align left edges", group: "Align" }),
  cmd({ id: "path_union", label: "Union", group: "Path", enabled: false, disabledReason: "Select two shapes" }),
  cmd({ id: "file_open", label: "Open file", group: "File", interactive: true }),
  cmd({ id: "tool_clone", label: "Duplicate", group: "Edit", keys: ["meta+d"] }),
];

function open(run: EditorCommands["run"] = vi.fn()) {
  const commands: EditorCommands = { list: () => LIST, run };
  return { modal: new EditorCommandModal({} as never, commands), run };
}

describe("EditorCommandModal", () => {
  beforeEach(() => { Notice.shown.length = 0; });

  it("offers runnable commands first, greyed unavailable ones after, and never interactive ones", () => {
    const { modal } = open();
    expect(modal.getSuggestions("").map((c) => c.id)).toEqual(["align_left", "tool_clone", "path_union"]);
  });

  it("matches every typed word against the label and group", () => {
    const { modal } = open();
    expect(modal.getSuggestions("align left").map((c) => c.id)).toEqual(["align_left"]);
    expect(modal.getSuggestions("path union").map((c) => c.id)).toEqual(["path_union"]);
    expect(modal.getSuggestions("nothing like this")).toEqual([]);
  });

  it("runs the chosen command by id", () => {
    const { modal, run } = open();
    modal.onChooseSuggestion(LIST[0]);
    expect(run).toHaveBeenCalledWith("align_left");
    expect(Notice.shown).toEqual([]);
  });

  it("says why instead of running an unavailable command", () => {
    const { modal, run } = open();
    modal.onChooseSuggestion(LIST[1]);
    expect(run).not.toHaveBeenCalled();
    expect(Notice.shown).toEqual(["Union: Select two shapes"]);
  });

  it("shows the editor's error when a command throws", () => {
    const { modal } = open(() => { throw new Error("boom"); });
    modal.onChooseSuggestion(LIST[0]);
    expect(Notice.shown).toEqual(["Align left edges: boom"]);
  });

  it("renders the label, with the group and keys (or the reason) under it, and greys unavailable ones", () => {
    const { modal } = open();
    const render = (c: EditorCommandInfo) => {
      const el = document.createElement("div");
      modal.renderSuggestion(c, el);
      return el;
    };
    const ok = render(LIST[3]);
    expect(ok.querySelector("div")!.textContent).toBe("Duplicate");
    expect(ok.querySelector("small")!.textContent).toBe("Edit · meta+d");
    expect(ok.classList.contains("svg-plugin-command-disabled")).toBe(false);
    const off = render(LIST[1]);
    expect(off.querySelector("small")!.textContent).toBe("Select two shapes");
    expect(off.classList.contains("svg-plugin-command-disabled")).toBe(true);
  });
});
