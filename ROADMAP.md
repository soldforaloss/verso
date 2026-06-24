# Roadmap

Verso is built in runnable, committable milestones. Each milestone has a
Definition of Done that must pass (lint + typecheck + tests + build) before the
next begins.

## Shipped

### ✅ M0 — Scaffold, security baseline, CI

- electron-vite (React + TS strict) project; ESLint + Prettier; Husky +
  lint-staged + commitlint (Conventional Commits enforced).
- Full §4 security model end to end: `contextIsolation` + `sandbox` on,
  `nodeIntegration` off, strict CSP, navigation lockdown, and a minimal
  **zod-validated** `contextBridge` API proved by a `ping` round-trip.
- `electron-builder` produces a Windows **NSIS installer + portable exe**;
  auto-update feed wired for releases.
- GitHub Actions CI on `windows-latest`: lint → format → typecheck → unit/
  component tests → build → Electron e2e.
- ADRs for the stack, security model, and runtime versions.

### ✅ M1 — Core viewer

- PDF.js worker rendering with an aligned, selectable/copyable **text layer**.
- **Lazy, virtualized** page rendering (IntersectionObserver; off-screen pages
  released) for smooth scrolling of very large documents.
- Open via menu, **drag-and-drop**, OS **file association**, and **CLI argument**;
  recent-files list; **multi-document tabs**.
- Zoom (fit-width / fit-page / custom, Ctrl+scroll), continuous / single / two-up
  layouts, rotation, fullscreen, go-to-page, light/dark + sepia/night reading modes.
- Production renderer served over a custom **`app://` protocol** (real origin →
  CSP enforced, offline cMaps/fonts resolve); PDF bytes transferred via IPC.
- Preferences (theme, layout, reading mode) persisted to disk by the main process.

## In progress / planned

| Milestone                                   | Scope                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M2 — Navigation & search**                | Lazy thumbnail rail; outline/bookmarks; full-text search with match highlighting and next/prev.                                                                         |
| **M3 — Page management + undo/redo engine** | Command-pattern history store; reorder/rotate/delete/insert/extract/duplicate/crop/merge/split via pdf-lib; multi-select.                                               |
| **M4 — Annotations & markup**               | Highlight/underline/strike/squiggly; ink; shapes; text boxes/callouts; sticky notes; stamps; signatures. Real PDF annotations where possible, flatten-on-export toggle. |
| **M5 — Forms (AcroForm)**                   | Detect + fill text/checkbox/radio/dropdown/listbox; validate; reset; save; flatten.                                                                                     |
| **M6 — In-place text & image editing**      | Tier 1 (add new content) + Tier 2 (cover-&-replace existing text/images). `ContentEditor` abstraction prepared for Tier 3.                                              |
| **M7 — OCR**                                | tesseract.js in a worker; searchable text layer for scans; language selection; offline.                                                                                 |
| **M8 — Security, metadata & export**        | Metadata editor; qpdf passwords/permissions/decrypt/repair/linearize; **true redaction** vs whiteout with explicit warnings; export pages to PNG/JPEG; print.           |
| **M9 — Polish, packaging & release**        | Keyboard map + cheat-sheet; error boundaries; app icon; `.pdf` association; auto-update; screenshots + demo GIF; tagged-release pipeline.                               |

## Stretch / future

- **Tier 3 in-place editing** — true content-stream/glyph editing via a PDFium
  (BSD) native addon, implementing the `ContentEditor` interface.
- **macOS & Linux builds** — the architecture is cross-platform; package targets
  are stubbed in `electron-builder.yml`.
- **Form field creation** — author new AcroForm fields, not just fill.
- **PDF compare** — visual + text diff of two documents.
- **Crash recovery** — restore unsaved edits after an unexpected exit.
- **Vite 8** — bump once `electron-vite` supports it (see ADR-0003).
