# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Verso, please report it
**privately** so it can be fixed before public disclosure.

- Use GitHub's **[Report a vulnerability](https://github.com/soldforaloss/verso/security/advisories/new)**
  (Security → Advisories) to open a private report, **or**
- email **security@versoeditor.com**.

Please include:

- a description of the issue and its impact,
- steps to reproduce (a sample PDF or minimal repro is ideal),
- the Verso version and your OS, and
- any suggested mitigation.

We aim to acknowledge reports within **72 hours** and to provide a remediation
timeline after triage. Please give us reasonable time to ship a fix before any
public disclosure. We're happy to credit reporters who wish to be named.

## Scope

Verso processes untrusted files locally and is built around a hardened Electron
model (see [`docs/architecture.md`](./docs/architecture.md)). We are especially
interested in:

- renderer sandbox escapes or context-isolation bypasses,
- IPC validation gaps (payloads that bypass the zod boundary),
- CSP weaknesses or paths to remote code execution,
- **redaction correctness** — any case where content presented as redacted
  remains recoverable from the output bytes.

## Supported versions

Verso is pre-1.0 and under active development; security fixes target the latest
release and `main`.
