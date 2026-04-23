import './styles.css';
import { createEditor, type EditorHandle } from './editor';
import { mountSidebar } from './sidebar';
import { downloadNote } from './download';
import { initTheme } from './theme';
import {
  deriveTitle,
  ensureActiveNote,
  getNote,
  getState,
  newId,
  openFreshNote,
  removeNote,
  seedWelcomeIfNeeded,
  setActiveId,
  setRenderMode,
  setSidebarCollapsed,
  upsertNote,
  type Note,
  type RenderMode
} from './storage';

initTheme();

let current: Note;
let editor: EditorHandle;
let mode: RenderMode = 'markdown';
let saveTimer: number | undefined;
let toastTimer: number | undefined;

function showToast(filename: string) {
  const toast = document.getElementById('save-toast')!;
  const nameEl = document.getElementById('save-toast-name')!;
  nameEl.textContent = filename;
  toast.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2500);
}

const SAVE_DEBOUNCE_MS = 300;

function scheduleSave(body: string, sidebar: { render: (id: string | null) => Promise<void> }) {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    current = {
      ...current,
      body,
      title: deriveTitle(body),
      updatedAt: Date.now()
    };
    await upsertNote(current);
    await sidebar.render(current.id);
  }, SAVE_DEBOUNCE_MS);
}

async function loadNote(id: string, sidebar: { render: (id: string | null) => Promise<void> }) {
  const note = await getNote(id);
  if (!note) return;
  current = note;
  editor.setContent(note.body);
  await setActiveId(note.id);
  await sidebar.render(note.id);
  editor.focus();
}

async function createNew(sidebar: { render: (id: string | null) => Promise<void> }) {
  const fresh: Note = { id: newId(), title: 'Untitled', body: '', updatedAt: Date.now() };
  await upsertNote(fresh);
  await setActiveId(fresh.id);
  current = fresh;
  editor.setContent('');
  await sidebar.render(fresh.id);
  editor.focus();
}

async function deleteNote(id: string, sidebar: { render: (id: string | null) => Promise<void> }) {
  await removeNote(id);
  if (current.id === id) {
    const next = await ensureActiveNote();
    current = next;
    editor.setContent(next.body);
  }
  await sidebar.render(current.id);
}

function refreshSidebarToggleTitle(collapsed: boolean) {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;
  btn.title = collapsed
    ? 'Show sidebar (Cmd/Ctrl+\\)'
    : 'Hide sidebar (Cmd/Ctrl+\\)';
}

function toggleSidebar() {
  const app = document.getElementById('app')!;
  app.classList.toggle('sidebar-collapsed');
  const collapsed = app.classList.contains('sidebar-collapsed');
  refreshSidebarToggleTitle(collapsed);
  void setSidebarCollapsed(collapsed);
}

async function initSidebarCollapsed() {
  const state = await getState();
  const app = document.getElementById('app')!;
  if (state.sidebarCollapsed) app.classList.add('sidebar-collapsed');
  refreshSidebarToggleTitle(state.sidebarCollapsed);
  document.getElementById('sidebar-toggle')!.addEventListener('click', toggleSidebar);
}

function refreshModeButton() {
  const btn = document.getElementById('mode-toggle') as HTMLButtonElement;
  btn.classList.toggle('is-plain', mode === 'plain');
  btn.textContent = mode === 'markdown' ? 'Markdown' : 'Plain text';
  btn.title =
    mode === 'markdown'
      ? 'Markdown mode is on — click to switch to plain text'
      : 'Plain text mode is on — click to switch to markdown';

  const save = document.getElementById('save-btn') as HTMLButtonElement | null;
  if (save) {
    save.title =
      mode === 'markdown'
        ? 'Download as .md (Cmd/Ctrl+S)'
        : 'Download as .txt (Cmd/Ctrl+S)';
  }
}

function wireToolbar() {
  document.getElementById('save-btn')!.addEventListener('click', () => {
    downloadNote(current, mode, showToast);
  });

  const modeBtn = document.getElementById('mode-toggle') as HTMLButtonElement;
  modeBtn.addEventListener('click', async () => {
    mode = mode === 'markdown' ? 'plain' : 'markdown';
    editor.setMode(mode);
    await setRenderMode(mode);
    refreshModeButton();
    editor.focus();
  });
  refreshModeButton();
}

function wireGlobalKeys(sidebar: { render: (id: string | null) => Promise<void> }) {
  window.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === '\\') {
      e.preventDefault();
      toggleSidebar();
      return;
    }
    if (meta && (e.key === 'n' || e.key === 'N') && !e.shiftKey) {
      e.preventDefault();
      void createNew(sidebar);
    }
  });
}

async function boot() {
  const justSeeded = await seedWelcomeIfNeeded();
  const state = await getState();
  mode = state.renderMode;

  let note: Note;
  if (justSeeded && state.activeId) {
    // Fresh install — land on the welcome note we just seeded.
    note = (await getNote(state.activeId)) ?? (await ensureActiveNote());
  } else {
    // Normal new tab — open a blank note so private content never flashes.
    note = await openFreshNote();
  }
  current = note;

  const sidebar = mountSidebar({
    onSelect: (id) => loadNote(id, sidebar),
    onNew: () => createNew(sidebar),
    onDelete: (id) => deleteNote(id, sidebar)
  });

  editor = createEditor({
    parent: document.getElementById('editor')!,
    initial: note.body,
    initialMode: mode,
    onChange: (body) => scheduleSave(body, sidebar),
    onSave: () => downloadNote(current, mode, showToast)
  });

  await sidebar.render(note.id);
  await initSidebarCollapsed();
  wireToolbar();
  wireGlobalKeys(sidebar);
  editor.focus();
}

boot();
