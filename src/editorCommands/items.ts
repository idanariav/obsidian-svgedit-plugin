/**
 * Pure logic behind the "SVG: run editor command…" picker — kept free of the
 * `obsidian` import so it is unit-testable.
 */

/** One entry of svgedit's `editor.commands.list()` (see svgedit-dist/hostApi.d.ts). */
export interface EditorCommandInfo {
  id: string;
  label: string;
  group: string;
  keys: string[];
  enabled: boolean;
  disabledReason?: string;
  interactive: boolean;
}

/** What a drawing's editor offers to callers other than its own UI: the picker
 *  today, an LLM / CLI / MCP bridge later. */
export interface EditorCommands {
  list(): EditorCommandInfo[];
  /** Throws svgedit's `CommandError` (`unknown` | `disabled` | `badParams` | `internal`). */
  run(id: string, params?: Record<string, unknown>): unknown;
}

/**
 * The commands the picker offers: everything that can be run without further
 * input. Interactive ones (they open a dialog or file picker) are left out, and
 * unavailable ones are kept — shown greyed with their reason — but sorted last,
 * so the list a user types into starts with what will actually work.
 */
export function pickableCommands(all: EditorCommandInfo[]): EditorCommandInfo[] {
  const usable = all.filter((c) => !c.interactive);
  return [...usable.filter((c) => c.enabled), ...usable.filter((c) => !c.enabled)];
}

/** The text the picker's fuzzy search matches against. */
export function searchText(c: EditorCommandInfo): string {
  return `${c.label} ${c.group}`;
}

/** Secondary line shown under a command: why it is unavailable, else its group and keys. */
export function describe(c: EditorCommandInfo): string {
  if (!c.enabled) return c.disabledReason ?? "Not available right now";
  return c.keys.length ? `${c.group} · ${c.keys.join(", ")}` : c.group;
}
