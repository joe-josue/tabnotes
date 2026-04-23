export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

export type RenderMode = 'markdown' | 'plain';

type State = {
  notes: Record<string, Note>;
  activeId: string | null;
  sidebarCollapsed: boolean;
  renderMode: RenderMode;
  welcomeSeeded: boolean;
  fontSize: number;
};

const DEFAULT_STATE: State = {
  notes: {},
  activeId: null,
  sidebarCollapsed: false,
  renderMode: 'markdown',
  welcomeSeeded: false,
  fontSize: 16
};

const hasChromeStorage =
  typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

async function readAll(): Promise<State> {
  if (!hasChromeStorage) {
    const raw = localStorage.getItem('tab-notes-state');
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  }
  const got = await chrome.storage.local.get([
    'notes',
    'activeId',
    'sidebarCollapsed',
    'renderMode',
    'welcomeSeeded',
    'fontSize'
  ]);
  return {
    notes: got.notes ?? {},
    activeId: got.activeId ?? null,
    sidebarCollapsed: got.sidebarCollapsed ?? false,
    renderMode: (got.renderMode as RenderMode) ?? 'markdown',
    welcomeSeeded: got.welcomeSeeded ?? false,
    fontSize: (got.fontSize as number) ?? 16
  };
}

async function writePartial(patch: Partial<State>): Promise<void> {
  if (!hasChromeStorage) {
    const current = await readAll();
    const next = { ...current, ...patch };
    localStorage.setItem('tab-notes-state', JSON.stringify(next));
    return;
  }
  await chrome.storage.local.set(patch);
}

export function deriveTitle(body: string): string {
  const line = body.split('\n').find((l) => l.trim().length > 0) ?? '';
  const cleaned = line.replace(/^#+\s*/, '').trim();
  if (!cleaned) return 'Untitled';
  return cleaned.length > 60 ? cleaned.slice(0, 60) + '…' : cleaned;
}

export function newId(): string {
  return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function getState(): Promise<State> {
  return readAll();
}

export async function listNotes(): Promise<Note[]> {
  const { notes } = await readAll();
  return Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getNote(id: string): Promise<Note | null> {
  const { notes } = await readAll();
  return notes[id] ?? null;
}

export async function upsertNote(note: Note): Promise<void> {
  const state = await readAll();
  state.notes[note.id] = note;
  await writePartial({ notes: state.notes });
}

export async function removeNote(id: string): Promise<void> {
  const state = await readAll();
  delete state.notes[id];
  const patch: Partial<State> = { notes: state.notes };
  if (state.activeId === id) patch.activeId = null;
  await writePartial(patch);
}

export async function setActiveId(id: string | null): Promise<void> {
  await writePartial({ activeId: id });
}

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  await writePartial({ sidebarCollapsed: collapsed });
}

export async function setRenderMode(mode: RenderMode): Promise<void> {
  await writePartial({ renderMode: mode });
}

export async function setFontSize(size: number): Promise<void> {
  await writePartial({ fontSize: size });
}

const WELCOME_BODY = `# Welcome to tab-notes

Every new tab is a blank page. Start typing — everything is saved automatically.

## A few things to know

- Everything lives on this machine only. No account, no cloud, no telemetry.
- Notes are sorted by most-recently-edited. Click any note in the sidebar to switch.
- Use the **＋ New** button in the sidebar to start a fresh note.

## Keyboard shortcuts

- **Cmd/Ctrl + N** — new note
- **Cmd/Ctrl + B** — bold
- **Cmd/Ctrl + I** — italic
- **Cmd/Ctrl + \`** — inline code
- **Cmd/Ctrl + S** — download the current note as a \`.md\` file
- **Cmd/Ctrl + \\\\** — toggle the sidebar

## Markdown tips

Write \`# Heading\` for a large heading, \`## Subheading\` for medium, \`### Smaller\` for smaller. Brackets and quotes auto-pair as you type, so \`(\` becomes \`()\` with your cursor in the middle.

Prefer plain text? Click the **MD** button top-right to switch modes. Your choice sticks across tabs.

---

Ready? Click **＋ New** in the sidebar, or press **Cmd/Ctrl + N** to start a blank note.
`;

export async function seedWelcomeIfNeeded(): Promise<boolean> {
  const state = await readAll();
  if (state.welcomeSeeded) return false;
  const hasNotes = Object.keys(state.notes).length > 0;
  if (!hasNotes) {
    const welcome: Note = {
      id: newId(),
      title: 'Welcome to tab-notes',
      body: WELCOME_BODY,
      updatedAt: Date.now()
    };
    state.notes[welcome.id] = welcome;
    await writePartial({
      notes: state.notes,
      activeId: welcome.id,
      welcomeSeeded: true
    });
    return true;
  } else {
    await writePartial({ welcomeSeeded: true });
    return false;
  }
}

/**
 * Every tab opens blank unless the previously active note was already blank.
 * Keeps private content from flashing when a user opens a new tab in front of others.
 */
export async function openFreshNote(): Promise<Note> {
  const state = await readAll();
  const active = state.activeId ? state.notes[state.activeId] : null;
  if (active && active.body.trim() === '') {
    return active;
  }
  const fresh: Note = {
    id: newId(),
    title: 'Untitled',
    body: '',
    updatedAt: Date.now()
  };
  state.notes[fresh.id] = fresh;
  await writePartial({ notes: state.notes, activeId: fresh.id });
  return fresh;
}

export async function ensureActiveNote(): Promise<Note> {
  const state = await readAll();
  if (state.activeId && state.notes[state.activeId]) {
    return state.notes[state.activeId];
  }
  const existing = Object.values(state.notes).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (existing) {
    await setActiveId(existing.id);
    return existing;
  }
  const fresh: Note = {
    id: newId(),
    title: 'Untitled',
    body: '',
    updatedAt: Date.now()
  };
  await upsertNote(fresh);
  await setActiveId(fresh.id);
  return fresh;
}
