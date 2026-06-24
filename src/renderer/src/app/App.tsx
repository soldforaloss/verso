import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import { applyTheme, usePreferencesStore } from '@/store/preferencesStore'
import { openPath, openViaDialog } from '@/lib/open'
import { Toolbar } from '@/features/viewer/Toolbar'
import { Viewer } from '@/features/viewer/Viewer'
import { TabBar } from './TabBar'
import { EmptyState } from './EmptyState'

function App(): React.JSX.Element {
  const tabs = useDocumentStore((s) => s.tabs)
  const activeId = useDocumentStore((s) => s.activeId)
  const closeDocument = useDocumentStore((s) => s.closeDocument)
  const active = tabs.find((tab) => tab.id === activeId) ?? null

  const theme = usePreferencesStore((s) => s.theme)
  const hydrate = usePreferencesStore((s) => s.hydrate)
  const resetForDocument = useViewStore((s) => s.resetForDocument)

  // Load persisted preferences from disk on startup.
  useEffect(() => {
    void window.api.getPreferences().then(hydrate)
  }, [hydrate])

  // Apply the theme, and follow the OS when set to "system".
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // Files opened from outside the UI (file association, CLI, second instance).
  useEffect(() => {
    return window.api.onOpenFile((document) => {
      void useDocumentStore.getState().openDocument(document)
    })
  }, [])

  // Reset the view whenever the active document changes.
  useEffect(() => {
    resetForDocument()
  }, [activeId, resetForDocument])

  // Application keyboard shortcuts (the full map + cheat-sheet arrive in M9).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void openViaDialog()
      } else if (mod && event.key.toLowerCase() === 'w' && activeId) {
        event.preventDefault()
        closeDocument(activeId)
      } else if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        useViewStore.getState().zoomIn()
      } else if (mod && event.key === '-') {
        event.preventDefault()
        useViewStore.getState().zoomOut()
      } else if (mod && event.key === '0') {
        event.preventDefault()
        useViewStore.getState().setZoomMode('fit-width')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId, closeDocument])

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (!file) return
    const path = window.api.getPathForFile(file)
    if (path) void openPath(path)
  }

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <TabBar />
      {active ? <ActiveDocument key={active.id} /> : <EmptyState />}
    </div>
  )
}

/** Renders the toolbar + viewer (or a loading/error state) for the active tab. */
function ActiveDocument(): React.JSX.Element {
  const activeId = useDocumentStore((s) => s.activeId)
  const tab = useDocumentStore((s) => s.tabs.find((t) => t.id === s.activeId)) ?? null

  if (!tab) return <EmptyState />

  if (tab.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert className="size-8 text-destructive" />
        <div>
          <p className="font-medium">Couldn’t open “{tab.name}”</p>
          <p className="mt-1 text-sm text-muted-foreground">{tab.error}</p>
        </div>
      </div>
    )
  }

  if (tab.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Opening “{tab.name}”…
      </div>
    )
  }

  return (
    <>
      <Toolbar pageCount={tab.pageCount} />
      <div className="min-h-0 flex-1">
        <Viewer key={activeId ?? 'none'} tab={tab} />
      </div>
    </>
  )
}

export default App
