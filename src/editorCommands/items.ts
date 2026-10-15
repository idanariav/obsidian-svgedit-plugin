/**
 * Pure logic behind the "SVG: run editor command…" picker — kept free of the
 * `obsidian` import so it is unit-testable.
 */

/** svgedit's `ParamSpec` (src/editor/commands.js): one typed parameter of a command. */
export interface ParamSpec {
  type: "number" | "string" | "boolean" | "enum";
  default?: unknown;
  min?: number;
  max?: number;
  values?: string[];
  required?: boolean;
}

/** One entry of svgedit's `editor.commands.list()` (see svgedit-dist/hostApi.d.ts). */
export interface EditorCommandInfo {
  id: string;
  label: string;
  group: string;
  keys: string[];
  enabled: boolean;
  disabledReason?: string;
  params?: Record<string, ParamSpec>;
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

/** Whether choosing the command must first ask for values. */
export function needsParams(c: EditorCommandInfo): boolean {
  return !!c.params && Object.keys(c.params).length > 0;
}

/**
 * Turn what the user typed into the `params` object for `run`. Blank optional
 * fields are left out (the editor applies the spec's default); the editor
 * validates and clamps the rest. Returns the first problem as `error`.
 */
export function readParams(
  specs: Record<string, ParamSpec>,
  raw: Record<string, string | boolean>,
): { params: Record<string, unknown> } | { error: string } {
  const params: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(specs)) {
    const v = raw[name];
    if (spec.type === "boolean") {
      params[name] = v === true;
      continue;
    }
    const text = typeof v === "string" ? v.trim() : "";
    if (text === "") {
      if (spec.required) return { error: `"${name}" is required` };
      continue;
    }
    if (spec.type === "number") {
      const n = Number(text);
      if (!Number.isFinite(n)) return { error: `"${name}" must be a number` };
      params[name] = n;
    } else {
      params[name] = text;
    }
  }
  return { params };
}
