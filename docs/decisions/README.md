# Architecture Decision Records

Lightweight ADRs capture the **load-bearing** decisions behind Verso — the ones
a future contributor would otherwise have to reverse-engineer or relitigate.

- One decision per file, numbered sequentially: `NNNN-short-title.md`.
- Copy [`0000-template.md`](./0000-template.md) to start a new one.
- ADRs are immutable once `Accepted`. To change a decision, write a new ADR that
  supersedes the old one (and mark the old one `Superseded by 00NN`).

## Index

| #                                               | Title                                          | Status   |
| ----------------------------------------------- | ---------------------------------------------- | -------- |
| [0001](./0001-tech-stack.md)                    | Technology stack                               | Accepted |
| [0002](./0002-electron-security-model.md)       | Electron process & security model              | Accepted |
| [0003](./0003-runtime-versions.md)              | Runtime versions (React 19, TS 6, Vite 7)      | Accepted |
| [0004](./0004-viewer-and-document-transport.md) | Viewer rendering & document transport          | Accepted |
| [0005](./0005-page-model-and-history.md)        | Non-destructive page model & command history   | Accepted |
| [0006](./0006-annotation-model.md)              | Annotation model & flatten-on-save             | Accepted |
| [0007](./0007-forms.md)                         | AcroForm filling & save strategy               | Accepted |
| [0008](./0008-in-place-editing.md)              | In-place editing tiers & ContentEditor         | Accepted |
| [0009](./0009-ocr.md)                           | OCR (tesseract.js) & invisible text layer      | Accepted |
| [0010](./0010-security-export-redaction.md)     | Security (qpdf), export & rasterized redaction | Accepted |
