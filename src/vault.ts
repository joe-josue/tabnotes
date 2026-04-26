/**
 * Vault management: persist a FileSystemDirectoryHandle across sessions via
 * IndexedDB, then write files directly. Falls back to chrome.downloads when
 * the API is unavailable or permission has been revoked.
 *
 * IndexedDB is used (not chrome.storage.local) because FileSystemDirectoryHandle
 * is a structured-clonable type — it can only be persisted in IndexedDB.
 */

const IDB_NAME = 'tab-notes-vault';
const IDB_VERSION = 1;
const STORE = 'meta';
const HANDLE_KEY = 'dirHandle';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    value === null ? store.delete(key) : store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** True if the browser supports the File System Access API. */
export function fsapiSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Retrieve the persisted directory handle (may still need permission re-grant). */
export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY);
  } catch {
    return null;
  }
}

/** Open the directory picker. Stores the handle on success; returns null on cancel. */
export async function pickVault(): Promise<FileSystemDirectoryHandle | null> {
  if (!fsapiSupported()) return null;
  try {
    // showDirectoryPicker is not yet in all TS libs
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    await idbSet(HANDLE_KEY, handle);
    return handle as FileSystemDirectoryHandle;
  } catch {
    return null; // user cancelled or permission refused
  }
}

/** Remove the persisted handle — subsequent saves go to Downloads. */
export async function clearVault(): Promise<void> {
  await idbSet(HANDLE_KEY, null);
}

/** Display name of the current vault folder, or null if none is set. */
export async function getVaultName(): Promise<string | null> {
  const handle = await getStoredHandle();
  return handle?.name ?? null;
}

/**
 * Permission status for the stored handle.
 * Returns 'none' when no handle is stored.
 */
export async function getVaultPermission(): Promise<
  'granted' | 'prompt' | 'denied' | 'none'
> {
  const handle = await getStoredHandle();
  if (!handle) return 'none';
  try {
    return (await handle.queryPermission({ mode: 'readwrite' })) as
      | 'granted'
      | 'prompt'
      | 'denied';
  } catch {
    return 'none';
  }
}

/**
 * Write `content` to `filename` inside the stored vault directory.
 *
 * Requests permission if the session-level grant has expired (requires a
 * user gesture in the call stack — Cmd+S and the save button both qualify).
 *
 * Throws:
 *   'no-vault'         — no directory handle stored
 *   'permission-denied'— user refused or browser blocked the grant
 *   Any FileSystem error (disk full, etc.)
 */
export async function writeToVault(filename: string, content: string): Promise<void> {
  const handle = await getStoredHandle();
  if (!handle) throw new Error('no-vault');

  let perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'prompt') {
    perm = await handle.requestPermission({ mode: 'readwrite' });
  }
  if (perm !== 'granted') throw new Error('permission-denied');

  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
