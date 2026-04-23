# tab-notes — Release Roadmap

A planned sequence of releases, each with a clear theme and marketing hook.

---

## v1.0 — "The Markdown New Tab" *(shipped)*
Replace blank tabs with writing. Auto-save, recent-notes panel, light/dark, Ctrl+S export.

**Hook:** *"Every new tab is a blank page — literally."*

---

## v1.1 — "Feels Like Home"
Onboarding + the quality-of-life polish people notice in the first 30 seconds.

- Welcome / "How to use" note seeded on fresh install (keyboard reference lives here)
- Save button in the UI (for non-keyboard users)
- Markdown live-styling — `#`, `##`, `###` render at H1/H2/H3 sizes inline (Obsidian-style)
- Auto-pair brackets/quotes: `(`, `[`, `{`, `"`, `` ` ``
- Plain-text ↔ Markdown toggle
- Settings persist across tabs (sidebar state, render mode)
- `Cmd/Ctrl + \` toggles sidebar

**Hook:** *"We listened to v1 feedback. Markdown now feels alive."*

---

## v1.2 — "Keyboard Native"
For the power user crowd — earns social proof from HN/Twitter devs.

- `Cmd+K` command palette (fuzzy switch notes, run actions)
- `Cmd+N` new note
- `Cmd+F` search across all notes
- `Cmd+D` duplicate note
- Full shortcut sheet

**Hook:** *"Never touch your mouse again."*

---

## v1.3 — "In the Zone"
Position tab-notes as a writing tool, not just a scratchpad. Courts writers, journalers, students.

- Focus mode (`Cmd+.`) — hide sidebar, center column
- Word count + reading time (toggleable status line)
- Column width: narrow / medium / wide
- Font picker: serif / sans / mono (Sera editorial defaults)
- Font size setting

**Hook:** *"Turn any tab into a writing retreat."*

---

## v1.4 — "Organize"
Notes start accumulating — this release solves "I have 40 notes, help."

- Pin notes to top of sidebar
- Explicit rename (double-click title, decoupled from first line)
- Drag-and-drop `.md` import
- Checkbox task lists — `- [ ]` clickable in markdown mode
- Bulk export: download all notes as `.zip`

**Hook:** *"Your notes, finally in order."*

---

## v2.0 — "Everywhere" *(stretch / pivot)*
The v1 PRD explicitly said no cloud sync. v2.0 is when that decision gets revisited — a choice, not a foregone conclusion.

- **Option A:** Local-first sync via a user-supplied GitHub gist / Dropbox folder (no server, stays aligned with privacy pitch)
- **Option B:** Multi-device via iCloud/Drive — user points extension at a folder
- **Option C:** Skip entirely, stay local forever, and lean into "your notes never leave this machine" as permanent positioning

**Hook (if shipped):** *"Your notes, on every device. Still no account."*

---

## Marketing cadence

- **3–5 weeks between releases** — frequent enough to build momentum, slow enough that each post has real news.
- **Each release = one tweet + one short video** (~15-second screen capture). Reuse across Product Hunt, HN, Twitter, Reddit.
- **Pin the welcome note content** — it doubles as marketing copy that users screenshot and share.
- **v1.2 is the HN moment.** Keyboard-native tools punch above their weight on developer forums. Save Show HN for this release.
