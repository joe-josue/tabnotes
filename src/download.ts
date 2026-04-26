import type { Note, RenderMode } from './storage';
import { touchTimestamps } from './frontmatter';
import { writeToVault, getVaultName } from './vault';

function sanitize(name: string): string {
  return (name || 'untitled').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80).trim() || 'untitled';
}

/**
 * Export a note to disk.
 *
 * Strategy (in order):
 *   1. Write directly to the user's chosen vault via the File System Access API.
 *   2. Fall back to chrome.downloads.download() → default Downloads folder.
 *
 * Calls onSuccess(filename, saveLocation) after a successful write.
 * Calls onError() only if both strategies fail.
 *
 * Timestamps in frontmatter (if present) are updated in the exported file;
 * the copy stored in chrome.storage is never modified here.
 */
export async function downloadNote(
  note: Note,
  mode: RenderMode,
  onSuccess: (filename: string, location: string) => void,
  onError?: () => void
): Promise<void> {
  const isPlain = mode === 'plain';
  const ext = isPlain ? '.txt' : '.md';
  const type = isPlain ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8';
  const filename = sanitize(note.title) + ext;

  // Touch frontmatter timestamps in the export copy (not in storage)
  const exportBody = isPlain ? note.body : touchTimestamps(note.body);

  // ── Strategy 1: vault via File System Access API ──────────────────────────
  const vaultName = await getVaultName();
  if (vaultName) {
    try {
      await writeToVault(filename, exportBody);
      onSuccess(filename, vaultName);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If it's a 'no-vault' error the handle was cleared elsewhere — fall through.
      // If 'permission-denied' also fall through to downloads (don't error loudly).
      if (msg !== 'no-vault' && msg !== 'permission-denied') {
        onError?.();
        return;
      }
    }
  }

  // ── Strategy 2: chrome.downloads → default Downloads folder ───────────────
  const blob = new Blob([exportBody], { type });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    { url, filename, saveAs: false, conflictAction: 'uniquify' },
    (downloadId) => {
      URL.revokeObjectURL(url);
      if (chrome.runtime.lastError || downloadId === undefined) {
        onError?.();
        return;
      }
      onSuccess(filename, 'Downloads');
    }
  );
}
