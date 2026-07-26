import { describe, it, expect } from "vitest";
import { compareVersions, runMigrations } from "../../src/data/migrations";

describe("compareVersions", () => {
  it("orders by numeric component, not lexicographically", () => {
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
  });

  it("treats a missing patch component as 0", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0);
  });

  it("is 0 for equal versions", () => {
    expect(compareVersions("2.3.4", "2.3.4")).toBe(0);
  });
});

describe("runMigrations", () => {
  // No migrations are registered yet — this documents that until one is added,
  // every drawing's SVG passes through unchanged regardless of its stamped
  // (or missing) version.
  const SVG = "<svg><rect/></svg>";

  it("returns the SVG unchanged when no migrations are registered", () => {
    expect(runMigrations(SVG, null)).toBe(SVG);
    expect(runMigrations(SVG, "0.0.1")).toBe(SVG);
    expect(runMigrations(SVG, "99.0.0")).toBe(SVG);
  });
});
