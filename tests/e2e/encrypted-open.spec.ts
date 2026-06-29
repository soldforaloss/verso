import { test, expect, type ElectronApplication } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { launchVerso } from './launch'

const QPDF = join(
  process.cwd(),
  'resources',
  'bin',
  process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'
)

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

// Skip gracefully where the qpdf sidecar isn't present (CI fetches it best-effort).
test.skip(!existsSync(QPDF), 'qpdf sidecar not available')

test('opens an owner-encrypted PDF, renders it, and saves an editable copy', async () => {
  // Build a plain 3-page PDF, then encrypt it (owner password, EMPTY user
  // password) so it opens without a prompt but is encrypted on disk — the case
  // that pdf.js renders but pdf-lib (the save path) cannot parse.
  const dir = mkdtempSync(join(tmpdir(), 'verso-enc-open-'))
  const plain = join(dir, 'plain.pdf')
  const enc = join(dir, 'enc.pdf')
  const out = join(dir, 'out.pdf')

  const doc = await PDFDocument.create()
  for (let i = 0; i < 3; i += 1) doc.addPage([612, 792])
  writeFileSync(plain, await doc.save())
  execFileSync(QPDF, ['--encrypt', '', 'ownerpw', '256', '--print=none', '--', plain, enc])

  // Sanity: the on-disk file really is encrypted (pdf-lib refuses to load it).
  let pdfLibRejectsEncrypted = false
  try {
    await PDFDocument.load(readFileSync(enc))
  } catch {
    pdfLibRejectsEncrypted = true
  }
  expect(pdfLibRejectsEncrypted, 'fixture should be encrypted').toBe(true)

  // Open it in Verso: decrypt-on-open lets it render at all.
  app = await launchVerso([enc])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Save As writes a valid, now-decrypted PDF that pdf-lib loads with all pages.
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, out)
  await window.keyboard.press('Control+Shift+S')
  await expect
    .poll(
      () => {
        try {
          return readFileSync(out).length
        } catch {
          return 0
        }
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)

  const saved = await PDFDocument.load(readFileSync(out))
  expect(saved.getPageCount()).toBe(3)
})
