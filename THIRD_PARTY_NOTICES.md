# Third-Party Notices

Verso is distributed under the [MIT License](./LICENSE). It builds on the
following open-source projects. This file is maintained alongside
`package.json`; license fields are read from each package's manifest.

All runtime dependencies are MIT-compatible (MIT, Apache-2.0, BSD, ISC). **No
copyleft (GPL/AGPL/LGPL) code is bundled into the distributable.** In particular
MuPDF/`mupdf.js` is deliberately excluded (AGPL); PDFium (BSD) is used instead
for the optional native editing path. See `docs/decisions/0001-tech-stack.md`.

## Bundled / sidecar (not npm)

| Component                     | License                   | Notes                                                                    |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| qpdf                          | Apache-2.0                | Sidecar binary for encryption/decryption/repair/linearize (added in M8). |
| PDFium                        | BSD-3-Clause / Apache-2.0 | Optional native addon for Tier-3 content editing (stretch).              |
| PDF.js cMaps & standard fonts | Apache-2.0                | Bundled from `pdfjs-dist` for offline rendering.                         |

## Runtime dependencies

| Package                    | Version | License    |
| -------------------------- | ------- | ---------- |
| `@pdf-lib/fontkit`         | 1.1.1   | MIT        |
| `class-variance-authority` | 0.7.1   | Apache-2.0 |
| `clsx`                     | 2.1.1   | MIT        |
| `electron-log`             | 5.4.4   | MIT        |
| `electron-updater`         | 6.8.9   | MIT        |
| `immer`                    | 11.1.8  | MIT        |
| `lucide-react`             | 1.21.0  | ISC        |
| `pdf-lib`                  | 1.17.1  | MIT        |
| `pdfjs-dist`               | 6.0.227 | Apache-2.0 |
| `tailwind-merge`           | 3.6.0   | MIT        |
| `zod`                      | 4.4.3   | MIT        |
| `zustand`                  | 5.0.14  | MIT        |

## Development dependencies

| Package                           | Version | License    |
| --------------------------------- | ------- | ---------- |
| `@commitlint/cli`                 | 21.1.0  | MIT        |
| `@commitlint/config-conventional` | 21.1.0  | MIT        |
| `@eslint/js`                      | 10.0.1  | MIT        |
| `@playwright/test`                | 1.61.1  | Apache-2.0 |
| `@radix-ui/react-dialog`          | 1.1.17  | MIT        |
| `@radix-ui/react-dropdown-menu`   | 2.1.18  | MIT        |
| `@radix-ui/react-scroll-area`     | 1.2.12  | MIT        |
| `@radix-ui/react-separator`       | 1.1.10  | MIT        |
| `@radix-ui/react-slot`            | 1.3.0   | MIT        |
| `@radix-ui/react-switch`          | 1.3.1   | MIT        |
| `@radix-ui/react-tabs`            | 1.1.15  | MIT        |
| `@radix-ui/react-tooltip`         | 1.2.10  | MIT        |
| `@tailwindcss/vite`               | 4.3.1   | MIT        |
| `@testing-library/jest-dom`       | 6.9.1   | MIT        |
| `@testing-library/react`          | 16.3.2  | MIT        |
| `@testing-library/user-event`     | 14.6.1  | MIT        |
| `@types/node`                     | 22.20.0 | MIT        |
| `@types/react`                    | 19.2.17 | MIT        |
| `@types/react-dom`                | 19.2.3  | MIT        |
| `@vitejs/plugin-react`            | 5.2.0   | MIT        |
| `electron`                        | 42.5.0  | MIT        |
| `electron-builder`                | 26.15.3 | MIT        |
| `electron-vite`                   | 5.0.0   | MIT        |
| `eslint`                          | 10.5.0  | MIT        |
| `eslint-config-prettier`          | 10.1.8  | MIT        |
| `eslint-plugin-react-hooks`       | 7.1.1   | MIT        |
| `eslint-plugin-react-refresh`     | 0.5.3   | MIT        |
| `globals`                         | 17.7.0  | MIT        |
| `husky`                           | 9.1.7   | MIT        |
| `jsdom`                           | 29.1.1  | MIT        |
| `lint-staged`                     | 17.0.8  | MIT        |
| `prettier`                        | 3.8.4   | MIT        |
| `react`                           | 19.2.7  | MIT        |
| `react-dom`                       | 19.2.7  | MIT        |
| `tailwindcss`                     | 4.3.1   | MIT        |
| `typescript`                      | 6.0.3   | Apache-2.0 |
| `typescript-eslint`               | 8.62.0  | MIT        |
| `vite`                            | 7.3.5   | MIT        |
| `vite-plugin-static-copy`         | 4.1.1   | MIT        |
| `vitest`                          | 4.1.9   | MIT        |

---

To regenerate this table, re-run the script in this commit's history or use a
tool such as `license-checker`. Report any inaccuracy via an issue.
