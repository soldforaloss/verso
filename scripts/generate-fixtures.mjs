/**
 * Generates the deterministic test fixtures used by the unit/e2e suites.
 * Run with: `npm run fixtures`
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(here, '../tests/fixtures')

async function makeSamplePdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pageCount = 8

  for (let page = 1; page <= pageCount; page += 1) {
    const p = doc.addPage([612, 792]) // US Letter
    p.drawText(`Verso sample page ${page}`, {
      x: 72,
      y: 700,
      size: 24,
      font,
      color: rgb(0.1, 0.1, 0.12)
    })
    p.drawText(`Selectable text for search and copy tests. Page ${page} of ${pageCount}.`, {
      x: 72,
      y: 660,
      size: 12,
      font,
      color: rgb(0.25, 0.25, 0.3)
    })
  }

  doc.setTitle('Verso Sample')
  doc.setAuthor('Verso')
  const bytes = await doc.save()
  await writeFile(resolve(fixturesDir, 'sample.pdf'), bytes)
  console.log(`wrote tests/fixtures/sample.pdf (${pageCount} pages, ${bytes.length} bytes)`)
}

async function makeFormPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const form = doc.getForm()
  const page = doc.addPage([612, 792])

  page.drawText('Verso Form Fixture', { x: 72, y: 740, size: 18, font })

  const fullName = form.createTextField('full_name')
  fullName.addToPage(page, { x: 72, y: 690, width: 300, height: 22 })

  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 72, y: 650, width: 16, height: 16 })
  page.drawText('I agree', { x: 96, y: 651, size: 12, font })

  const color = form.createRadioGroup('color')
  color.addOptionToPage('Red', page, { x: 72, y: 610, width: 16, height: 16 })
  color.addOptionToPage('Blue', page, { x: 172, y: 610, width: 16, height: 16 })
  page.drawText('Red', { x: 96, y: 611, size: 12, font })
  page.drawText('Blue', { x: 196, y: 611, size: 12, font })

  const country = form.createDropdown('country')
  country.addOptions(['USA', 'Canada', 'Mexico'])
  country.addToPage(page, { x: 72, y: 560, width: 200, height: 22 })

  doc.setTitle('Verso Form')
  const bytes = await doc.save()
  await writeFile(resolve(fixturesDir, 'form.pdf'), bytes)
  console.log(`wrote tests/fixtures/form.pdf (${bytes.length} bytes)`)
}

await mkdir(fixturesDir, { recursive: true })
await makeSamplePdf()
await makeFormPdf()
