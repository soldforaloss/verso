import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('copy an annotation and paste it onto another page', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Place a text box on page 1, then copy it.
  await window.keyboard.press('t')
  await page1.click({ position: { x: 200, y: 200 } })
  await expect(page1.locator('textarea')).toHaveCount(1)
  await window.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await window.keyboard.press('Control+c')

  // Go to page 2 and paste — the clone lands on the page in view.
  await window.keyboard.press('PageDown')
  await expect(window.getByLabel('Page number')).toHaveValue('2', { timeout: 10_000 })
  await window.keyboard.press('Control+v')
  await expect(window.locator('[data-page-number="2"] textarea')).toHaveCount(1, {
    timeout: 10_000
  })
})
