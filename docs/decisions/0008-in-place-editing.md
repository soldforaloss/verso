# 0008. In-place editing tiers & the ContentEditor abstraction

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

PDF text is positioned glyphs, not editable paragraphs. The spec calls for three
tiers of editing, shipping Tiers 1–2 and scaffolding a clean seam for Tier 3.

## Decision

- **Tier 1 — add new content (real, robust).** Text boxes, shapes, and **images**
  (PNG/JPEG, placed from the file picker as a `data:` URL) are first-class
  annotations: freely moved, resized, restyled, and deleted in-app, then
  flattened into the PDF on save. This reuses the M4 annotation system, so it was
  largely free.
- **Tier 2 — edit existing text via cover-&-replace.** A `ContentEditor`
  abstraction (`editTextRun`) finds the clicked text run via PDF.js
  `getTextContent` geometry, covers it with a **background-sampled** rectangle,
  and drops an editable text box **pre-filled with the original string** at the
  same position and approximate font size. On save it flattens.
  - **Honest limits** (surfaced in the tool tooltip and comments): the background
    match is a single sampled pixel (imperfect on gradients/images), the font is a
    best-effort fallback, and there is no text reflow. This is the pragmatic
    approach mainstream consumer editors use — robust and license-clean.
- **Tier 3 — true content-stream editing (shipped).** Double-clicking a text run
  edits the **real content stream** via PDFium compiled to WebAssembly
  (`@embedpdf/pdfium`, an MIT wrapper over Apache-2.0 PDFium — a full,
  save-capable binding, unlike the render-only `@hyzyla/pdfium`). The flow is
  `FPDF_LoadMemDocument` → hit-test text objects by page-space bounds
  (`FPDFPageObj_GetBounds`) → `FPDFText_SetText` → `FPDFPage_GenerateContent` →
  `PDFiumExt_SaveAsCopy`. The original font/size/color are preserved natively (no
  substitution, no cover box) and the result is genuine selectable text.
  - **Where it runs:** the **main process**, behind two zod-validated IPC
    channels (`pdfium:locate-text`, `pdfium:edit-text`). The 4.6 MB wasm loads
    from disk (no renderer-bundle bloat, no CSP `wasm-eval`), is pre-warmed at
    startup, and the edit is a pure `bytes + point → bytes` function. The
    renderer applies the result via `replaceSource` — the same eager path OCR
    uses — so what's shown is exactly what saves.
  - **Fallback:** if the click isn't over a text object (or the page carries a
    tab-applied rotation, where page-space coordinates don't line up), it cleanly
    falls back to the Tier-2 overlay. The explicit "Edit existing text" tool and
    the selection popover remain Tier-2 for styled edits on substituted fonts.

## Consequences

- Adding content and lightly editing existing text both work today and produce
  valid PDFs that reopen everywhere.
- Edited/added content is flattened on save (not re-editable after reopen) — the
  expected consequence, consistent with annotations (ADR-0006).
- The Tier-3 upgrade is isolated behind one interface.

## Alternatives considered

- **MuPDF for true editing** — forbidden (AGPL); PDFium (BSD) is the chosen
  Tier-3 path.
- **Editing the content stream directly with pdf-lib** — pdf-lib has no API for
  rewriting existing glyph runs; cover-&-replace is the robust interim.
