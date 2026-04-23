# tab-notes

A minimalist Markdown editor that replaces Chrome's New Tab page with a private, local-first writing space.

[Quick Start](#quick-start) · [Shortcuts](#shortcuts) · [Roadmap](./ROADMAP.md) · [Support](#support)

## Why

Most new tabs are dead space: search bars, shortcut grids, or a blank screen that does nothing for you.

`tab-notes` turns that moment into a writing surface. Open a new tab and start typing immediately. No account, no sync setup, no dashboard, no startup friction.

It is built for people who want somewhere fast to think, draft, jot, or park a note without leaving the browser.

## Features

- Replaces Chrome's New Tab page with a focused Markdown editor
- Saves notes locally with no account or cloud dependency
- Supports fast formatting shortcuts for writing without mouse-heavy UI
- Exports the current note as Markdown when you want to keep it elsewhere
- Keeps recent notes available in a sidebar for quick switching

## Quick Start

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `dist/` folder

Open a new tab with `Cmd/Ctrl + T`. You should land directly in the editor with focus ready.

## Development

```bash
npm install
npm run dev
```

## Shortcuts

- `Cmd/Ctrl + B` for bold
- `Cmd/Ctrl + I` for italic
- `Cmd/Ctrl + \`` for inline code
- `Cmd/Ctrl + S` to download the current note
- `Cmd/Ctrl + N` to start a new note
- `Cmd/Ctrl + \` to toggle the sidebar

## Storage

All notes live in `chrome.storage.local`.

- No cloud
- No account
- No telemetry layer described by this repo

## Status

`active`

The extension is working today as a local-first Chrome New Tab writing tool. Planned quality-of-life work lives in [ROADMAP.md](./ROADMAP.md), and shipped changes are tracked in [PATCH-NOTES.md](./PATCH-NOTES.md).

## Support

- If `tab-notes` helped you, give it a star and share it with someone who writes in the browser.
- Interested building something similar for yourself or business, I do selected 0-1 product and implementation consulting.
- For collaboration or consulting inquiries, email `mail@joejosue.com`.
