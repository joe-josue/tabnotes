import { listNotes, type Note } from './storage';

type Handlers = {
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

function snippet(body: string): string {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const second = lines[1] ?? '';
  const cleaned = second.replace(/^#+\s*/, '').replace(/^[-*>]\s+/, '');
  if (!cleaned) return 'Empty note';
  return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function mountSidebar(handlers: Handlers) {
  const list = document.getElementById('note-list') as HTMLUListElement;
  const newBtn = document.getElementById('new-note') as HTMLButtonElement;

  newBtn.addEventListener('click', () => handlers.onNew());

  async function render(activeId: string | null) {
    const notes = await listNotes();
    list.innerHTML = '';
    if (notes.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'note-empty';
      empty.textContent = 'No notes yet.';
      list.appendChild(empty);
      return;
    }
    for (const note of notes) {
      list.appendChild(renderItem(note, note.id === activeId, handlers));
    }
  }

  return { render };
}

function renderItem(note: Note, active: boolean, handlers: Handlers): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'note-item' + (active ? ' is-active' : '');
  li.dataset.id = note.id;

  const title = document.createElement('div');
  title.className = 'note-title';
  title.textContent = note.title || 'Untitled';

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  meta.textContent = formatTime(note.updatedAt);

  const preview = document.createElement('div');
  preview.className = 'note-preview';
  preview.textContent = snippet(note.body);

  const del = document.createElement('button');
  del.className = 'note-delete';
  del.title = 'Delete note';
  del.setAttribute('aria-label', 'Delete note');
  del.textContent = '×';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Delete this note?')) handlers.onDelete(note.id);
  });

  li.addEventListener('click', () => handlers.onSelect(note.id));
  li.append(title, meta, preview, del);
  return li;
}
