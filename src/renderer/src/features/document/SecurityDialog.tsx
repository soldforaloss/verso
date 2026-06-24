import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { decryptDocument, encryptDocument, linearizeDocument, repairDocument } from '@/lib/security'
import type { DocumentTab } from '@/store/documentStore'
import type { PdfPermissions, SecurityStatus } from '@shared/ipc'

const PERMISSIONS: { key: keyof PdfPermissions; label: string }[] = [
  { key: 'printing', label: 'Allow printing' },
  { key: 'copying', label: 'Allow copying text' },
  { key: 'modifying', label: 'Allow editing' },
  { key: 'annotating', label: 'Allow annotating' }
]

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function SecurityDialog({
  tab,
  open,
  onOpenChange
}: {
  tab: DocumentTab
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [status, setStatus] = useState<SecurityStatus | null>(null)
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [removePassword, setRemovePassword] = useState('')
  const [permissions, setPermissions] = useState<PdfPermissions>({
    printing: true,
    copying: true,
    modifying: false,
    annotating: true
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    let cancelled = false
    void window.api.getSecurityStatus().then((result) => {
      if (!cancelled) setStatus(result)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const guard = async (action: () => Promise<boolean>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const saved = await action()
      if (saved) onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The operation failed.')
    } finally {
      setBusy(false)
    }
  }

  const available = status?.available === true

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {available ? (
              <ShieldCheck className="size-5 text-primary" />
            ) : (
              <ShieldAlert className="size-5 text-muted-foreground" />
            )}
            Security &amp; optimization
          </DialogTitle>
          <DialogDescription>
            {available
              ? `Powered by the bundled qpdf ${status?.version ?? ''} sidecar. Each action saves a new copy.`
              : 'Encryption and repair require the qpdf sidecar.'}
          </DialogDescription>
        </DialogHeader>

        {!available ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            The qpdf sidecar is not available in this build. Install qpdf and ensure it is on your
            PATH, or run <code className="font-mono">npm run fetch:qpdf</code> to download it into{' '}
            <code className="font-mono">resources/bin</code>.
          </p>
        ) : (
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
            <Section title="Encrypt with a password">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Password to open (leave blank for none)
                </span>
                <Input
                  type="password"
                  value={userPassword}
                  onChange={(event) => setUserPassword(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Owner password (controls permissions)</span>
                <Input
                  type="password"
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PERMISSIONS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={(event) =>
                        setPermissions((prev) => ({ ...prev, [key]: event.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Button
                className="justify-self-start"
                disabled={busy || (!ownerPassword && !userPassword)}
                onClick={() =>
                  void guard(() => encryptDocument(tab, userPassword, ownerPassword, permissions))
                }
              >
                Encrypt &amp; save
              </Button>
            </Section>

            <Section title="Remove password">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Current password</span>
                <Input
                  type="password"
                  value={removePassword}
                  onChange={(event) => setRemovePassword(event.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                className="justify-self-start"
                disabled={busy}
                onClick={() => void guard(() => decryptDocument(tab, removePassword))}
              >
                Remove &amp; save
              </Button>
            </Section>

            <Section title="Optimize">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void guard(() => linearizeDocument(tab))}
                  title="Restructure for fast web viewing"
                >
                  Linearize &amp; save
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void guard(() => repairDocument(tab))}
                  title="Rebuild the file structure"
                >
                  Repair &amp; save
                </Button>
              </div>
            </Section>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
