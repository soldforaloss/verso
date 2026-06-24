import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Unit + component tests run under Vitest with a jsdom environment so React
 * Testing Library can mount components. Path aliases mirror the renderer build.
 * Electron end-to-end tests live in `tests/e2e` and run under Playwright
 * instead (see playwright.config.ts).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
    clearMocks: true
  }
})
