import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useViewStore } from '@/store/viewStore'
import { useSearchStore } from '@/store/searchStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useHistoryStore } from '@/store/historyStore'
import { toolForKey, useToolStore } from '@/store/toolStore'
import { useUiStore } from '@/store/uiStore'
import { applyTheme, usePreferencesStore } from '@/store/preferencesStore'
import { openPath, openViaDialog } from '@/lib/open'
import { saveDocument } from '@/lib/save'
import { addAnnotation, removeAnnotation, updateAnnotation } from '@/lib/annotationOps'
import { duplicateAnnotation, translateAnnotation } from '@/lib/annotations'
import { copyAnnotation, getCopiedAnnotation } from '@/lib/annotationClipboard'
import { Toolbar } from '@/features/viewer/Toolbar'
import { AnnotationToolbar } from '@/features/annotations/AnnotationToolbar'
import { Viewer } from '@/features/viewer/Viewer'
import { Sidebar } from '@/features/navigation/Sidebar'
import { SearchBar } from '@/features/navigation/SearchBar'
import { ShortcutsDialog } from '@/features/help/ShortcutsDialog'
import { CommandPalette } from '@/features/command/CommandPalette'
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

  useEffect(() => {
    void window.api.getPreferences().then(hydrate)
  }, [hydrate])

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    return window.api.onOpenFile((document) => {
      void useDocumentStore.getState().openDocument(document)
    })
  }, [])

  // Reset view/search/selection whenever the active document changes.
  useEffect(() => {
    resetForDocument()
    useSearchStore.getState().reset()
    useSelectionStore.getState().clear()
  }, [activeId, resetForDocument])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // While the command palette is open it (and its dialog) owns the keyboard;
      // only the Ctrl/Cmd+K toggle is handled here so document shortcuts don't
      // fire behind it.
      if (useUiStore.getState().commandPaletteOpen) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault()
          useUiStore.getState().toggleCommandPalette()
        }
        return
      }

      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      // Escape clears any annotation selection.
      if (event.key === 'Escape') {
        useToolStore.getState().clearSelection()
        return
      }
      // Delete/Backspace removes the selected annotation (unless typing).
      if ((event.key === 'Delete' || event.key === 'Backspace') && !typing && activeId) {
        const { selectedId, selectedPageKey, clearSelection } = useToolStore.getState()
        if (selectedId && selectedPageKey) {
          event.preventDefault()
          removeAnnotation(activeId, selectedPageKey, selectedId)
          clearSelection()
        }
        return
      }

      // Arrow keys nudge the selected annotation in page space (Shift = ×10).
      if (
        !typing &&
        activeId &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight')
      ) {
        const { selectedId, selectedPageKey } = useToolStore.getState()
        const annotation =
          selectedId && selectedPageKey
            ? useDocumentStore
                .getState()
                .getTab(activeId)
                ?.annotations[selectedPageKey]?.find((a) => a.id === selectedId)
            : undefined
        if (annotation) {
          event.preventDefault()
          const step = event.shiftKey ? 10 : 1
          const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0
          const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0
          updateAnnotation(activeId, translateAnnotation(annotation, dx, dy), 'Move annotation')
          return
        }
      }

      // "?" opens the keyboard cheat-sheet (Shift+/ on most layouts).
      if (event.key === '?' && !typing) {
        event.preventDefault()
        useUiStore.getState().openShortcuts()
        return
      }

      // Page navigation + tool shortcuts: plain keys, so only when the user
      // isn't typing in a field.
      if (!typing && activeId && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const pageCount = useDocumentStore.getState().getTab(activeId)?.pages.length ?? 0
        if (pageCount > 0) {
          const view = useViewStore.getState()
          if (event.key === 'Home') {
            event.preventDefault()
            view.requestScrollToPage(1)
            return
          }
          if (event.key === 'End') {
            event.preventDefault()
            view.requestScrollToPage(pageCount)
            return
          }
          if (event.key === 'PageDown') {
            event.preventDefault()
            view.requestScrollToPage(Math.min(view.currentPage + 1, pageCount))
            return
          }
          if (event.key === 'PageUp') {
            event.preventDefault()
            view.requestScrollToPage(Math.max(view.currentPage - 1, 1))
            return
          }
        }

        // Single-key markup tool shortcuts (V/H/U/S/P/R/O/L/A/T/N/E).
        const tool = toolForKey(event.key.toLowerCase())
        if (tool) {
          event.preventDefault()
          useToolStore.getState().setTool(tool)
          return
        }
      }

      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      const docs = useDocumentStore.getState()
      const tab = activeId ? docs.getTab(activeId) : undefined

      if (key === 'k') {
        event.preventDefault()
        useUiStore.getState().toggleCommandPalette()
      } else if (key === 'o') {
        event.preventDefault()
        void openViaDialog()
      } else if (key === 'w' && tab) {
        event.preventDefault()
        if (!tab.dirty || window.confirm(`Discard unsaved changes to “${tab.name}”?`)) {
          closeDocument(tab.id)
        }
      } else if (key === 's' && tab) {
        event.preventDefault()
        void saveDocument(tab, event.shiftKey)
      } else if (key === 'z' && tab) {
        event.preventDefault()
        useSelectionStore.getState().clear()
        if (event.shiftKey) useHistoryStore.getState().redo(tab.id)
        else useHistoryStore.getState().undo(tab.id)
      } else if (key === 'y' && tab) {
        event.preventDefault()
        useSelectionStore.getState().clear()
        useHistoryStore.getState().redo(tab.id)
      } else if (key === 'd' && tab) {
        // Duplicate the selected annotation, offset slightly, and select it.
        const { selectedId, selectedPageKey, selectAnnotation } = useToolStore.getState()
        const annotation =
          selectedId && selectedPageKey
            ? tab.annotations[selectedPageKey]?.find((a) => a.id === selectedId)
            : undefined
        if (annotation && selectedPageKey) {
          event.preventDefault()
          const clone = duplicateAnnotation(annotation)
          addAnnotation(tab.id, clone)
          selectAnnotation(selectedPageKey, clone.id)
        }
      } else if (key === 'c' && tab && !typing) {
        // Copy the selected annotation — but yield to a real text selection so
        // copying page text still works.
        const { selectedId, selectedPageKey } = useToolStore.getState()
        const hasTextSelection = !(window.getSelection()?.isCollapsed ?? true)
        const annotation =
          selectedId && selectedPageKey && !hasTextSelection
            ? tab.annotations[selectedPageKey]?.find((a) => a.id === selectedId)
            : undefined
        if (annotation) {
          event.preventDefault()
          copyAnnotation(annotation)
        }
      } else if (key === 'v' && tab && !typing) {
        // Paste a clone of the copied annotation onto the page in view.
        const copied = getCopiedAnnotation()
        const pageKey =
          tab.pages[Math.min(useViewStore.getState().currentPage, tab.pages.length) - 1]?.key
        if (copied && pageKey) {
          event.preventDefault()
          const clone = { ...duplicateAnnotation(copied), pageKey }
          addAnnotation(tab.id, clone)
          useToolStore.getState().selectAnnotation(pageKey, clone.id)
        }
      } else if (key === 'f') {
        event.preventDefault()
        useSearchStore.getState().open()
      } else if (key === '=' || key === '+') {
        event.preventDefault()
        useViewStore.getState().zoomIn()
      } else if (key === '-') {
        event.preventDefault()
        useViewStore.getState().zoomOut()
      } else if (key === '0') {
        event.preventDefault()
        useViewStore.getState().setZoomMode('fit-width')
      } else if (key === 'tab') {
        // Cycle tabs (Shift = backwards).
        event.preventDefault()
        const { tabs: openTabs, activeId: current, setActive } = useDocumentStore.getState()
        if (openTabs.length > 1 && current) {
          const i = openTabs.findIndex((t) => t.id === current)
          const next = event.shiftKey
            ? (i - 1 + openTabs.length) % openTabs.length
            : (i + 1) % openTabs.length
          setActive(openTabs[next]!.id)
        }
      } else if (/^[1-9]$/.test(key)) {
        // Jump to tab N (9 = last), like a browser.
        event.preventDefault()
        const { tabs: openTabs, setActive } = useDocumentStore.getState()
        const index = key === '9' ? openTabs.length - 1 : Number(key) - 1
        if (openTabs[index]) setActive(openTabs[index]!.id)
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
      <ShortcutsDialog />
      <CommandPalette />
    </div>
  )
}

/** Renders the toolbar + sidebar + viewer (or a loading/error state). */
function ActiveDocument(): React.JSX.Element {
  const tab = useDocumentStore((s) => s.tabs.find((t) => t.id === s.activeId)) ?? null
  const sidebarOpen = usePreferencesStore((s) => s.sidebarOpen)
  const searchOpen = useSearchStore((s) => s.isOpen)

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
      <Toolbar tab={tab} />
      <AnnotationToolbar tab={tab} />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar tab={tab} />}
        <main aria-label="Document" className="relative min-w-0 flex-1">
          {searchOpen && <SearchBar tab={tab} />}
          <Viewer tab={tab} />
        </main>
      </div>
    </>
  )
}

export default App
