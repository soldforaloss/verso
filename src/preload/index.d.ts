import type { VersoApi } from '@shared/api'

/**
 * Augments the renderer's global `window` with the typed bridge exposed by the
 * preload. Importing `window.api` anywhere in the renderer is fully type-checked
 * against the shared `VersoApi` contract.
 */
declare global {
  interface Window {
    api: VersoApi
  }
}

export {}
