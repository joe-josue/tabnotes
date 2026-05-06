import './styles.css';
import { createEditor, type EditorHandle } from './editor';
import { mountSidebar } from './sidebar';
import { downloadNote } from './download';
import { applyTheme } from './theme';
import { pickVault, clearVault, getVaultName, getVaultPermission, fsapiSupported } from './vault';
import {
  DEFAULT_UNTITLED_BODY,
  deriveTitle,
  ensureActiveNote,
  getNote,
  getState,
  newId,
  openFreshNote,
  removeNote,
  seedWelcomeIfNeeded,
  setActiveId,
  setFontSize,
  setRenderMode,
  setSaveSubfolder,
  setSidebarCollapsed,
  setThemeMode,
  setVaultDisplayName,
  upsertNote,
  type Note,
  type RenderMode,
  type ThemeMode
} from './storage';

let current: Note;
let editor: EditorHandle;
let mode: RenderMode = 'markdown';
let themeMode: ThemeMode = 'dark';
let fontSize = 16;
let saveSubfolder: string | null = null;
let settingsOpen = false;
let shortcutsOpen = false;
let saveTimer: number | undefined;
let toastTimer: number | undefined;

const FONT_MIN = 12;
const FONT_MAX = 24;

function showToast(filename: string, location = 'Downloads') {
  const toast = document.getElementById('save-toast')!;
  document.getElementById('save-toast-name')!.textContent = filename;
  document.getElementById('save-toast-sub')!.textContent = `Saved to ${location}`;
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
  const fresh: Note = {
    id: newId(),
    title: 'Untitled',
    body: DEFAULT_UNTITLED_BODY,
    updatedAt: Date.now()
  };
  await upsertNote(fresh);
  await setActiveId(fresh.id);
  current = fresh;
  editor.setContent(DEFAULT_UNTITLED_BODY);
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

function applyFontSize(size: number) {
  fontSize = size;
  document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
  const valEl = document.getElementById('font-size-val');
  if (valEl) valEl.textContent = String(size);
  const decBtn = document.getElementById('font-dec') as HTMLButtonElement | null;
  const incBtn = document.getElementById('font-inc') as HTMLButtonElement | null;
  if (decBtn) decBtn.disabled = size <= FONT_MIN;
  if (incBtn) incBtn.disabled = size >= FONT_MAX;
}

async function saveCurrentNote() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  const body = editor.view.state.doc.toString();
  current = {
    ...current,
    body,
    title: deriveTitle(body),
    updatedAt: Date.now()
  };
  await upsertNote(current);
  await downloadNote(current, mode, saveSubfolder, showToast, () => {
    showToast(current.title || 'Untitled', 'Downloads blocked');
  });
}

function sanitizeSubfolderInput(raw: string): string {
  return raw.trim().replace(/[\\/:*?"<>|.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function openSettingsPanel() {
  const panel = document.getElementById('settings-panel')!;
  const btn = document.getElementById('settings-btn')!;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  btn.classList.add('is-active');
  btn.setAttribute('aria-expanded', 'true');
  settingsOpen = true;
}

function closeSettingsPanel() {
  const panel = document.getElementById('settings-panel')!;
  const btn = document.getElementById('settings-btn')!;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  btn.classList.remove('is-active');
  btn.setAttribute('aria-expanded', 'false');
  settingsOpen = false;
}

function openShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal')!;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  shortcutsOpen = true;
  (document.getElementById('shortcuts-close') as HTMLButtonElement).focus();
}

function closeShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal')!;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  shortcutsOpen = false;
  (document.getElementById('shortcuts-open') as HTMLButtonElement | null)?.focus();
}

function wireToolbar() {
  document.getElementById('save-btn')!.addEventListener('click', () => {
    void saveCurrentNote();
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

  // Settings panel
  document.getElementById('settings-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsOpen ? closeSettingsPanel() : openSettingsPanel();
  });

  document.getElementById('font-dec')!.addEventListener('click', async () => {
    const next = Math.max(FONT_MIN, fontSize - 1);
    applyFontSize(next);
    await setFontSize(next);
  });

  document.getElementById('font-inc')!.addEventListener('click', async () => {
    const next = Math.min(FONT_MAX, fontSize + 1);
    applyFontSize(next);
    await setFontSize(next);
  });

  const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement;
  themeToggle.checked = themeMode === 'light';
  themeToggle.addEventListener('change', async () => {
    themeMode = themeToggle.checked ? 'light' : 'dark';
    applyTheme(themeMode);
    await setThemeMode(themeMode);
  });

  // Vault selector
  const vaultPickBtn = document.getElementById('vault-pick') as HTMLButtonElement;
  const vaultClearBtn = document.getElementById('vault-clear') as HTMLButtonElement;
  const vaultNameEl = document.getElementById('vault-name')!;
  const subfolderInput = document.getElementById('save-subfolder') as HTMLInputElement;
  const saveHelp = document.getElementById('save-location-help')!;

  subfolderInput.value = saveSubfolder ?? '';
  subfolderInput.addEventListener('change', async () => {
    const cleaned = sanitizeSubfolderInput(subfolderInput.value);
    subfolderInput.value = cleaned;
    saveSubfolder = cleaned || null;
    await setSaveSubfolder(saveSubfolder);
    refreshVaultUI(await getVaultName());
  });

  // Hide the button entirely if the browser doesn't support the File System Access API
  if (!fsapiSupported()) {
    vaultPickBtn.style.display = 'none';
  }

  function refreshVaultUI(vaultName: string | null) {
    if (vaultName) {
      // Folder chosen — show its name + clear button
      vaultNameEl.textContent = vaultName;
      vaultNameEl.title = vaultName;
      vaultNameEl.style.display = '';
      vaultClearBtn.style.display = '';
      vaultPickBtn.style.display = 'none';
      saveHelp.textContent = `Notes save directly to ${vaultName}. If permission expires, Cmd/Ctrl+S falls back to Downloads${saveSubfolder ? '/' + saveSubfolder : ''}.`;
    } else {
      // No folder — show the picker button
      vaultNameEl.style.display = 'none';
      vaultClearBtn.style.display = 'none';
      if (fsapiSupported()) vaultPickBtn.style.display = '';
      saveHelp.textContent = fsapiSupported()
        ? `Choose a folder for direct saves, or use a Downloads subfolder${saveSubfolder ? ' (' + saveSubfolder + ')' : ''}.`
        : `Folder picking is unavailable in this browser. Notes save to Downloads${saveSubfolder ? '/' + saveSubfolder : ''}.`;
    }
  }

  getVaultName().then(async (name) => {
    refreshVaultUI(name);
    const perm = await getVaultPermission();
    if (name && perm === 'prompt') {
      saveHelp.textContent = `${name} is selected. Your browser may ask for permission again the next time you save.`;
    }
  });

  vaultPickBtn.addEventListener('click', async () => {
    // Give visual feedback while the OS dialog is open
    const prev = vaultPickBtn.textContent!;
    vaultPickBtn.textContent = 'Opening…';
    vaultPickBtn.disabled = true;

    try {
      const handle = await pickVault();
      if (!handle) {
        // User pressed Cancel in the OS picker — restore button
        vaultPickBtn.textContent = prev;
        vaultPickBtn.disabled = false;
        return;
      }
      await setVaultDisplayName(handle.name);
      refreshVaultUI(handle.name);
    } catch {
      // Picker was blocked (SecurityError, NotAllowedError, etc.)
      vaultPickBtn.textContent = prev;
      vaultPickBtn.disabled = false;
      vaultPickBtn.title = 'Folder access blocked — check your browser settings and try again';
    }
  });

  vaultClearBtn.addEventListener('click', async () => {
    await clearVault();
    await setVaultDisplayName(null);
    refreshVaultUI(null);
  });

  document.getElementById('shortcuts-open')!.addEventListener('click', (e) => {
    e.stopPropagation();
    openShortcutsModal();
  });

  document.getElementById('shortcuts-close')!.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcuts-modal')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeShortcutsModal();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!settingsOpen) return;
    const panel = document.getElementById('settings-panel')!;
    const btn = document.getElementById('settings-btn')!;
    if (!panel.contains(e.target as Node) && !btn.contains(e.target as Node)) {
      closeSettingsPanel();
    }
  });
}

function wireGlobalKeys(sidebar: { render: (id: string | null) => Promise<void> }) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shortcutsOpen) {
      e.preventDefault();
      closeShortcutsModal();
      return;
    }
    if (e.key === 'Escape' && settingsOpen) {
      e.preventDefault();
      closeSettingsPanel();
      editor.focus();
      return;
    }
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
  themeMode = state.themeMode ?? 'dark';
  saveSubfolder = state.saveSubfolder ?? null;
  applyTheme(themeMode);
  applyFontSize(state.fontSize ?? 16);

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
    onSave: () => void saveCurrentNote()
  });

  await sidebar.render(note.id);
  await initSidebarCollapsed();
  wireToolbar();
  wireGlobalKeys(sidebar);
  editor.focus();
  // Sync vault display name from IndexedDB → chrome.storage on each boot
  // (handles the case where the user cleared the handle outside the app)
  getVaultName().then((name) => {
    if (name !== (state.vaultDisplayName ?? null)) {
      void setVaultDisplayName(name);
    }
  });
}

boot();
