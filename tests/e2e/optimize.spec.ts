import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('reduce file size: qpdf optimize shrinks a bloated PDF (or graceful fallback)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  const status = await window.evaluate(() => window.api.getSecurityStatus())

  await window.getByTitle('Security & optimization').click()
  await expect(window.getByText('Security & optimization')).toBeVisible()

  if (!status.available) {
    await expect(window.getByText(/qpdf sidecar is not available/i)).toBeVisible()
    return
  }

  // The size-reduction section is present.
  await expect(window.getByText('Reduce file size')).toBeVisible()

  // Build a deliberately un-optimized PDF (classic xref, no object streams) and
  // run it straight through the real optimize IPC: it must shrink and stay valid.
  const seed = await PDFDocument.create()
  for (let i = 0; i < 30; i += 1) {
    const page = seed.addPage([612, 792])
    page.drawText(`Page ${i} ${'lorem ipsum dolor sit amet '.repeat(15)}`, {
      x: 40,
      y: 700,
      size: 8
    })
  }
  const seedBase64 = Buffer.from(await seed.save({ useObjectStreams: false })).toString('base64')

  const round = await window.evaluate(async (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const optimized = await window.api.transformPdf({ operation: 'optimize', bytes })
    return { before: bytes.length, after: optimized.length, out: Array.from(optimized) }
  }, seedBase64)

  expect(round.after).toBeLessThan(round.before)
  const reloaded = await PDFDocument.load(Uint8Array.from(round.out))
  expect(reloaded.getPageCount()).toBe(30)

  // The UI flow also produces a result (either a savings panel or "already optimized").
  await window.getByRole('button', { name: 'Calculate savings' }).click()
  await expect(window.getByText(/% smaller|already optimized/i).first()).toBeVisible({
    timeout: 20_000
  })
})
