# tab-notes — Patch Notes

Plain-English release log. Written for humans — users, visitors, you at 2am. Updated as features ship.

---

## v1.3.0 — "Color Your Work" *(shipped)*

Code blocks now look the way developers expect them to.

- **Syntax highlighting in fenced code blocks** — open a code fence with a language tag (`` ```js ``, `` ```python ``, `` ```bash ``, and many more) and the code inside gets full token colouring: keywords, strings, comments, numbers, types, functions, and operators each in a distinct colour. No config, no toggle — it just works.
- **Theme-aware colours** — the highlight palette is tuned for both light and dark mode. Purple for keywords, green for strings, amber for numbers, cyan for types. Quiet enough not to distract, distinct enough to actually help.

---

## v1.2.0 — "Make It Yours" *(shipped)*

The first step toward a personalised writing environment.

- **Font size — your call** — a new settings panel (the sliders icon, top-right) lets you dial the editor text up or down between 12 and 24px. One click to open, one tap on `−` or `+` to adjust, your choice remembered the next time you open a tab.
- **Inline settings panel** — opens and closes in place, right below the toolbar. No new pages, no modals, no context switches. Press `Escape` or click anywhere outside to dismiss it. Room inside for whatever comes next.

---

## v1.1.2 — "No More Ghosts" *(shipped)*

Two bugs that broke the illusion of a clean editor.

- **Bold and italic marks now disappear when you look away** — `Cmd+B` or `Cmd+I` on selected text would wrap it in `**` or `*`, but the asterisks would stick around even after you moved the cursor somewhere else. They now hide the moment you leave the line, the way they always should have.
- **`Cmd+S` goes straight to Downloads, no dialog** — depending on your browser settings, saving a note could pop up a "where do you want to save this?" window, and the confirmation toast would flash before you'd even answered. Now the file lands silently in your Downloads folder and the toast only appears once it's actually there.

---

## v1.1.1 — "Indent That" *(shipped)*

Small but felt. Two editor quality-of-life fixes.

- **List word-wrap alignment** — when a bullet or numbered-list item wraps to the next line, the continuation text now aligns with the first character after the marker (like any decent text editor), not back at column zero.
- **Tab / Shift-Tab indent & unindent** — press `Tab` to indent a line, `Shift-Tab` to unindent. Works the same as VS Code or Obsidian — no more rogue tab characters inserted mid-sentence.

---

## v1.1 — "Feels Like Home" *(shipped)*

The first v1 feedback pass. Focused on the moments you notice within thirty seconds of opening a new tab.

- **Welcome note on fresh install** — the first time you open the extension, you land directly in a "Welcome to tab-notes" note with everything you need to get started: the shortcuts, the philosophy, and a clear call to action.
- **Every new tab opens blank** — so the private draft you were writing earlier never flashes onto the screen in front of your boss. Previous notes are safe in the sidebar. The one exception: if your last note was already blank, we just reuse it instead of piling up empty drafts.
- **New note shortcut: `Cmd/Ctrl + N`** — start a blank note without reaching for the mouse.
- **Save button in the UI** — not everyone memorizes `Cmd+S`. A small download button now lives next to your note so one click grabs the file.
- **Smart file extension on save** — in Markdown mode you get a `.md`, in Plain text mode you get a `.txt`. No config, just does the right thing.
- **Live markdown styling** — type `#` and watch it scale to an H1, `##` to an H2, `###` to an H3. Your document looks like a document as you write, not a wall of hash marks.
- **Auto-pair brackets and quotes** — open `(`, `[`, `{`, `"`, or `` ` `` and the closing character appears automatically with your cursor in the middle. Works the way Obsidian does.
- **Plain-text mode** — toggle markdown off entirely if you just want a dead-simple text editor. The button shows `MD` when markdown is active and `Aa` when plain, with a tooltip that tells you what clicking will do.
- **Settings persist** — sidebar collapsed, plain/markdown mode, and any other preference now survive across new tabs and browser restarts.
- **Better sidebar toggle** — clearer chevron icon, visible outline, points the direction it will move.
- **New shortcut: `Cmd/Ctrl + \`** — toggle the sidebar from the keyboard.

---

## v1.0 — "The Markdown New Tab" *(shipped)*

The beginning. Every new tab is a blank page — literally.

- **New Tab override** — open a new tab and land directly in a focused markdown editor. No search bar, no thumbnails, no ads.
- **Auto-save** — everything you type persists to local storage on the fly. Close the tab, close the browser, come back — it's all there.
- **Recent notes sidebar** — a collapsible panel on the left shows your recent notes with titles and previews. Click to switch.
- **Markdown shortcuts** — `Cmd/Ctrl + B` for bold, `Cmd/Ctrl + I` for italic, `Cmd/Ctrl + \`` for inline code.
- **`Cmd/Ctrl + S` to download** — export any note as a `.md` file to your machine.
- **Light and dark themes** — follows your system preference automatically.
- **100% local, zero accounts** — no sign-up, no cloud, no telemetry. Your notes never leave your machine.
