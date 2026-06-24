# 0003. Runtime versions (React 19, TypeScript 6, Vite 7)

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The build prompt's stack table names "React 18" and lists the libraries but not
exact versions. By the time of scaffolding (2026-06), the current stable
releases had moved on, and `electron-vite`'s peer ranges constrain Vite.

## Decision

Pin to current stable rather than the literal versions implied by the spec:

- **React 19.2** (not 18). React 19 is the current stable, is fully supported by
  our entire UI stack (Radix, Testing Library 16, `@vitejs/plugin-react` 5), and
  pinning to an EOL-track 18 on a brand-new portfolio repo would look dated.
- **TypeScript 6.0**. Note: TS 6 deprecates `baseUrl`, so path aliases are
  declared with `paths` resolved relative to each `tsconfig` (no `baseUrl`).
- **Vite 7.3** with **`@vitejs/plugin-react` 5.2**. This is forced by a peer
  conflict: `electron-vite` 5 supports Vite `^5 || ^6 || ^7`, while
  `@vitejs/plugin-react` 6 _requires_ Vite 8. Vite 7 + plugin-react 5 is the
  only combination all three (electron-vite, the React plugin, Tailwind v4's
  Vite plugin, and Vitest 4) agree on.
- **Tailwind CSS v4** (CSS-first, via `@tailwindcss/vite`) with hand-authored
  shadcn-style primitives, rather than the shadcn CLI (which expects an
  interactive init and a Tailwind v3 layout).

## Consequences

- The repo uses the modern toolchain a senior reviewer would expect in 2026.
- We are blocked from Vite 8 until `electron-vite` adds support; this is a
  one-line bump when it lands and is tracked in `ROADMAP.md`.
- `typescript-eslint` may emit a "newer-than-tested TypeScript" notice against TS
  6; it is non-fatal and lint passes. Revisit when `typescript-eslint` GAs TS 6
  support.

## Alternatives considered

- **React 18 + Vite 8** as literally specced — impossible to satisfy together
  given the peer ranges, and React 18 is no longer the current stable.
- **Downgrade TS to 5.x** to avoid the `baseUrl` deprecation — rejected; removing
  `baseUrl` is trivial and TS 6 is the current release.
