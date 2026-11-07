/**
 * Return an unused path for a new file: "<folder>/<name><suffix>.<ext>", or
 * "<folder>/<name> <n><suffix>.<ext>" (n = 1, 2, …; the counter goes before the
 * suffix, so "Note (sketch)" → "Note 1 (sketch)") for the first n whose path
 * `exists` reports as free. Used by "New drawing for this file" to avoid
 * clobbering an existing drawing when a note already has one.
 */
export function uniqueVaultPath(
  exists: (path: string) => boolean,
  folder: string,
  name: string,
  suffix: string,
  ext: string,
): string {
  const dir = folder ? folder.replace(/\/$/, "") + "/" : "";
  const candidate = `${dir}${name}${suffix}.${ext}`;
  if (!exists(candidate)) return candidate;
  for (let n = 1; ; n++) {
    const numbered = `${dir}${name} ${n}${suffix}.${ext}`;
    if (!exists(numbered)) return numbered;
  }
}
