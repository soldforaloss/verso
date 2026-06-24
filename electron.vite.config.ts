import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * electron-vite configuration.
 *
 * - `main` and `preload` are bundled by esbuild/Rollup and output as CommonJS
 *   (the package has no `"type": "module"`), which keeps the **sandboxed**
 *   preload script loadable. See docs/decisions/0002-electron-security-model.md.
 * - `externalizeDepsPlugin()` keeps `dependencies` external in main (they are
 *   resolved from node_modules at runtime). The preload intentionally imports
 *   only `electron` so it remains a thin, dependency-free bridge.
 * - The renderer is a standard Vite + React app and may use ESM freely; it is
 *   treated as untrusted and never receives Node integration.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    // No externalizeDepsPlugin here: a *sandboxed* preload cannot `require()`
    // external node_modules at runtime, so every runtime dependency must be
    // bundled into the single preload file. (We keep the preload dependency-free
    // apart from `electron` anyway — see docs/decisions/0002.)
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    }
  }
})
