# 📖 ChapterOS — A Distraction-Free Book Editor for the Browser

*Write long-form. Keep your chapters, your footnotes, and every version of the truth — all in one tab, no account, no cloud, no build step.*

ChapterOS is a self-contained writing environment for authors of books, theses, and long documents. It runs from a single folder, stores everything locally, and exports clean Markdown or HTML. There is no framework, no bundler, and no `node_modules` — just open it and write.

---

## Why ChapterOS

Most "rich" editors are built for short web content. Long-form writing needs different things: a stable chapter structure, real footnotes that renumber themselves, links you can annotate, reliable undo that survives complex edits, and the confidence that you can always go back to yesterday's draft. ChapterOS is built around those needs, and around a hard constraint: **your words never leave your machine** unless you explicitly export them.

---

## Features

### ✍️ Writing surface
- **Rich-text editor** on a book-like "paper" surface with serif typography.
- **Justified text with automatic hyphenation** by default — the classic long-form look — while headings stay flush-left.
- **Formatting toolbar**: Heading 1–3, paragraph, **bold**, *italic*, underline, strikethrough, bullet & numbered lists, blockquote, and horizontal rule.
- **Live toolbar state** — buttons highlight to reflect the formatting under your cursor.
- **Per-chapter and whole-book word counts**, updated as you type.

### 📚 Chapter management
- **Sidebar chapter list** — add, rename, and delete chapters.
- **Drag-to-reorder** chapters.
- **Click to switch**; each chapter is its own document with its own undo history.
- Live word count next to every chapter, plus a book-wide total.

### 🔗 Annotated links
- Insert links with **text + URL + a description** (your annotation / note).
- The description is shown as a **hover tooltip** in the prose and travels with the link on export.
- **Smart URLs** — bare domains become `https://…`, while in-book references (`#…`) are left untouched.
- `Cmd/Ctrl + Click` a link to open it.
- Every link in the current chapter is **collected automatically** in the Annotations panel, with its description and target.

### 🔖 Footnotes
- Insert **numbered footnotes** at the cursor with one keystroke.
- **Automatic renumbering** in document order — delete one and the rest re-flow instantly.
- **Two-way navigation**: click a marker in the prose to jump to its note, or click a note to jump to its marker (both flash to orient you).
- Footnote text is edited in the side panel, kept per chapter.

### 🗂️ Versions (manual snapshots)
- Press **`Cmd/Ctrl + S`** (or the *Save version* button) to snapshot the **entire book** — text, footnotes, and notes.
- Each version is **numbered, timestamped, and word-counted**, with an optional **label**.
- **Reversible restore** — restoring auto-saves your current draft as a new version first, so you can never paint yourself into a corner.
- The version matching your current text is marked **current**; identical saves are de-duplicated.
- Versions persist across reloads (kept to the most recent 50).

### ↩️ Reliable undo / redo
- **App-owned undo history** (`Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z` / `Cmd/Ctrl + Y`) that survives complex operations native browser undo mangles.
- Typing is checkpointed on pauses; **formatting, link, and footnote operations each get a clean, reversible boundary**.
- Cursor position is restored on undo/redo.
- History is **per chapter** and scoped to the prose editor, so side-panel inputs keep their own native undo.

### 💾 Autosave & storage
- **Continuous autosave** to `localStorage` (debounced, plus a flush on tab close) — your latest text is always safe.
- **Optional real-disk mirror**: connect a `.html` file via the File System Access API and every autosave writes straight to disk.
- A **save-status indicator** shows when changes are saved.

### 📤 Export
- One-click export to a single **`.html`** or **`.md`** document covering the whole book.
- The built-in **HTML → Markdown** converter emits standard footnote syntax (`[^n]` references with definitions per chapter) and preserves annotated links as `[text](url "description")`.
- Exported HTML carries the same justified, hyphenated book styling.

### ⌨️ Keyboard-first
| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + B / I / U` | Bold / Italic / Underline |
| `Cmd/Ctrl + K` | Insert / edit link |
| `Cmd/Ctrl + E` | Insert footnote |
| `Cmd/Ctrl + S` | Save a new version |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` / `Cmd/Ctrl + Y` | Redo |
| `Esc` | Dismiss the link dialog |

---

## Getting started

```bash
npm start
# → open http://localhost:4321
```

That's it — no install step, no dependencies. The included static server (Node standard library only) serves the app on `localhost`, which is what enables the optional disk auto-save (the File System Access API requires a secure context).

> You can also open `index.html` directly from the file system. `localStorage` autosave and export still work; only the *connect-a-file* disk mirror needs `localhost`.

---

## How it works

- **`index.html`** — layout and all styling.
- **`app.js`** — application logic (editor, chapters, links, footnotes, undo, versions, export).
- **`index.js`** — a minimal zero-dependency static file server with a path-traversal guard.

The whole book lives in a single state object persisted to `localStorage`. Chapters store rich HTML; Markdown is produced on demand by an internal serializer.

---

## Limitations & notes

- **Local-first by design.** Data lives in your browser's `localStorage` for the origin you open it from. Clearing site data clears your book — use *Connect file* and the exports for durable backups.
- **Storage budget.** Each version is a full copy of the book, so version history is capped at 50 to respect the browser's `localStorage` quota on long manuscripts.
- **Disk auto-save** (File System Access API) is supported in Chromium-based browsers on `localhost`/HTTPS; elsewhere, use the `.html` / `.md` exports.

---

## License

Private project. See `package.json`.
