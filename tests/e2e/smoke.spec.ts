import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('launches and proves the secure bridge end to end', async () => {
  app = await launchVerso()

  // Wait for the window to exist before inspecting it.
  const window = await app.firstWindow()
  // The empty state renders once the renderer has booted.
  await expect(window.getByText('A calm place to read and edit PDFs.')).toBeVisible({
    timeout: 30_000
  })

  // The hardened security flags must actually be in effect.
  const prefs = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const wp = win.webContents.getLastWebPreferences()
    return {
      contextIsolation: wp?.contextIsolation,
      nodeIntegration: wp?.nodeIntegration,
      sandbox: wp?.sandbox
    }
  })
  expect(prefs.contextIsolation).toBe(true)
  expect(prefs.nodeIntegration).toBe(false)
  expect(prefs.sandbox).toBe(true)

  // The renderer must NOT have Node access (sandbox + no nodeIntegration).
  const hasRequire = await window.evaluate(
    () => typeof (globalThis as { require?: unknown }).require
  )
  expect(hasRequire).toBe('undefined')

  // The only bridge is window.api.
  const hasApi = await window.evaluate(() => typeof window.api?.getAppInfo)
  expect(hasApi).toBe('function')
})
