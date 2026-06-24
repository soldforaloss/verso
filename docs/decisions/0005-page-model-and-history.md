# 0005. Non-destructive page model & command-pattern history

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

M3 introduces page management (reorder, rotate, delete, insert, duplicate,
merge, split, extract) and requires that **every** edit be undoable/redoable and
that saving produces a valid PDF. We need a representation that makes operations
cheap, composable, and reversible without re-parsing the document on each edit.

## Decision

**Logical page model.** A document's current state is an ordered list of page
descriptors (`PageRef`), not mutated PDF bytes. Each `PageRef` is either:

- a **source** page — `{ sourceId, sourceIndex, rotation, crop? }` referencing a
  page in a loaded source PDF, or
- a **blank** page — `{ width, height, rotation }`.

A tab may reference several **sources** (its original file plus any PDFs inserted
or merged in). Sources hold both the PDF.js proxy (for rendering) and the
original bytes (for saving). The viewer and thumbnail rail render straight from
`PageRef`s, so operations are just array transforms — instant, no re-parse.

**`pdf-lib` only at save time.** Saving builds a fresh `PDFDocument`: for each
`PageRef` it `copyPages` from the source's bytes (or `addPage` for a blank),
applies rotation, in order. The renderer produces the bytes; the main process
writes them atomically.

**Command-pattern history, per document.** A generic engine stores
`{ label, redo(), undo() }` commands in per-document past/future stacks. Page
operations are expressed as snapshot commands (capture the `pages` array before
and after) — trivially correct and reversible, and the same engine will carry
annotation and content edits in later milestones. Capped at a sane depth.

## Consequences

- Operations are O(n) array transforms and instantly undoable; no document
  re-parse until save.
- The viewer renders descriptors, so it must compose each page's intrinsic
  `/Rotate` with the descriptor rotation and the global view rotation. (This also
  fixed an M1 latent bug where intrinsic page rotation was overridden.)
- PDF.js proxies and bytes live in a module-level source cache (outside the
  reactive store), as in M1.
- **Crop** is modeled (`crop` on `PageRef`) but its full rotation-aware
  implementation is deferred; see ROADMAP. Everything else in M3 ships complete.

## Alternatives considered

- **Mutate bytes per operation** (pdf-lib round-trip + PDF.js reload each edit) —
  simple but slow on large documents and memory-heavy for byte-snapshot undo.
  Rejected.
- **Fine-grained inverse commands** (e.g. "move page from i to j" with a computed
  inverse) — more code and more error-prone than snapshotting the small `pages`
  array. Snapshots are correct by construction.
