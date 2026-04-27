import type { Note, RenderMode } from './storage';
import { touchTimestamps } from './frontmatter';
import { writeToVault, getVaultName } from './vault';

function sanitize(name: string): string {
  return (name || 'untitled').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80).trim() || 'untitled';
}

function sanitizeFolder(sub: string): string {
  // Relative path component — no slashes, dots, or special chars
  return sub.trim().replace(/[\\/:*?"<>|.]+/g, '_').slice(0, 60).trim();
}

/**
 * Export a note to disk.
 *
 * Strategy (in order):
 *   1. Write directly to the user's chosen vault via the File System Access API.
 *   2. chrome.downloads with a subfolder path (e.g. "notes/my-note.md") if the
 *      user has set a subfolder name. Chrome creates the folder automatically.
 *   3. Fall back to chrome.downloads → root of the default Downloads folder.
 *
 * Calls onSuccess(filename, saveLocation) after a successful write.
 * Calls onError() only if all strategies fail.
 *
 * Timestamps in frontmatter (if present) are updated in the exported file;
 * the copy stored in chrome.storage is never modified here.
 */
export async function downloadNote(
  note: Note,
  mode: RenderMode,
  saveSubfolder: string | null,
  onSuccess: (filename: string, location: string) => void,
  onError?: () => void
): Promise<void> {
  const isPlain = mode === 'plain';
  const ext = isPlain ? '.txt' : '.md';
  const type = isPlain ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8';
  const basename = sanitize(note.title) + ext;

  // Touch frontmatter timestamps in the export copy (not in storage)
  const exportBody = isPlain ? note.body : touchTimestamps(note.body);

  // ── Strategy 1: vault via File System Access API ──────────────────────────
  const vaultName = await getVaultName();
  if (vaultName) {
    try {
      await writeToVault(basename, exportBody);
      onSuccess(basename, vaultName);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 'no-vault' or 'permission-denied' → fall through to chrome.downloads
      if (msg !== 'no-vault' && msg !== 'permission-denied') {
        onError?.();
        return;
      }
    }
  }

  // ── Strategy 2 & 3: chrome.downloads ────────────────────────────────────
  const blob = new Blob([exportBody], { type });
  const url = URL.createObjectURL(blob);

  // Build the filename — optionally prepend a subfolder (relative to Downloads)
  const sub = saveSubfolder ? sanitizeFolder(saveSubfolder) : '';
  const filename = sub ? `${sub}/${basename}` : basename;
  const locationLabel = sub ? `Downloads/${sub}` : 'Downloads';

  chrome.downloads.download(
    { url, filename, saveAs: false, conflictAction: 'uniquify' },
    (downloadId) => {
      URL.revokeObjectURL(url);
      if (chrome.runtime.lastError || downloadId === undefined) {
        onError?.();
        return;
      }
      onSuccess(basename, locationLabel);
    }
  );
}
