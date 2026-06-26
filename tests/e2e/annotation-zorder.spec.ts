import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('bring-to-front / send-to-back controls act on the selected annotation', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  const front = window.getByRole('button', { name: 'Bring to front (Ctrl+])' })
  const back = window.getByRole('button', { name: 'Send to back (Ctrl+[)' })

  // Disabled with nothing selected.
  await expect(front).toBeDisabled()

  // Place a text box (auto-selected) — the controls enable and act without error.
  await window.keyboard.press('t')
  await page1.click({ position: { x: 200, y: 200 } })
  await expect(page1.locator('textarea')).toHaveCount(1)
  await expect(front).toBeEnabled()
  await expect(back).toBeEnabled()
  await back.click()
  await expect(page1.locator('textarea')).toHaveCount(1)
})
