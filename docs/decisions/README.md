# Architecture Decision Records

Lightweight ADRs capture the **load-bearing** decisions behind Verso — the ones
a future contributor would otherwise have to reverse-engineer or relitigate.

- One decision per file, numbered sequentially: `NNNN-short-title.md`.
- Copy [`0000-template.md`](./0000-template.md) to start a new one.
- ADRs are immutable once `Accepted`. To change a decision, write a new ADR that
  supersedes the old one (and mark the old one `Superseded by 00NN`).

## Index

| #                                               | Title                                     | Status   |
| ----------------------------------------------- | ----------------------------------------- | -------- |
| [0001](./0001-tech-stack.md)                    | Technology stack                          | Accepted |
| [0002](./0002-electron-security-model.md)       | Electron process & security model         | Accepted |
| [0003](./0003-runtime-versions.md)              | Runtime versions (React 19, TS 6, Vite 7) | Accepted |
| [0004](./0004-viewer-and-document-transport.md) | Viewer rendering & document transport     | Accepted |
