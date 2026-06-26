import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('reports page 1 on open and tracks the page as you scroll', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()

  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 20_000 })

  // On open the indicator must read page 1 — it used to drift to 2 because the
  // virtualization observer's inflated ratio decided the current page.
  const pageInput = window.getByLabel('Page number')
  await expect(pageInput).toHaveValue('1')

  // Scrolling several viewport-heights down advances the tracked page.
  const scroller = window.locator('[data-testid="viewer-scroll"]')
  await scroller.evaluate((element) => element.scrollBy(0, element.clientHeight * 4))
  await expect(pageInput).not.toHaveValue('1', { timeout: 10_000 })

  // Scrolling back to the top returns to page 1.
  await scroller.evaluate((element) => element.scrollTo(0, 0))
  await expect(pageInput).toHaveValue('1', { timeout: 10_000 })
})
