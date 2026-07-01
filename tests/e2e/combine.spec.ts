import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

async function writePdf(path: string, pages: number): Promise<void> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i += 1) doc.addPage([300, 400])
  writeFileSync(path, await doc.save())
}

test('combines several PDFs into one new document', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verso-combine-'))
  const a = join(dir, 'two.pdf')
  const b = join(dir, 'three.pdf')
  await writePdf(a, 2)
  await writePdf(b, 3)

  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Combine files (merge PDFs)').click()
  await expect(window.getByText('Combine files')).toBeVisible()

  // Add the first PDF (stub the picker to return it), then the second.
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, a)
  await window.getByRole('button', { name: 'Add PDF' }).click()
  await expect(window.getByText('two.pdf')).toBeVisible()

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, b)
  await window.getByRole('button', { name: 'Add PDF' }).click()
  await expect(window.getByText('three.pdf')).toBeVisible()

  // Merge → a new 5-page document opens in its own tab.
  await window.getByRole('button', { name: /^Combine/ }).click()
  await expect(window.getByText('/ 5')).toBeVisible({ timeout: 20_000 })
})
