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
- **Tier 3 — true content-stream editing (deferred).** The `ContentEditor`
  interface is the swap point: a future PDFium (BSD) native addon can implement
  the same interface with real glyph/object edits without touching call sites.

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
