import { test, expect, type ElectronApplication } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

test('qpdf security: encrypt/decrypt round-trip (or graceful fallback)', async () => {
  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.getByText('/ 8')).toBeVisible({ timeout: 30_000 })

  const status = await window.evaluate(() => window.api.getSecurityStatus())

  // Open the Security dialog and confirm the UI reflects qpdf availability.
  await window.getByTitle('Security & optimization').click()
  await expect(window.getByText('Security & optimization')).toBeVisible()

  if (!status.available) {
    // No sidecar in this environment: the dialog must say so, clearly.
    expect(status.version).toBeNull()
    await expect(window.getByText(/qpdf sidecar is not available/i)).toBeVisible()
    return
  }

  await expect(window.getByText(/Powered by the bundled qpdf/i)).toBeVisible()

  // A tiny PDF, encrypted then decrypted entirely through the real qpdf IPC.
  const seed = await PDFDocument.create()
  seed.addPage([200, 200])
  const seedBase64 = Buffer.from(await seed.save()).toString('base64')

  const round = await window.evaluate(async (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const encrypted = await window.api.transformPdf({
      operation: 'encrypt',
      bytes,
      userPassword: '',
      ownerPassword: 'verso-owner',
      permissions: { printing: true, modifying: false, copying: false, annotating: true }
    })
    const decrypted = await window.api.transformPdf({
      operation: 'decrypt',
      bytes: encrypted,
      password: 'verso-owner'
    })
    return { encrypted: Array.from(encrypted), decrypted: Array.from(decrypted) }
  }, seedBase64)

  // The encrypted output really is encrypted; decrypting removes it.
  const encrypted = await PDFDocument.load(Uint8Array.from(round.encrypted), {
    ignoreEncryption: true
  })
  expect(encrypted.isEncrypted).toBe(true)

  const decrypted = await PDFDocument.load(Uint8Array.from(round.decrypted))
  expect(decrypted.isEncrypted).toBe(false)
})
