import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('exposes landmark roles and a focusable, named page view', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Landmarks: main document area, open-documents tablist, navigation sidebar.
  await expect(window.getByRole('main', { name: 'Document' })).toBeVisible()
  await expect(window.getByRole('tablist', { name: 'Open documents' })).toBeVisible()
  await expect(window.getByRole('complementary', { name: 'Document navigation' })).toBeVisible()

  // The scrollable page view is a named region and keyboard-focusable.
  const pageView = window.getByRole('region', { name: /Page view/ })
  await expect(pageView).toBeVisible()
  await pageView.focus()
  await expect(pageView).toBeFocused()
})
