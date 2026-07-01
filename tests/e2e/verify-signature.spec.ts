import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import forge from 'node-forge'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { signPdf } from '../../src/main/pdfSign'
import { launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

function makeSelfSignedP12(passphrase: string, cn: string): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(2020, 0, 1)
  cert.validity.notAfter = new Date(2035, 0, 1)
  const attrs = [{ name: 'commonName', value: cn }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const der = forge.asn1
    .toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase))
    .getBytes()
  return Uint8Array.from(der, (ch) => ch.charCodeAt(0))
}

test('verifies a digitally-signed PDF and shows the signer as valid', async () => {
  // Build + sign a fixture with a self-signed certificate.
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Signed contract', { x: 40, y: 240, size: 20, font })
  const p12 = makeSelfSignedP12('pw', 'Katherine Johnson')
  const signed = await signPdf(await doc.save(), p12, 'pw', { reason: 'Approved' })

  const dir = mkdtempSync(join(tmpdir(), 'verso-verify-'))
  const signedPath = join(dir, 'signed.pdf')
  writeFileSync(signedPath, signed)

  app = await launchVerso([signedPath])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  await window.getByTitle('Verify digital signatures').click()
  await expect(window.getByText('Digital signatures')).toBeVisible()
  await expect(window.getByText('Valid signature')).toBeVisible({ timeout: 15_000 })
  await expect(window.getByText(/Katherine Johnson/)).toBeVisible()
  await expect(window.getByText(/Covers the entire document/)).toBeVisible()
})
