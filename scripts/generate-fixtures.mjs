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

await mkdir(fixturesDir, { recursive: true })
await makeSamplePdf()
