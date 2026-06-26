import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('closing with unsaved changes prompts before quitting; Cancel keeps the app open', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Make an unsaved change: place a text box on the page.
  await window.keyboard.press('t')
  await page1.click({ position: { x: 200, y: 200 } })
  await expect(page1.locator('textarea')).toHaveCount(1)

  // A direct window close (the X / Alt+F4 path) must be intercepted with a prompt.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close())
  await expect(window.getByText('Discard unsaved changes?')).toBeVisible({ timeout: 10_000 })

  // Cancel keeps the document open and editable.
  await window.getByRole('button', { name: 'Cancel' }).click()
  await expect(window.getByText('Discard unsaved changes?')).toBeHidden()
  await expect(page1.locator('textarea')).toHaveCount(1)
})
