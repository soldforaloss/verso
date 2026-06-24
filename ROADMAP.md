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

### ✅ M2 — Navigation & search

- **Thumbnail rail** (lazy-rendered) with current-page sync and click-to-jump.
- **Outline / bookmarks** panel built from the document outline, with
  collapsible nodes that navigate to their destination page.
- **Full-text search** across the whole document: live result count, next/prev,
  and on-page **highlighting** (matches mapped to text-item rectangles), with the
  active match emphasized and scrolled into view.

### ✅ M3 — Page management + undo/redo engine

- A generic **command-pattern history engine** (per-document undo/redo); every
  page edit routes through it (see [ADR-0005](./docs/decisions/0005-page-model-and-history.md)).
- A non-destructive **logical page model**: reorder (drag in the thumbnail rail),
  rotate, delete, duplicate, insert blank, insert/merge from another PDF, extract
  selection, and split into one PDF per page — composing instantly without
  re-parsing.
- Multi-select in the thumbnail rail (click / Ctrl-click / Shift-click).
- **Save / Save As** builds a valid PDF from the page model via `pdf-lib`
  (rotation composed, blanks created), written atomically; dirty-state tracking
  with a close confirmation.
- _Crop is modeled but deferred — see Stretch._

### ✅ M4 — Annotations & markup

- An interactive annotation **overlay** above each page (preserving PDF.js's
  canvas/text layers) with annotations stored in PDF page space so they survive
  zoom, rotation, and page reordering ([ADR-0006](./docs/decisions/0006-annotation-model.md)).
- Tools: **ink** (color/width) + **eraser**, **rectangle/ellipse**, **line/arrow**,
  **text box**, **sticky note** (+ a Comments panel), and text **highlight /
  underline / strikethrough / squiggly** over selected text.
- Select, move, resize (handles), recolor/restyle, and delete — all **undoable**
  through the M3 history engine.
- On save, annotations are **flattened into the PDF** via pdf-lib, so they
  persist and render identically everywhere.
- _Stamps and a dedicated signature-capture modal are deferred — see Stretch._

### ✅ M5 — Forms (AcroForm)

- Detects fields with PDF.js and renders interactive controls (text, checkbox,
  radio, dropdown, list box) positioned over the page; values stored per source.
- **Fill, reset**, and **save** via pdf-lib. A pristine document saves with the
  form **still editable** (values intact); a restructured document flattens the
  filled form. See [ADR-0007](./docs/decisions/0007-forms.md).
- _Field creation and signature fields are out of scope (see Stretch)._

## In progress / planned

| Milestone                              | Scope                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M6 — In-place text & image editing** | Tier 1 (add new content) + Tier 2 (cover-&-replace existing text/images). `ContentEditor` abstraction prepared for Tier 3.                                    |
| **M7 — OCR**                           | tesseract.js in a worker; searchable text layer for scans; language selection; offline.                                                                       |
| **M8 — Security, metadata & export**   | Metadata editor; qpdf passwords/permissions/decrypt/repair/linearize; **true redaction** vs whiteout with explicit warnings; export pages to PNG/JPEG; print. |
| **M9 — Polish, packaging & release**   | Keyboard map + cheat-sheet; error boundaries; app icon; `.pdf` association; auto-update; screenshots + demo GIF; tagged-release pipeline.                     |

## Stretch / future

- **Tier 3 in-place editing** — true content-stream/glyph editing via a PDFium
  (BSD) native addon, implementing the `ContentEditor` interface.
- **macOS & Linux builds** — the architecture is cross-platform; package targets
  are stubbed in `electron-builder.yml`.
- **Page cropping** — the page model carries a crop box; the rotation-aware
  render/save implementation is deferred to its own focused pass (ADR-0005).
- **Stamps & signature capture** — annotation types are in place; a stamp gallery
  and a draw/type/import signature modal are a follow-up (ADR-0006). Users can
  sign today by drawing (ink) or typing (text box).
- **Live (re-editable) PDF annotations** — Verso flattens annotations on save;
  round-trippable annotation objects need appearance-stream authoring or PDFium.
- **Form field creation** — author new AcroForm fields, not just fill.
- **PDF compare** — visual + text diff of two documents.
- **Crash recovery** — restore unsaved edits after an unexpected exit.
- **Vite 8** — bump once `electron-vite` supports it (see ADR-0003).
