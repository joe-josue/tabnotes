import type { Note, RenderMode } from './storage';

function sanitize(name: string): string {
  return (name || 'untitled').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80).trim() || 'untitled';
}

/**
 * Downloads the note straight to the default Downloads folder (no save dialog).
 * Calls onSuccess(filename) only after the download has actually been initiated.
 * Calls onError() if the download failed (e.g. user has disk full, API error).
 */
export function downloadNote(
  note: Note,
  mode: RenderMode,
  onSuccess: (filename: string) => void,
  onError?: () => void
): void {
  const isPlain = mode === 'plain';
  const ext = isPlain ? '.txt' : '.md';
  const type = isPlain ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8';
  const filename = sanitize(note.title) + ext;

  const blob = new Blob([note.body], { type });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    {
      url,
      filename,
      saveAs: false,
      conflictAction: 'uniquify'
    },
    (downloadId) => {
      URL.revokeObjectURL(url);
      if (chrome.runtime.lastError || downloadId === undefined) {
        onError?.();
        return;
      }
      onSuccess(filename);
    }
  );
}
