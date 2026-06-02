# CLAUDE.md

Guidance for working in this repository. Read this before making changes.

## What this is

**ChapterOS** — a self-contained, dependency-free book editor that runs in the browser. Long-form writing tool: chapter sidebar, rich-text editor, annotated links, auto-renumbering footnotes, version snapshots, app-owned undo, autosave, and Markdown/HTML export. See `README.md` for the user-facing feature list.

## Run it

```bash
npm start          # serves on http://localhost:4321 (Node stdlib only, no deps)
```

There is **no build step and no `node_modules`**. Do not add a bundler, framework, or dependency without an explicit request — the zero-dependency, single-folder nature is a core design constraint, not an accident.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | All markup **and** all CSS (single `<style>` block). Layout: 3 columns — chapter sidebar, main editor, right panel. |
| `app.js` | All application logic. Loaded as a plain script (no modules). |
| `index.js` | Minimal static file server (`http`/`fs`/`path`), with a path-traversal guard. Serves the three files on `localhost`. |
| `package.json` | `start` script only. `private: true`. |

## Architecture & key concepts

- **Single source of truth**: one `state` object — `{ title, chapters[], versions[], versionCounter }` — persisted to `localStorage` under `STORAGE_KEY` (`book-editor:v1`).
- **Chapter shape**: `{ id, title, html, note, footnotes: [{id, text}] }`. `html` is the raw `contenteditable` output (rich HTML is the working format; Markdown is export-only).
- **`syncActiveFromDom()`** pulls the live editor DOM into `state` before any save/snapshot/export. Call it before reading chapter `html` for the active chapter.
- **Persistence**: `scheduleSave()` debounces a `persist()` (~600ms). `persist()` writes `localStorage`, mirrors to disk if a file is connected, and updates the save indicator. There is also a `beforeunload` flush.
- **Undo/redo is app-owned**, not the browser's. Native `contenteditable` undo is corrupted by programmatic DOM mutations (footnote/link `insertNode`), so we keep a per-chapter snapshot stack in `undoStacks` (a `Map`, **not persisted**). Typing is checkpointed on a debounce; programmatic edits wrap their mutation in `commitSnapshot()` before/after. `Cmd/Ctrl+Z` is only hijacked when the prose editor is focused.
- **Footnotes**: markers are atomic `<sup class="footnote-ref" data-fn=ID contenteditable="false">[n]</sup>`. `reconcileFootnotes()` syncs the chapter's footnote array to the markers actually present in the DOM (in document order) and renumbers them. Run it (via `renderNotes()`) after any edit that could add/remove markers.
- **Versions**: `Cmd/Ctrl+S` calls `createVersion()` — a full deep copy of the book into `state.versions` (numbered, timestamped, word-counted, deduped by JSON signature, capped at 50). Restore is reversible (snapshots current first).
- **Right panel** has two tabs (`Annotations`, `Versions`) driven by `.rp-tab` / `.rp-pane`.

## Conventions

- **Vanilla ES (browser)** in `app.js`. `Date`/`Math.random` are fine here (this is browser code, not a constrained script).
- **No innerHTML from untrusted/user strings without escaping** — use `escapeHtml()` (already used in tooltips, export, list rendering). User prose itself lives in `contenteditable` and is stored/exported as-is by design.
- **CSS lives only in `index.html`.** Many classes (`.chapter`, `.fn-item`, `.ver-item`, `.footnote-ref`, …) are created dynamically in `app.js`, so the IDE's CSS linter reports them as "selector never used" — **these are false positives**, do not delete the rules.
- Keep DOM element lookups centralized in the `els` object at the top of `app.js`.
- Match the existing style: small focused functions, section banner comments (`/* ---- X ---- */`), terse inline comments explaining *why*.

## When you change things — checklist

- After editing `app.js`: run `node --check app.js`.
- After editing `index.js`: run `node --check index.js`, then smoke-test routes:
  ```bash
  node -e "require('./index.js')" & sleep 1; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/ ; kill %1
  ```
- **Touching the editor/footnotes/links?** Verify the **undo boundaries** still wrap the mutation (`commitSnapshot()` before & after) and that `renderNotes()` is called so the panel/markers reconcile.
- **Touching state shape?** Update `migrateChapter()` / `migrateState()` so existing `localStorage` data loads without errors. Bump `STORAGE_KEY` only as a last resort (it wipes users' books).
- **Touching export?** Keep `.html` and `.md` in sync, and remember footnotes render as `[^n]` + definitions (MD) and an `<ol class="footnotes">` (HTML).
- The interactive behaviors are DOM/keyboard-driven — the real test is the browser. Use the `/run` or `/verify` skills to drive it when a change needs visual confirmation.

## Known constraints (don't "fix" without discussion)

- Data is `localStorage`-bound to the origin; durable backup = *Connect file* + exports.
- Version history capped at 50 (each is a full book copy → quota pressure on long manuscripts).
- Disk auto-save needs a Chromium-based browser on `localhost`/HTTPS (File System Access API).

## Roadmap / ideas (not yet built)

- Markdown/HTML **import** (round-trip back into the editor).
- Per-book justify/ragged-right toggle.
- A dedicated footnotes/margin-notes export section.
- Optional Nuxt port (the parent folder is `nuxt/`; current app is intentionally framework-free).
