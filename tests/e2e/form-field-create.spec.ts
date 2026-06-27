import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, PDFDropdown, PDFRadioGroup, PDFTextField } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('author a text field by dragging and write it into the PDF on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Pick the form text-field tool and drag a rectangle on the page.
  await window.getByTitle('Add text field (form)').click()
  const box = await page1.boundingBox()
  if (!box) throw new Error('page has no bounding box')
  await window.mouse.move(box.x + 90, box.y + 120)
  await window.mouse.down()
  await window.mouse.move(box.x + 280, box.y + 168, { steps: 6 })
  await window.mouse.up()

  // A field preview appears; rename it to a meaningful field name.
  await expect(page1.getByText(/^▭ Text_/)).toBeVisible({ timeout: 10_000 })
  await window.mouse.dblclick(box.x + 185, box.y + 144)
  const nameInput = window.getByLabel('Field name')
  await nameInput.fill('email')
  await nameInput.press('Enter')
  await expect(page1.getByText('▭ email')).toBeVisible()

  // Save and verify the saved PDF's AcroForm has the named text field.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-field-')), 'out.pdf')
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

  const doc = await PDFDocument.load(readFileSync(outPath))
  const fields = doc.getForm().getFields()
  expect(fields.some((field) => field instanceof PDFTextField && field.getName() === 'email')).toBe(
    true
  )
})

test('author a dropdown with custom options and write it into the PDF on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Pick the dropdown tool and drag a rectangle on the page.
  await window.getByTitle('Add dropdown field (form)').click()
  const box = await page1.boundingBox()
  if (!box) throw new Error('page has no bounding box')
  await window.mouse.move(box.x + 90, box.y + 220)
  await window.mouse.down()
  await window.mouse.move(box.x + 280, box.y + 248, { steps: 6 })
  await window.mouse.up()

  // A choice-field preview appears, seeded with the 3 default options.
  await expect(page1.getByText(/^▼ Dropdown_.* \(3\)$/)).toBeVisible({ timeout: 10_000 })

  // Edit the name and replace the options.
  await window.mouse.dblclick(box.x + 185, box.y + 234)
  await window.getByLabel('Field name').fill('country')
  const optionsInput = window.getByLabel('Field options')
  await optionsInput.fill('USA, Canada, Mexico')
  await optionsInput.press('Enter')
  await expect(page1.getByText('▼ country (3)')).toBeVisible()

  // Save and verify the saved PDF has the dropdown with the chosen options.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-dropdown-')), 'out.pdf')
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

  const doc = await PDFDocument.load(readFileSync(outPath))
  const dropdown = doc
    .getForm()
    .getFields()
    .find((field) => field.getName() === 'country')
  expect(dropdown).toBeInstanceOf(PDFDropdown)
  expect((dropdown as PDFDropdown).getOptions()).toEqual(['USA', 'Canada', 'Mexico'])
})

test('author a radio group and write its buttons into the PDF on save', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  const page1 = window.locator('[data-page-number="1"]')
  await expect(page1.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Pick the radio tool and drag a tall rectangle (a column of buttons).
  await window.getByTitle('Add radio group field (form)').click()
  const box = await page1.boundingBox()
  if (!box) throw new Error('page has no bounding box')
  await window.mouse.move(box.x + 90, box.y + 300)
  await window.mouse.down()
  await window.mouse.move(box.x + 130, box.y + 390, { steps: 6 })
  await window.mouse.up()

  // A radio-group preview appears, seeded with the 3 default options.
  await expect(page1.getByText(/^◉ Radio_.* \(3\)$/)).toBeVisible({ timeout: 10_000 })

  // Edit the name and replace the export values with two buttons.
  await window.mouse.dblclick(box.x + 110, box.y + 345)
  await window.getByLabel('Field name').fill('subscribe')
  const optionsInput = window.getByLabel('Field options')
  await optionsInput.fill('Yes, No')
  await optionsInput.press('Enter')
  await expect(page1.getByText('◉ subscribe (2)')).toBeVisible()

  // Save and verify the saved PDF has the radio group with both options.
  const outPath = join(mkdtempSync(join(tmpdir(), 'verso-radio-')), 'out.pdf')
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

  const doc = await PDFDocument.load(readFileSync(outPath))
  const radio = doc
    .getForm()
    .getFields()
    .find((field) => field.getName() === 'subscribe')
  expect(radio).toBeInstanceOf(PDFRadioGroup)
  expect((radio as PDFRadioGroup).getOptions()).toEqual(['Yes', 'No'])
})
