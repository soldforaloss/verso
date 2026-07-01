import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { getSource, type DocumentTab } from '@/store/documentStore'
import type { SignatureInfo } from '@shared/ipc'

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

function certExpired(sig: SignatureInfo): boolean {
  if (!sig.certValidTo) return false
  const to = new Date(sig.certValidTo)
  return !Number.isNaN(to.getTime()) && to.getTime() < Date.now()
}

function SignatureRow({ sig, index }: { sig: SignatureInfo; index: number }): React.JSX.Element {
  const signer = sig.signerName || 'Unknown signer'
  const signedAt = formatDate(sig.signedAt)
  const validTo = formatDate(sig.certValidTo)
  const expired = certExpired(sig)

  return (
    <div className="flex gap-3 rounded-md border p-3">
      <div className="mt-0.5">
        {sig.valid ? (
          <ShieldCheck className="size-5 text-green-600 dark:text-green-500" />
        ) : (
          <ShieldAlert className="size-5 text-destructive" />
        )}
      </div>
      <div className="grid gap-0.5 text-sm">
        <p className="font-medium">
          {sig.valid ? 'Valid signature' : 'Invalid signature'}
          <span className="text-muted-foreground"> · Signature {index + 1}</span>
        </p>
        <p>
          Signed by <span className="font-medium">{signer}</span>
          {signedAt ? ` on ${signedAt}` : ''}
        </p>
        {!sig.integrityIntact && (
          <p className="text-destructive">The document was altered after it was signed.</p>
        )}
        {sig.integrityIntact && !sig.coversWholeDocument && (
          <p className="text-destructive">
            Content was added after this signature — it does not cover the whole document.
          </p>
        )}
        {sig.integrityIntact && sig.coversWholeDocument && !sig.signatureValid && (
          <p className="text-destructive">The signature could not be verified.</p>
        )}
        {sig.valid && <p className="text-muted-foreground">Covers the entire document.</p>}
        {validTo && (
          <p
            className={
              expired
                ? 'text-xs text-amber-600 dark:text-amber-500'
                : 'text-xs text-muted-foreground'
            }
          >
            {expired ? `Certificate expired on ${validTo}` : `Certificate valid until ${validTo}`}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Shows the verification status of the document's digital signatures. It checks
 * the **original** file bytes (not a rebuilt copy) and only for a single-source
 * document — signatures cannot be verified against a document assembled from
 * several files in the app. Integrity + coverage are proven cryptographically;
 * the certificate is not checked against a trust store, which the footer states.
 */
export function SignaturePanel({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [sigs, setSigs] = useState<SignatureInfo[] | null>(null)
  const multiSource = tab.sourceIds.length > 1

  useEffect(() => {
    if (!open) return
    if (multiSource) {
      setSigs([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setSigs(null)
    const source = getSource(tab.sourceIds[0] ?? '')
    if (!source) {
      setSigs([])
      setLoading(false)
      return
    }
    window.api
      .verifySignatures({ bytes: source.bytes as Uint8Array<ArrayBuffer> })
      .then((result) => {
        if (!cancelled) setSigs(result)
      })
      .catch(() => {
        if (!cancelled) setSigs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, tab.sourceIds, multiSource])

  const count = sigs?.length ?? 0
  const anyInvalid = (sigs ?? []).some((s) => !s.valid)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Digital signatures</DialogTitle>
          <DialogDescription>
            {multiSource
              ? 'This document combines several files.'
              : loading
                ? 'Verifying…'
                : count === 0
                  ? 'This document is not digitally signed.'
                  : anyInvalid
                    ? 'One or more signatures are not valid.'
                    : 'All signatures are cryptographically valid.'}
          </DialogDescription>
        </DialogHeader>

        {multiSource ? (
          <div className="flex items-center gap-3 rounded-md border p-3 text-sm text-muted-foreground">
            <ShieldQuestion className="size-5" />
            <span>Signatures can only be verified on an original, unmodified signed file.</span>
          </div>
        ) : (
          <>
            {!loading && count > 0 && (
              <div className="grid gap-2">
                {sigs!.map((sig, index) => (
                  <SignatureRow key={index} sig={sig} index={index} />
                ))}
              </div>
            )}

            {!loading && count === 0 && (
              <div className="flex items-center gap-3 rounded-md border p-3 text-sm text-muted-foreground">
                <ShieldQuestion className="size-5" />
                <span>Add one with the “Digitally sign” tool.</span>
              </div>
            )}

            {!loading && count > 0 && (
              <p className="text-xs text-muted-foreground">
                {tab.dirty ? 'This reflects the signed file on disk, not your unsaved edits. ' : ''}
                Integrity is verified cryptographically. The signer name is read from the
                certificate, which is not checked against a trusted-authority list.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
