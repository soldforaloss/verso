import forge from 'node-forge'
import type { SignatureInfo } from '@shared/ipc'

export type { SignatureInfo }

/**
 * Cryptographic verification of the digital signatures in a PDF, backed by
 * `node-forge` (BSD-3-Clause). For each signature it establishes:
 *
 *  - **structural soundness** — the `/ByteRange` covers the whole file with the
 *    *only* gap being the `/Contents <…>` placeholder (defends against the
 *    signature-wrapping and incremental-update forgeries, where content is
 *    hidden in an oversized gap or appended after the signed revision),
 *  - **integrity** — the signed bytes still hash to the `messageDigest` in the
 *    signature, and
 *  - **signature** — the CMS/PKCS#7 signature over the signed attributes
 *    verifies against the signer certificate's public key.
 *
 * A signature is only `valid` when all three hold. This does NOT establish trust
 * in the certificate (no trust-store / chain validation) — it proves the file is
 * intact and shows the certificate the file names as the signer, stated plainly
 * in the UI.
 */

const LT = 0x3c // '<'
const GT = 0x3e // '>'

/** Digest for an allow-listed OID; null (fail closed) for SHA-1/MD5/unknown. */
function mdFor(digestOid: string): forge.md.MessageDigest | null {
  if (digestOid === forge.pki.oids['sha256']) return forge.md.sha256.create()
  if (digestOid === forge.pki.oids['sha384']) return forge.md.sha384.create()
  if (digestOid === forge.pki.oids['sha512']) return forge.md.sha512.create()
  return null
}

/** Finds the value of an authenticated attribute by OID, or null. */
function findAttr(attrs: forge.asn1.Asn1[], oid: string): forge.asn1.Asn1 | null {
  for (const attr of attrs) {
    const seq = attr.value as forge.asn1.Asn1[]
    if (forge.asn1.derToOid(seq[0]!.value as string) === oid) {
      return (seq[1]!.value as forge.asn1.Asn1[])[0] ?? null
    }
  }
  return null
}

function parseSigningTime(attr: forge.asn1.Asn1 | null): string | null {
  if (!attr) return null
  try {
    const raw = attr.value as string
    const date =
      attr.type === forge.asn1.Type.GENERALIZEDTIME
        ? forge.asn1.generalizedTimeToDate(raw)
        : forge.asn1.utcTimeToDate(raw)
    return date.toISOString()
  } catch {
    return null
  }
}

/** All `/ByteRange [a b c d]` arrays in the raw PDF. */
function findByteRanges(text: string): [number, number, number, number][] {
  return [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)].map(
    (m) =>
      [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as [number, number, number, number]
  )
}

interface Parsed {
  authenticatedAttributes: forge.asn1.Asn1[]
  digestAlgorithm: string
  signature: string
}

/**
 * Verifies every digital signature in `bytes`. Returns [] when the file carries
 * no parseable signatures.
 */
export function verifyPdfSignatures(bytes: Uint8Array): SignatureInfo[] {
  const text = Buffer.from(bytes).toString('latin1')
  const results: SignatureInfo[] = []

  for (const [a, b, c, d] of findByteRanges(text)) {
    // The gap [b, c) must be exactly one `<…>` Contents placeholder for the
    // digest to describe the whole file. If it isn't, we can't trust the range —
    // still surface the signature (as invalid) rather than silently hide it.
    const holeIsContents = c > b + 1 && bytes[b] === LT && bytes[c - 1] === GT
    const coversWholeDocument = a === 0 && c + d === bytes.length
    const structurallySound = holeIsContents && coversWholeDocument && b > 0 && d > 0

    const hex = holeIsContents ? Buffer.from(bytes.subarray(b + 1, c - 1)).toString('latin1') : ''
    if (!hex) continue // not a signature placeholder — skip

    const info: SignatureInfo = {
      signerName: '',
      valid: false,
      integrityIntact: false,
      signatureValid: false,
      coversWholeDocument: structurallySound,
      signedAt: null,
      certValidFrom: null,
      certValidTo: null
    }

    try {
      const clean = hex.replace(/(00)+$/, '')
      const der = Buffer.from(clean.length % 2 ? clean.slice(0, -1) : clean, 'hex').toString(
        'binary'
      )
      const p7 = forge.pkcs7.messageFromAsn1(
        forge.asn1.fromDer(der)
      ) as forge.pkcs7.PkcsSignedData & {
        rawCapture: Parsed
      }

      const attrs = p7.rawCapture.authenticatedAttributes
      if (!Array.isArray(attrs) || attrs.length === 0) throw new Error('no signed attributes')
      const contentMd = mdFor(forge.asn1.derToOid(p7.rawCapture.digestAlgorithm))
      if (!contentMd) throw new Error('unsupported digest algorithm')

      // Signed attributes must include contentType == pkcs7-data (RFC 5652).
      const ctAttr = findAttr(attrs, forge.pki.oids['contentType']!)
      const contentTypeOk =
        !!ctAttr && forge.asn1.derToOid(ctAttr.value as string) === forge.pki.oids['data']

      // Integrity: digest of the signed byte range == the messageDigest attribute.
      const signedData = Buffer.concat([
        Buffer.from(bytes.subarray(a, a + b)),
        Buffer.from(bytes.subarray(c, c + d))
      ])
      contentMd.update(signedData.toString('binary'))
      const mdAttr = findAttr(attrs, forge.pki.oids['messageDigest']!)
      info.integrityIntact = !!mdAttr && contentMd.digest().getBytes() === (mdAttr.value as string)

      // Signature: verify over the DER SET of the signed attributes. The signer
      // is whichever embedded certificate's key actually verifies — not just
      // certificates[0], which the file can order arbitrarily.
      const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs)
      const attrMd = mdFor(forge.asn1.derToOid(p7.rawCapture.digestAlgorithm))!
      attrMd.update(forge.asn1.toDer(set).getBytes())
      const attrDigest = attrMd.digest().getBytes()

      let signerCert: forge.pki.Certificate | null = null
      for (const cert of p7.certificates) {
        try {
          if (
            (cert.publicKey as forge.pki.rsa.PublicKey).verify(attrDigest, p7.rawCapture.signature)
          ) {
            signerCert = cert
            break
          }
        } catch {
          /* wrong key type / bad key — try the next certificate */
        }
      }
      info.signatureValid = !!signerCert

      if (signerCert) {
        info.signerName =
          (signerCert.subject.getField('CN') as { value?: string } | null)?.value ?? ''
        info.certValidFrom = signerCert.validity.notBefore.toISOString()
        info.certValidTo = signerCert.validity.notAfter.toISOString()
      }

      info.signedAt = parseSigningTime(findAttr(attrs, forge.pki.oids['signingTime']!))
      info.valid = structurallySound && contentTypeOk && info.integrityIntact && info.signatureValid
    } catch {
      // Malformed signature — leave every flag false.
    }
    results.push(info)
  }
  return results
}
