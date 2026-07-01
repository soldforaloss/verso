// @vitest-environment node
import { describe, expect, it } from 'vitest'
import forge from 'node-forge'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { signPdf } from '../../src/main/pdfSign'

/** Builds a self-signed PKCS#12 (cert + private key) locked with `passphrase`. */
function makeSelfSignedP12(passphrase: string): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(2020, 0, 1)
  cert.validity.notAfter = new Date(2035, 0, 1)
  const attrs = [
    { name: 'commonName', value: 'Verso Test Signer' },
    { name: 'organizationName', value: 'Verso' }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' })
  const der = forge.asn1.toDer(asn1).getBytes()
  return Uint8Array.from(der, (c) => c.charCodeAt(0))
}

async function makeSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Please sign', { x: 50, y: 250, size: 24, font })
  return doc.save()
}

/** A PDF carrying a live AcroForm text field — exercises the flatten path. */
async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const field = doc.getForm().createTextField('applicant.name')
  field.setText('Ada Lovelace')
  field.addToPage(page, { x: 50, y: 200, width: 200, height: 20 })
  return doc.save()
}

describe('digital PDF signing', () => {
  it('embeds a valid PKCS#7 signature with a byte range', async () => {
    const p12 = makeSelfSignedP12('s3cret')
    const pdf = await makeSamplePdf()
    const signed = await signPdf(pdf, p12, 's3cret', { reason: 'I approve' })

    expect(signed.byteLength).toBeGreaterThan(pdf.byteLength)
    const text = Buffer.from(signed).toString('latin1')

    // A real signature dictionary: adbe.pkcs7.detached over a /ByteRange.
    expect(text).toContain('/SubFilter /adbe.pkcs7.detached')
    const byteRange = text.match(/\/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+/)
    expect(byteRange).not.toBeNull()

    // The /Contents hex holds a non-empty CMS blob (not just zero padding).
    const contents = text.match(/\/Contents\s*<([0-9A-Fa-f]+)>/)
    expect(contents).not.toBeNull()
    expect(/[1-9a-fA-F]/.test(contents![1]!)).toBe(true)

    // The reason metadata is carried in the signature dictionary.
    expect(text).toContain('I approve')

    // Still a structurally valid PDF.
    const reloaded = await PDFDocument.load(signed, { updateMetadata: false })
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('signs a form-filled PDF (flattening the live AcroForm first)', async () => {
    const p12 = makeSelfSignedP12('pw')
    const form = await makeFormPdf()
    // The flatten step runs inside signPdf; a live AcroForm reaching the
    // placeholder writer would otherwise risk a malformed signature. This must
    // produce a valid, reloadable signed PDF.
    const signed = await signPdf(form, p12, 'pw')

    const text = Buffer.from(signed).toString('latin1')
    expect(text).toContain('/SubFilter /adbe.pkcs7.detached')
    expect(text).toMatch(/\/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+/)
    const reloaded = await PDFDocument.load(signed, { updateMetadata: false })
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('rejects a wrong certificate passphrase', async () => {
    const p12 = makeSelfSignedP12('correct-horse')
    const pdf = await makeSamplePdf()
    await expect(signPdf(pdf, p12, 'wrong-passphrase')).rejects.toThrow()
  })

  it('embeds the signer certificate in the CMS blob', async () => {
    const p12 = makeSelfSignedP12('pw')
    const pdf = await makeSamplePdf()
    const signed = await signPdf(pdf, p12, 'pw')
    const text = Buffer.from(signed).toString('latin1')

    // Parse the /Contents CMS (PKCS#7 SignedData) and confirm it carries the
    // signer's certificate with the expected common name.
    const hex = text.match(/\/Contents\s*<([0-9A-Fa-f]+)>/)![1]!.replace(/(00)+$/, '')
    const der = Buffer.from(hex.length % 2 ? hex.slice(0, -1) : hex, 'hex')
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der.toString('binary')))
    const certs = (p7 as unknown as { certificates?: forge.pki.Certificate[] }).certificates ?? []
    expect(certs.length).toBeGreaterThan(0)
    expect(certs[0]!.subject.getField('CN')?.value).toBe('Verso Test Signer')
  })
})
