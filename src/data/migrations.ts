// One-time migrations applied to a drawing's SVG when it's opened by a plugin
// version newer than the one that last saved it (see PLUGIN_VERSION_ATTR /
// getDrawingVersion in SvgData.ts, and the call in SvgView.setViewData). Add an
// entry here whenever a plugin/svgedit change requires rewriting previously
// saved drawings — e.g. a corrupted-attribute fix or an id-scheme change.
//
// Example:
//   { version: "1.1.0", migrate: (svg) => svg.replace(/fill="undefined"/g, "") }

export interface Migration {
  /** The migration runs on any drawing stamped with a version older than this. */
  version: string;
  migrate(svg: string): string;
}

// Ordered oldest-first; each runs at most once per drawing.
const MIGRATIONS: Migration[] = [];

/** Compare two "x.y.z" version strings: negative if a < b, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Apply every migration newer than `fromVersion`, in order. `fromVersion` of
 *  null means the drawing predates version-stamping entirely (treat as older
 *  than every migration). */
export function runMigrations(svg: string, fromVersion: string | null): string {
  const from = fromVersion ?? "0.0.0";
  let result = svg;
  for (const m of MIGRATIONS) {
    if (compareVersions(from, m.version) < 0) result = m.migrate(result);
  }
  return result;
}
