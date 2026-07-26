/**
 * Return an unused path for a new file: "<folder>/<baseName>.<ext>", or
 * "<folder>/<baseName> <n>.<ext>" (n = 1, 2, …) for the first n whose path
 * `exists` reports as free. Used by "New drawing for this file" to avoid
 * clobbering an existing drawing when a note already has one.
 */
export function uniqueVaultPath(
  exists: (path: string) => boolean,
  folder: string,
  baseName: string,
  ext: string,
): string {
  const dir = folder ? folder.replace(/\/$/, "") + "/" : "";
  const candidate = `${dir}${baseName}.${ext}`;
  if (!exists(candidate)) return candidate;
  for (let n = 1; ; n++) {
    const numbered = `${dir}${baseName} ${n}.${ext}`;
    if (!exists(numbered)) return numbered;
  }
}
