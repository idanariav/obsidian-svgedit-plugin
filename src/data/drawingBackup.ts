// Last-non-empty drawing backups, keyed by vault file path, in IndexedDB.
//
// A safety net mirroring Excalidraw's BAK cache: every successful save stores
// the non-empty drawing here, so if a file is ever found empty on open (the
// empty-revert bug, a sync conflict, a crash) we can offer to restore it.
// IndexedDB is used so backups survive plugin reloads and Obsidian restarts
// without writing extra files into the vault.

const DB_NAME = "svgedit-plugin-backups";
const STORE = "drawings";
const DB_VERSION = 1;

interface BackupRecord {
  svg: string;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Store the latest non-empty drawing for a file path. Best-effort: backup
 *  failures never block a save. */
export async function putBackup(path: string, svg: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ svg, savedAt: Date.now() } as BackupRecord, path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("[Sketch Editor] backup write failed:", e);
  }
}

/** The last backed-up drawing for a file path, or null if none / on error. */
export async function getBackup(path: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(path);
      req.onsuccess = () => resolve((req.result as BackupRecord | undefined)?.svg ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("[Sketch Editor] backup read failed:", e);
    return null;
  }
}

/** Drop a file's backup (e.g. the user chose to keep the empty drawing). */
export async function deleteBackup(path: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("[Sketch Editor] backup delete failed:", e);
  }
}
