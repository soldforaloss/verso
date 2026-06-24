# 0006. Annotation model & flatten-on-save

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

M4 adds markup: ink, shapes, text boxes, sticky notes, and text highlight/
underline/strikethrough/squiggly. Annotations must survive zoom, rotation, and
page reordering; be fully editable (select/move/resize/restyle/delete) and
undoable; and persist when the document is saved and reopened.

## Decision

**Geometry in PDF page space.** Every annotation stores its coordinates in the
page's unrotated PDF point space (origin bottom-left), keyed by the **logical
page's stable `key`** (so it travels with the page through reorders/deletes).
The interactive overlay converts to/from screen space with the PDF.js
`viewport.convertToViewportPoint` / `convertToPdfPoint` helpers, so a single
stored representation renders correctly at any zoom/rotation and maps directly
to `pdf-lib` on save.

**History-routed mutations.** Annotation create/update/delete go through the
same per-document command engine as page operations (snapshot of the affected
page's annotation array), so everything is undoable.

**Flatten on save.** Because `pdf-lib` has no robust high-level API for live
markup annotations (ADR-0001 / research §4.5), annotations are **drawn into the
page content stream** on save via `pdf-lib` (lines, rectangles, ellipses, text,
quads). They persist and render identically in every viewer. This is the
pragmatic approach real consumer editors use; it is robust and license-clean.

## Consequences

- Annotations persist visibly on save/reopen, and look the same everywhere.
- After save+reopen they are **content, not re-editable annotation objects** —
  the expected consequence of flattening. Round-trippable _live_ PDF annotations
  (hand-built annotation dicts with appearance streams, or via PDFium) are a
  roadmap item.
- The "flatten" export toggle is therefore effectively always-on for v1 and is
  deferred as a real toggle alongside live-annotation embedding.

## Scope for M4

Implemented: select, ink (+ eraser), rectangle, ellipse, line, arrow, text box,
sticky note (+ comments panel), and text markup (highlight/underline/
strikethrough/squiggly). **Stamps** and a dedicated **signature capture** modal
(draw/type/import) are deferred to a documented follow-up — users can still sign
by drawing (ink) or typing (text box) in the meantime. See ROADMAP.

## Alternatives considered

- **Hand-built live annotation dicts + appearance streams** — round-trippable but
  intricate and error-prone (research §4.5). Deferred.
- **Store geometry in screen space** — breaks on zoom/rotation and needs
  conversion on every save anyway. Rejected.
