import { useEffect, useState } from 'react'
import { FileText, Moon, ShieldCheck, Sun, TriangleAlert } from 'lucide-react'
import type { AppInfo } from '@shared/ipc'
import { Button } from '@/components/ui/button'
import { usePreferencesStore, applyTheme } from '@/store/preferencesStore'

type BridgeStatus =
  | { state: 'checking' }
  | { state: 'ok'; pong: string; info: AppInfo }
  | { state: 'error'; message: string }

/**
 * M0 shell. Beyond looking like Verso, it proves the security model works end
 * to end: it can only reach the main process through `window.api`, which is the
 * single contextBridge surface. A successful ping + app-info round-trip means
 * the typed, zod-validated IPC path is wired correctly.
 *
 * The PDF viewer replaces this hero in M1.
 */
function App(): React.JSX.Element {
  const theme = usePreferencesStore((s) => s.theme)
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme)
  const [bridge, setBridge] = useState<BridgeStatus>({ state: 'checking' })

  // Apply theme on mount + whenever it changes, and react to OS changes.
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // Verify the contextBridge ⇄ IPC path once.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [pong, info] = await Promise.all([
          window.api.ping({ message: 'hello from renderer' }),
          window.api.getAppInfo()
        ])
        if (!cancelled) setBridge({ state: 'ok', pong: pong.reply, info })
      } catch (error) {
        if (!cancelled) {
          setBridge({
            state: 'error',
            message: error instanceof Error ? error.message : 'Unknown bridge error'
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Verso</div>
            <div className="text-xs text-muted-foreground">PDF viewer &amp; editor</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title="Toggle light / dark theme"
        >
          <Sun className="hidden size-4 dark:block" />
          <Moon className="block size-4 dark:hidden" />
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            A calm place to read and edit PDFs.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Fast, keyboard-friendly, and completely private. The viewer arrives in the next
            milestone — for now, here is proof the secure foundation is in place.
          </p>

          <BridgeCard bridge={bridge} />

          <p className="mt-6 text-xs text-muted-foreground">
            No telemetry · No analytics · Works fully offline
          </p>
        </div>
      </main>
    </div>
  )
}

function BridgeCard({ bridge }: { bridge: BridgeStatus }): React.JSX.Element {
  return (
    <div className="mx-auto mt-8 rounded-xl border bg-card p-5 text-left text-card-foreground shadow-sm">
      {bridge.state === 'checking' && (
        <p className="text-sm text-muted-foreground">Verifying secure bridge…</p>
      )}

      {bridge.state === 'error' && (
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Secure bridge unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">{bridge.message}</p>
          </div>
        </div>
      )}

      {bridge.state === 'ok' && (
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Secure bridge verified</p>
            <p className="mt-1 text-xs text-muted-foreground">
              contextIsolation · sandbox · zod-validated IPC — “{bridge.pong}”
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <Stat label="Version" value={bridge.info.version} />
              <Stat label="Platform" value={`${bridge.info.platform} · ${bridge.info.arch}`} />
              <Stat label="Electron" value={bridge.info.electron} />
              <Stat label="Chromium" value={bridge.info.chrome} />
              <Stat label="Node" value={bridge.info.node} />
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export default App
