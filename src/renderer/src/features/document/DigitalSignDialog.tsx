import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { buildDocumentPdf } from '@/lib/save'
import type { DocumentTab } from '@/store/documentStore'

function signedName(name: string): string {
  const base = name.replace(/\.pdf$/i, '')
  return `${base}-signed.pdf`
}

/** Turns a signing error into an actionable message (not always "bad passphrase"). */
function signErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/password|mac could not|invalid pass|pkcs.?12|p12/i.test(message)) {
    return 'The certificate passphrase looks wrong. Please check it and try again.'
  }
  if (/encrypted/i.test(message)) {
    return 'This PDF is encrypted. Remove its password (Security tools) before signing.'
  }
  if (/placeholder length|exceeds/i.test(message)) {
    return 'This certificate chain is too large to embed. Try a certificate without the full chain.'
  }
  return 'Signing failed. Please check the certificate and passphrase, then try again.'
}

/**
 * Digitally signs the document with a PKI certificate. The user picks the
 * `.p12`/`.pfx` in a native dialog (its private key never leaves the main
 * process); the signed PDF is written straight to disk — re-opening it in the
 * editor and re-saving would rebuild the file and break the signature.
 */
export function DigitalSignDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [passphrase, setPassphrase] = useState('')
  const [reason, setReason] = useState('I approve this document')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setSavedPath(null)
      setBusy(false)
    }
  }, [open])

  const sign = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setSavedPath(null)

    // Step 1 — build + sign (the passphrase / certificate step).
    let signed: Uint8Array<ArrayBuffer> | null
    try {
      const bytes = await buildDocumentPdf(tab)
      signed = await window.api.signPdf({ bytes, passphrase, reason, name, location })
    } catch (error) {
      setError(signErrorMessage(error))
      setBusy(false)
      return
    }
    if (!signed) {
      setBusy(false) // certificate picker cancelled
      return
    }

    // Step 2 — save. Signing already succeeded, so a failure here is about the
    // file, not the certificate — report it accurately.
    try {
      const path = await window.api.showSaveDialog({ defaultName: signedName(tab.name) })
      if (!path) return
      await window.api.writeFile({ path, bytes: signed })
      setSavedPath(path)
    } catch {
      setError('The document was signed, but saving the file failed. Try a different location.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Digitally sign</DialogTitle>
          <DialogDescription>
            Sign this PDF with your certificate (.p12 / .pfx). You’ll pick the certificate file
            next; the signed copy is saved to a new file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Certificate passphrase</span>
            <Input
              type="password"
              autoFocus
              value={passphrase}
              placeholder="Unlocks your .p12 / .pfx"
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Reason</span>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Name</span>
              <Input
                value={name}
                placeholder="Optional"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Location</span>
              <Input
                value={location}
                placeholder="Optional"
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {savedPath && (
            <p className="text-sm text-green-600 dark:text-green-500">Signed and saved.</p>
          )}
        </div>

        <DialogFooter>
          {savedPath ? (
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={() => void sign()} disabled={busy || passphrase.length === 0}>
                {busy ? 'Signing…' : 'Choose certificate & sign'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
