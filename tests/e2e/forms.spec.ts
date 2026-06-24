import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { launchVerso } from './launch'

const FORM_PDF = join(__dirname, '../fixtures/form.pdf')

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('fills an AcroForm and saves values that reopen intact', async () => {
  app = await launchVerso([FORM_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Fill every field type (click, not check(), to suit controlled inputs).
  await window.getByLabel('full_name').fill('Jane Verso')
  await window.getByLabel('agree').click()
  await window.getByLabel('color=0').click() // first radio option (Red)
  await window.getByLabel('country').selectOption('Canada')

  // Save As (stubbed dialog).
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-form-')), 'filled.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, outPath)
  await window.keyboard.press('Control+Shift+S')

  await expect
    .poll(
      () => {
        try {
          return readFileSync(outPath).length
        } catch {
          return 0
        }
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)

  // The saved form is still editable (pristine path) and carries the values.
  const saved = await PDFDocument.load(readFileSync(outPath))
  const form = saved.getForm()
  expect(form.getTextField('full_name').getText()).toBe('Jane Verso')
  expect(form.getCheckBox('agree').isChecked()).toBe(true)
  expect(form.getRadioGroup('color').getSelected()).toBe('Red')
  expect(form.getDropdown('country').getSelected()).toContain('Canada')
})
