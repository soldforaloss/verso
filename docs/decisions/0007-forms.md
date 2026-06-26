# 0007. AcroForm filling & save strategy

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

M5 adds interactive form filling. AcroForm fields live at the **document** level,
which is in tension with Verso's non-destructive, multi-source, reorderable page
model (ADR-0005): pdf-lib's `copyPages` does not carry the AcroForm field tree,
so a document rebuilt from the page model loses live form fields.

## Decision

- **Detect** fields with PDF.js `page.getAnnotations()` (per source page) and
  render our own HTML controls positioned via the viewport. Values are stored in
  a `formStore` keyed by `sourceId + fieldName`, so they belong to the source and
  survive page reordering.
- **Save** chooses one of two paths:
  - **Pristine** (a single source referenced 1:1 in original order — the normal
    "open a form, fill it, save" case): the source is loaded with pdf-lib, fields
    are filled **without flattening** (`form.updateFieldAppearances`), and page
    rotations + annotations are applied. The saved form stays **editable** with
    values intact, and the original structure (links, outline) is preserved.
  - **Rebuilt** (reordered / merged / blanks inserted): the page model is rebuilt
    via `copyPages`; form values are filled and the form is **flattened** into the
    source first (the only way values survive the copy).
- Radio on-states reported by PDF.js (`buttonValue`, often numeric indices) are
  mapped to pdf-lib option values at save time.
- **Field creation** (text fields and checkboxes): a field tool drags a rectangle
  to author a field, stored per logical page key (like annotations) in
  `tab.formFields` and created on save via `createTextField`/`createCheckBox` then
  `addToPage` — on `doc` (pristine, stays editable) or on the rebuilt `out` (which
  gains a fresh AcroForm). Names are auto-generated unique; Helvetica is
  auto-embedded and appearances regenerate on `save()`.

## Consequences

- The common fill-and-save workflow round-trips perfectly with an editable form.
- After page surgery, forms are flattened (values baked in, no longer editable) —
  a documented, reasonable limitation given pdf-lib's `copyPages` behavior.
- Text-field and checkbox **creation** is supported (above); other field types
  (radio/dropdown/list) and signature fields remain out of scope (see ROADMAP).

## Alternatives considered

- **PDF.js built-in form layer + `pdf.saveDocument()`** — robust for a single
  unedited document, but saves the whole source, bypassing the page model.
- **Always flatten on save** — simpler, but needlessly destroys editability in
  the common pristine case. Rejected in favor of the two-path approach.
