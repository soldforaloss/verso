import { defineConfig } from '@playwright/test'

/**
 * Electron end-to-end tests. These launch the *built* app (out/main/index.js),
 * so `npm run build` must run first (CI does this before `test:e2e`).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list'
})
