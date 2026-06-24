# Contributing to Verso

Thanks for your interest in improving Verso! This guide covers everything you
need to get productive.

## Development setup

**Prerequisites:** Node.js ≥ 20.19 (22 LTS recommended) and Git. On Windows you
also need the Visual Studio Build Tools if you later work on the optional native
PDFium addon (not required for the JS/TS app).

```bash
git clone https://github.com/versoeditor/verso.git
cd verso
npm install        # also installs Husky git hooks
npm run dev        # launch with hot reload
```

## Scripts

| Script                            | Purpose                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                     | Run the app in development with HMR.                                     |
| `npm run build`                   | Typecheck + production build into `out/`.                                |
| `npm run build:win`               | Build + package the Windows installer & portable exe.                    |
| `npm run typecheck`               | Type-check main/preload (`tsconfig.node`) and renderer (`tsconfig.web`). |
| `npm run lint` / `lint:fix`       | ESLint over the repo.                                                    |
| `npm run format` / `format:check` | Prettier write / verify.                                                 |
| `npm run test` / `test:watch`     | Vitest unit + component tests.                                           |
| `npm run test:e2e`                | Playwright Electron end-to-end tests (build first).                      |

## Project layout

See [`docs/architecture.md`](./docs/architecture.md). In short:
`src/main` (privileged), `src/preload` (the only bridge), `src/renderer`
(untrusted React app, organized by `features/`), `src/shared` (types + zod
schemas shared across processes).

## Conventions

- **Commits follow [Conventional Commits](https://www.conventionalcommits.org/)**
  — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `chore:`,
  optionally scoped (`feat(viewer): …`). commitlint enforces this on commit.
- **Pre-commit** runs lint-staged (ESLint `--fix` + Prettier) on staged files.
- **TypeScript is strict.** Prefer precise types over `any`; use `import type`
  for type-only imports (enforced).
- **Tests travel with code.** Add/adjust unit, component, or e2e tests for every
  behavioral change. CI must be green.

## The security model is load-bearing

Do **not** weaken the Electron sandbox to make a feature easier. `sandbox`,
`contextIsolation`, and the zod-validated IPC boundary are invariants (see
[`docs/architecture.md`](./docs/architecture.md) and ADR-0002). New main↔renderer
capabilities require: a channel name (`src/shared/channels.ts`), a zod schema
(`src/shared/ipc.ts`), a validated handler (`src/main/ipc/`), and an `api` method
(`src/preload/index.ts` + `src/shared/api.ts`).

## Adding an ADR

For any load-bearing decision (a new dependency, a structural change, a security
tradeoff), copy [`docs/decisions/0000-template.md`](./docs/decisions/0000-template.md)
to the next number, fill it in, and add a row to the ADR index.

## Pull requests

Open a PR against `main`, fill in the template, and make sure CI passes. Keep PRs
focused and reviewable. For UI changes, include before/after screenshots.
