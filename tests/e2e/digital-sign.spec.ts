import { test, expect, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import forge from 'node-forge'
import { FIXTURE_PDF, launchVerso } from './launch'

let app: ElectronApplication

test.afterEach(async () => {
  await app?.close()
})

/** Writes a self-signed PKCS#12 to disk and returns its path. */
function writeSelfSignedP12(dir: string, passphrase: string): string {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(2020, 0, 1)
  cert.validity.notAfter = new Date(2035, 0, 1)
  const attrs = [{ name: 'commonName', value: 'Verso E2E Signer' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const der = forge.asn1
    .toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase))
    .getBytes()
  const path = join(dir, 'signer.p12')
  writeFileSync(path, Buffer.from(der, 'binary'))
  return path
}

test('digitally signs the PDF with a certificate and writes a signed file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verso-sign-'))
  const certPath = writeSelfSignedP12(dir, 'e2e-pass')
  const outPath = join(dir, 'signed.pdf')

  app = await launchVerso([FIXTURE_PDF])
  const window = await app.firstWindow()
  await expect(window.locator('[data-page-number="1"] canvas')).toBeVisible({ timeout: 30_000 })

  // Stub the native certificate picker and the save dialog.
  await app.evaluate(
    ({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.certPath] })
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.outPath })
    },
    { certPath, outPath }
  )

  await window.getByTitle('Digitally sign (certificate)').click()
  await expect(window.getByText('Digitally sign')).toBeVisible()
  await window.getByPlaceholder('Unlocks your .p12 / .pfx').fill('e2e-pass')
  await window.getByRole('button', { name: 'Choose certificate & sign' }).click()

  await expect(window.getByText('Signed and saved.')).toBeVisible({ timeout: 20_000 })

  // The written file is a real digitally-signed PDF.
  const bytes = readFileSync(outPath)
  expect(bytes.length).toBeGreaterThan(0)
  const text = bytes.toString('latin1')
  expect(text).toContain('/SubFilter /adbe.pkcs7.detached')
  expect(text).toMatch(/\/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+/)
})
