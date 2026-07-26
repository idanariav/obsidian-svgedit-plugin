import { describe, it, expect } from "vitest";
import { uniqueVaultPath } from "../../src/data/uniqueName";

describe("uniqueVaultPath", () => {
  it("returns the bare name when nothing exists yet", () => {
    const path = uniqueVaultPath(() => false, "Drawings", "claim x (drawing)", "md");
    expect(path).toBe("Drawings/claim x (drawing).md");
  });

  it("appends an incrementing numeric suffix on clashes", () => {
    const taken = new Set([
      "Drawings/claim x (drawing).md",
      "Drawings/claim x (drawing) 1.md",
    ]);
    const path = uniqueVaultPath((p) => taken.has(p), "Drawings", "claim x (drawing)", "md");
    expect(path).toBe("Drawings/claim x (drawing) 2.md");
  });

  it("uses vault root (no leading slash) when folder is blank", () => {
    const path = uniqueVaultPath(() => false, "", "claim x (drawing)", "md");
    expect(path).toBe("claim x (drawing).md");
  });

  it("tolerates a trailing slash on the folder", () => {
    const path = uniqueVaultPath(() => false, "Drawings/", "claim x (drawing)", "md");
    expect(path).toBe("Drawings/claim x (drawing).md");
  });
});
