import { Vault, normalizePath } from "obsidian";

/**
 * Persistence for the svgedit custom-font cache, backed by real files in a
 * configurable vault folder. Each font is one `<family>.woff2` binary file, so
 * fonts sync across devices like any other vault content (independently of
 * whether plugin-settings sync is enabled).
 *
 * The svgedit editor speaks base64 (it builds `FontFace` data URLs); on disk we
 * store the decoded binary so the files are genuine, reusable `.woff2` fonts.
 */

/** Characters not safe in a filename across the platforms Obsidian runs on. */
const ILLEGAL = /[\\/:*?"<>|]/g;

const familyToFilename = (family: string): string =>
  `${family.replace(ILLEGAL, "_")}.woff2`;

const filenameToFamily = (filename: string): string =>
  filename.replace(/\.woff2$/i, "");

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

/**
 * Read every `.woff2` file in `folder`, returning each as a `{ family,
 * woff2Base64 }` record. Returns `[]` when the folder doesn't exist yet.
 */
export async function listFonts(
  vault: Vault,
  folder: string,
): Promise<Array<{ family: string; woff2Base64: string }>> {
  const dir = normalizePath(folder);
  if (!(await vault.adapter.exists(dir))) return [];
  const { files } = await vault.adapter.list(dir);
  const woff2 = files.filter((p) => p.toLowerCase().endsWith(".woff2"));
  return Promise.all(
    woff2.map(async (path) => {
      const buf = await vault.adapter.readBinary(path);
      const filename = path.slice(path.lastIndexOf("/") + 1);
      return {
        family: filenameToFamily(filename),
        woff2Base64: arrayBufferToBase64(buf),
      };
    }),
  );
}

/**
 * Write one font's binary into `folder` (created if missing), keyed by family.
 */
export async function saveFont(
  vault: Vault,
  folder: string,
  family: string,
  woff2Base64: string,
): Promise<void> {
  const dir = normalizePath(folder);
  if (!(await vault.adapter.exists(dir))) await vault.adapter.mkdir(dir);
  const path = normalizePath(`${dir}/${familyToFilename(family)}`);
  await vault.adapter.writeBinary(path, base64ToArrayBuffer(woff2Base64));
}
