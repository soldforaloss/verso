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

### ✅ M6 — In-place text & image editing

- **Tier 1** — add **text, shapes, and images** (PNG/JPEG) and freely move /
  resize / restyle / delete them; flattened into the PDF on save.
- **Tier 2** — **cover-&-replace** editing of existing text: click a line and
  the **whole line** (the contiguous runs sharing its baseline) is covered with
  a background-sampled box and a pre-filled editable text box, so "City · phone ·
  email" edits as one piece instead of a fragment — matching the original color
  (sampled), size, and font face. Documents in
  the common fonts get **metric-compatible substitutes** embedded on save, so
  the layout is preserved exactly: **Liberation Sans/Serif/Mono** (Arial / Times
  New Roman / Courier New), **Carlito** (Calibri), **Caladea** (Cambria), plus
  **Lato** used directly — all SIL OFL. **Manual font, size, bold/italic, color,
  and letter-spacing controls** let you fine-tune anything else.
- Honest about its limits: an unbundled custom font falls back to a standard
  substitute (best-effort metrics, auto-tuned spacing), and there is no reflow.
- **Fast workflow:** select text and act from a floating popover (highlight,
  underline, strikethrough, **edit**, copy), or **double-click a run** to edit
  it — no need to pick a tool first.
- A clean **`ContentEditor`** abstraction is the swap point for a future Tier 3
  (PDFium, BSD-licensed) — see [ADR-0008](./docs/decisions/0008-in-place-editing.md).

### ✅ M7 — OCR

- **tesseract.js** runs in its own worker (UI never blocks), fully **offline** —
  the worker, wasm cores, and English data are bundled and served from the app
  origin ([ADR-0009](./docs/decisions/0009-ocr.md)).
- OCR **embeds an invisible text layer into the PDF**, so the recognized text is
  immediately **selectable**, **searchable**, and **persists on save** through
  the existing machinery (no parallel layer).
- Live progress; English bundled (more languages via `@tesseract.js-data/<lang>`).

### ✅ M8 — Security, metadata & export

- **Document properties** editor (title, author, subject, keywords, creator,
  producer) applied with pdf-lib on save.
- **Security via a bundled qpdf sidecar** (Apache-2.0): 256-bit AES encryption
  with permission flags, password removal, structural repair, and
  linearization — through a single zod-validated IPC channel whose arguments
  are built entirely in the main process ([ADR-0010](./docs/decisions/0010-security-export-redaction.md)).
- **True redaction**: marked pages are rasterized so the content beneath the
  box is destroyed, not merely hidden — gated behind an explicit warning, with
  unmarked pages copied losslessly.
- **Export** pages to PNG/JPEG (annotations and filled fields baked in) and
  **print** via Chromium's PDF viewer in a sandboxed offscreen window.

### ✅ M9 — Polish, packaging & release

- **Keyboard shortcuts cheat-sheet** (press `?` or the toolbar button) and a
  top-level **error boundary** with a calm, recoverable fallback.
- A code-generated **app icon** (no image-library dependency) wired into the
  window, installer, and `.pdf` file association, with a matching in-app mark.
- **Opt-in auto-update** via electron-updater (packaged builds only; the sole
  network call Verso makes) and a tag-triggered **release pipeline** that
  publishes the Windows installer + portable exe and the update feed
  ([ADR-0011](./docs/decisions/0011-packaging-and-release.md)).

All planned milestones (M0–M9) have shipped. Future work lives below.

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
