// @vitest-environment node
import { describe, expect, it } from 'vitest'
import forge from 'node-forge'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { signPdf } from '../../src/main/pdfSign'
import { verifyPdfSignatures } from '../../src/main/pdfVerify'

function makeSelfSignedP12(passphrase: string, cn = 'Verso Test Signer'): Uint8Array {
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

async function makeSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Agreement', { x: 50, y: 250, size: 24, font })
  return doc.save()
}

describe('verifyPdfSignatures', () => {
  it('reports a genuine signature as valid, intact, and whole-document', async () => {
    const p12 = makeSelfSignedP12('pw', 'Grace Hopper')
    const signed = await signPdf(await makeSamplePdf(), p12, 'pw', { reason: 'Approved' })

    const sigs = verifyPdfSignatures(signed)
    expect(sigs).toHaveLength(1)
    const sig = sigs[0]!
    expect(sig.signerName).toBe('Grace Hopper')
    expect(sig.signatureValid).toBe(true)
    expect(sig.integrityIntact).toBe(true)
    expect(sig.valid).toBe(true)
    expect(sig.coversWholeDocument).toBe(true)
    expect(sig.certValidTo).toMatch(/^2035-/)
  })

  it('detects tampering: a modified byte breaks integrity (not signature)', async () => {
    const p12 = makeSelfSignedP12('pw')
    const signed = await signPdf(await makeSamplePdf(), p12, 'pw')

    // Flip an early content byte (well before the signature dictionary) so the
    // ByteRange/Contents still parse but the signed content no longer matches.
    const tampered = new Uint8Array(signed)
    tampered[20] ^= 0xff

    const sig = verifyPdfSignatures(tampered)[0]!
    expect(sig.integrityIntact).toBe(false)
    expect(sig.valid).toBe(false)
    // The CMS signature over the (unchanged) signed attributes is still valid —
    // it's the integrity check that catches the content change.
    expect(sig.signatureValid).toBe(true)
  })

  it('rejects an incremental-update forgery: content appended after signing', async () => {
    // Classic attack — the original signed bytes still hash + verify, but a new
    // revision is appended after the signed ByteRange. It must NOT read valid.
    const p12 = makeSelfSignedP12('pw')
    const signed = await signPdf(await makeSamplePdf(), p12, 'pw')
    const appended = new Uint8Array(signed.byteLength + 32)
    appended.set(signed)
    appended.set(new TextEncoder().encode('\n% injected trailing revision\n'), signed.byteLength)

    const sig = verifyPdfSignatures(appended)[0]!
    expect(sig.integrityIntact).toBe(true) // the signed span is untouched…
    expect(sig.signatureValid).toBe(true) // …and the CMS still verifies…
    expect(sig.coversWholeDocument).toBe(false) // …but it no longer covers the file…
    expect(sig.valid).toBe(false) // …so the verdict is invalid.
  })

  it('returns no signatures for an unsigned PDF', async () => {
    expect(verifyPdfSignatures(await makeSamplePdf())).toEqual([])
  })

  it('flags a garbled signature blob as invalid rather than throwing', async () => {
    const p12 = makeSelfSignedP12('pw')
    const signed = await signPdf(await makeSamplePdf(), p12, 'pw')
    // Corrupt inside the /Contents hex so the CMS fails to parse.
    const text = Buffer.from(signed).toString('latin1')
    const idx = text.indexOf('/Contents <') + '/Contents <'.length + 20
    const broken = new Uint8Array(signed)
    broken[idx] = '7'.charCodeAt(0) === broken[idx] ? '8'.charCodeAt(0) : '7'.charCodeAt(0)
    const sig = verifyPdfSignatures(broken)[0]!
    expect(sig.valid).toBe(false)
  })
})
