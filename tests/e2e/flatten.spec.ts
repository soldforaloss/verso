import { test, expect, type ElectronApplication } from '@playwright/test'
import { join } from 'node:path'
import { launchVerso } from './launch'

const FORM_PDF = join(__dirname, '../fixtures/form.pdf')

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('flattens a filled form: fields become static, baked values stay as text', async () => {
  app = await launchVerso([FORM_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Fill a text field, then confirm the form-only "Flatten" action is offered.
  await window.getByLabel('full_name').fill('Jane Verso')
  await window.getByTitle('Flatten form fields').click()
  await expect(window.getByText('Bakes the current field values')).toBeVisible()
  await window.getByRole('button', { name: 'Flatten', exact: true }).click()

  // The interactive field is gone…
  await expect(window.getByLabel('full_name')).toHaveCount(0, { timeout: 30_000 })
  // …and its value survives as selectable, baked-in page text.
  await expect(window.locator('[data-page-number="1"] .textLayer')).toContainText('Jane Verso', {
    timeout: 30_000
  })
})
