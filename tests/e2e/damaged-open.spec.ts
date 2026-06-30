import { test, expect, type ElectronApplication } from '@playwright/test'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
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

// Recovery uses the qpdf sidecar; skip where it isn't available (CI fetches it).
test.skip(!existsSync(QPDF), 'qpdf sidecar not available')

test('recovers a damaged PDF (junk before %PDF, broken xref) on open', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verso-damaged-'))
  const damaged = join(dir, 'damaged.pdf')

  // A valid 2-page PDF with ~2.6KB of junk prepended — enough to break the
  // header/xref so the primary loader fails and the qpdf repair path kicks in.
  const doc = await PDFDocument.create()
  doc.addPage([612, 792])
  doc.addPage([612, 792])
  const valid = await doc.save()
  writeFileSync(damaged, Buffer.concat([Buffer.from('%GARBAGE leading junk '.repeat(120)), valid]))

  app = await launchVerso([damaged])
  const window = await app.firstWindow()

  // Recovered: the page renders (not stuck on an error state).
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })
  await expect(window.getByText('/ 2')).toBeVisible({ timeout: 10_000 })
})
