import type { DebugLog } from "./debugLog";

/** What svgedit's central logger hands a host sink (see `Editor.setLogSink`
 *  in ../svgedit): the formatted message plus whatever extra value the call
 *  site passed (usually the caught Error, sometimes a DOM node). */
export type SvgeditLogRecord = { message: string; data?: unknown };
export type SvgeditLogSink = (level: string, record: SvgeditLogRecord) => void;

/** Make a log payload safe for `JSON.stringify` (DebugLog serializes details):
 *  Errors → name/message/stack, DOM nodes → a short selector-ish tag, anything
 *  else JSON-roundtripped with a String() fallback so a cyclic object can't
 *  throw inside the logging path. */
export function describeLogData(data: unknown): unknown {
  if (data === undefined || data === null) return undefined;
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack };
  }
  if (typeof Node !== "undefined" && data instanceof Node) {
    const el = data as Element;
    const id = el.id ? `#${el.id}` : "";
    return `<${el.nodeName.toLowerCase()}${id}>`;
  }
  if (typeof data !== "object") return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

/** Build the sink we hand to svgedit so its warnings/errors (previously only in
 *  the dev console, which users can't easily send us) land in the same debug
 *  log as the plugin's own events. svgedit's logger is page-global, so this is
 *  deliberately plugin-level: no per-view file tag, and `isLive` lets a sink
 *  left behind by an unloaded plugin go quiet. Whether anything is written is
 *  still decided by the "Debug logging" setting inside `DebugLog.log`. */
export function createSvgeditLogSink(
  debugLog: Pick<DebugLog, "log"> | undefined,
  isLive: () => boolean,
): SvgeditLogSink {
  return (level, { message, data }) => {
    if (!isLive()) return;
    debugLog?.log(`svgedit-${level}`, { message, data: describeLogData(data) });
  };
}
