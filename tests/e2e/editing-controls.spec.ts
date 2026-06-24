import { test, expect, type ElectronApplication } from '@playwright/test'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('text toolbar changes font family, weight, and style of an edited run', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  const run = window.locator('[data-page-number="1"] .textLayer span', {
    hasText: 'Verso sample page 1'
  })
  await expect(run).toBeVisible({ timeout: 20_000 })
  await window.getByTitle('Edit existing text (cover & replace)').click()
  const box = await run.boundingBox()
  expect(box).not.toBeNull()
  await window.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  const textarea = window.locator('textarea').first()
  await expect(textarea).toHaveValue(/Verso sample page 1/, { timeout: 10_000 })

  // The text-style controls appear for the selected text box.
  await expect(window.getByTitle('Serif font')).toBeVisible()

  // Family → serif.
  await window.getByTitle('Serif font').click()
  await expect(textarea).toHaveCSS('font-family', 'serif')

  // Bold + italic toggles.
  await window.getByTitle('Bold', { exact: true }).click()
  await expect(textarea).toHaveCSS('font-weight', '700')
  await window.getByTitle('Italic', { exact: true }).click()
  await expect(textarea).toHaveCSS('font-style', 'italic')
})
