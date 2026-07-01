import { PDFDocument } from 'pdf-lib'
import { plainAddPlaceholder } from '@signpdf/placeholder-plain'
import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'

/**
 * Cryptographic (PKI) PDF signing, backed by `@signpdf` (MIT) + `node-forge`
 * (BSD-3-Clause). Produces a real digital signature — a PKCS#7 (CMS) blob over
 * the document's byte range, embedded in a `/Sig` dictionary — that PDF readers
 * (Acrobat, etc.) validate against the signer's certificate.
 *
 * This runs in the **main** process so the private key (a PKCS#12 `.p12`/`.pfx`)
 * never enters the untrusted renderer. The signed bytes must be written to disk
 * verbatim — re-saving through the editor's rebuild pipeline would recompute the
 * byte offsets and invalidate the signature.
 */

/** Human-readable signature metadata embedded in the `/Sig` dictionary. */
export interface SignOptions {
  reason?: string | undefined
  name?: string | undefined
  location?: string | undefined
  contactInfo?: string | undefined
}

// Signing is synchronous CPU work on the main event loop (pdf-lib + node-forge),
// so cap the input well below the general 512 MB limit to avoid a long UI freeze.
const MAX_PDF_BYTES = 100 * 1024 * 1024
const MAX_P12_BYTES = 8 * 1024 * 1024
// Reserve space in the placeholder for the CMS blob. The default (4 KB) is too
// small once a certificate bundles an intermediate/root chain or uses RSA-4096.
const SIGNATURE_LENGTH = 24 * 1024

const signer = new SignPdf()

/**
 * Signs `bytes` with the PKCS#12 certificate `p12` (unlocked by `passphrase`)
 * and returns the signed PDF. Throws on a wrong passphrase, an unparseable
 * certificate, or a malformed PDF.
 */
export async function signPdf(
  bytes: Uint8Array,
  p12: Uint8Array,
  passphrase: string,
  options: SignOptions = {}
): Promise<Uint8Array<ArrayBuffer>> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('PDF exceeds the size limit')
  if (p12.byteLength > MAX_P12_BYTES) throw new Error('Certificate exceeds the size limit')

  // The plain placeholder writer needs a classic cross-reference table, so
  // normalize object/xref streams away by re-saving through pdf-lib. This also
  // flattens any incremental updates into a clean base revision to sign over.
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  // Flatten any interactive form: a signed document should not carry mutable
  // fields, and it keeps a live AcroForm from confusing the placeholder writer.
  try {
    doc.getForm().flatten()
  } catch {
    /* no form, or a form that can't be flattened — sign as-is */
  }
  const normalized = Buffer.from(await doc.save({ useObjectStreams: false }))

  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer: normalized,
    reason: options.reason || 'Signed with Verso',
    contactInfo: options.contactInfo || '',
    name: options.name || '',
    location: options.location || '',
    signatureLength: SIGNATURE_LENGTH
  })

  const p12Signer = new P12Signer(Buffer.from(p12), { passphrase })
  const signed = await signer.sign(withPlaceholder, p12Signer)

  const out = new Uint8Array(new ArrayBuffer(signed.length))
  out.set(signed)
  return out
}
