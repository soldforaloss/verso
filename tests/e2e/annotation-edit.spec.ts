import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('nudge with arrows and duplicate with Ctrl+D', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Place a text box: pick the text tool (T), then click on the page.
  await window.keyboard.press('t')
  await page1.click({ position: { x: 220, y: 240 } })
  const boxes = page1.locator('textarea')
  await expect(boxes).toHaveCount(1)

  // Keep focus off the new textbox so arrow keys nudge instead of editing text.
  await window.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const before = await boxes.first().boundingBox()
  await window.keyboard.press('Shift+ArrowRight')
  await window.keyboard.press('Shift+ArrowRight')
  const after = await boxes.first().boundingBox()
  expect(after?.x ?? 0).toBeGreaterThan((before?.x ?? 0) + 3)

  // Ctrl+D duplicates the selected annotation.
  await window.keyboard.press('Control+d')
  await expect(boxes).toHaveCount(2)
})
