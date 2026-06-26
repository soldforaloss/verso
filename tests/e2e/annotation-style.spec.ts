import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('opacity slider and custom color picker are available and live', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Opacity defaults to 100% and updates as the slider moves.
  const opacity = window.getByLabel('Opacity')
  await expect(opacity).toBeVisible()
  await expect(opacity).toHaveValue('1')
  await opacity.fill('0.5')
  await expect(opacity).toHaveValue('0.5')

  // A custom color input sits alongside the presets.
  await expect(window.getByLabel('Custom color')).toBeAttached()
})
