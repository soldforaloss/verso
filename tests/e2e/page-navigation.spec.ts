import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('Home/End/PageUp/PageDown navigate pages', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 20_000 })

  const pageInput = window.getByLabel('Page number')
  await expect(pageInput).toHaveValue('1')

  // End jumps to the last page; Home returns to the first.
  await window.keyboard.press('End')
  await expect(pageInput).toHaveValue('8', { timeout: 10_000 })

  await window.keyboard.press('Home')
  await expect(pageInput).toHaveValue('1', { timeout: 10_000 })

  // PageDown / PageUp step one page at a time.
  await window.keyboard.press('PageDown')
  await expect(pageInput).toHaveValue('2', { timeout: 10_000 })
  await window.keyboard.press('PageDown')
  await expect(pageInput).toHaveValue('3', { timeout: 10_000 })
  await window.keyboard.press('PageUp')
  await expect(pageInput).toHaveValue('2', { timeout: 10_000 })
})
