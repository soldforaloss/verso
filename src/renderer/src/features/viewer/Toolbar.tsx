import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  FolderOpen,
  FormInput,
  Maximize,
  Minimize,
  Moon,
  PanelLeft,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  ScrollText,
  Search,
  Square,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { openViaDialog } from '@/lib/open'
import { saveDocument } from '@/lib/save'
import { rotatePages } from '@/lib/pageOps'
import { useViewStore } from '@/store/viewStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useSearchStore } from '@/store/searchStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useFormStore } from '@/store/formStore'
import { selectCanRedo, selectCanUndo, useHistoryStore } from '@/store/historyStore'
import { OcrControls } from '@/features/ocr/OcrControls'
import { DocumentTools } from '@/features/document/DocumentTools'
import type { DocumentTab } from '@/store/documentStore'
import type { LayoutMode, ReadingMode } from '@shared/ipc'

const READING_LABEL: Record<ReadingMode, string> = {
  normal: 'Reading mode: Normal',
  sepia: 'Reading mode: Sepia',
  night: 'Reading mode: Night'
}
const READING_NEXT: Record<ReadingMode, ReadingMode> = {
  normal: 'sepia',
  sepia: 'night',
  night: 'normal'
}

const LAYOUTS: { mode: LayoutMode; label: string; Icon: typeof ScrollText }[] = [
  { mode: 'continuous', label: 'Continuous', Icon: ScrollText },
  { mode: 'single', label: 'Single page', Icon: Square },
  { mode: 'two-up', label: 'Two-up', Icon: Columns2 }
]

function Divider(): React.JSX.Element {
  return <div className="mx-1 h-5 w-px bg-border" />
}

export function Toolbar({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const pageCount = tab.pages.length

  const scale = useViewStore((s) => s.scale)
  const zoomMode = useViewStore((s) => s.zoomMode)
  const currentPage = useViewStore((s) => s.currentPage)
  const zoomIn = useViewStore((s) => s.zoomIn)
  const zoomOut = useViewStore((s) => s.zoomOut)
  const setZoomMode = useViewStore((s) => s.setZoomMode)
  const requestScrollToPage = useViewStore((s) => s.requestScrollToPage)

  const layout = usePreferencesStore((s) => s.layout)
  const setLayout = usePreferencesStore((s) => s.setLayout)
  const readingMode = usePreferencesStore((s) => s.readingMode)
  const setReadingMode = usePreferencesStore((s) => s.setReadingMode)
  const theme = usePreferencesStore((s) => s.theme)
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme)
  const sidebarOpen = usePreferencesStore((s) => s.sidebarOpen)
  const toggleSidebar = usePreferencesStore((s) => s.toggleSidebar)

  const searchOpen = useSearchStore((s) => s.isOpen)
  const openSearch = useSearchStore((s) => s.open)
  const closeSearch = useSearchStore((s) => s.close)

  const canUndo = useHistoryStore(selectCanUndo(tab.id))
  const canRedo = useHistoryStore(selectCanRedo(tab.id))
  const clearSelection = useSelectionStore((s) => s.clear)
  const hasForm = useFormStore((s) => s.hasFields[tab.id] ?? false)
  const resetForm = useFormStore((s) => s.resetSources)

  const [pageInput, setPageInput] = useState(String(currentPage))
  const inputFocused = useRef(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!inputFocused.current) setPageInput(String(currentPage))
  }, [currentPage])

  useEffect(() => {
    const onChange = (): void => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const commitPage = (): void => {
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isFinite(parsed)) requestScrollToPage(Math.min(Math.max(1, parsed), pageCount))
    else setPageInput(String(currentPage))
  }

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  const undo = (): void => {
    clearSelection()
    useHistoryStore.getState().undo(tab.id)
  }
  const redo = (): void => {
    clearSelection()
    useHistoryStore.getState().redo(tab.id)
  }
  const rotateCurrent = (delta: number): void => rotatePages(tab.id, [currentPage - 1], delta)

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
      <Button
        variant={sidebarOpen ? 'secondary' : 'ghost'}
        size="icon"
        title="Toggle sidebar"
        aria-pressed={sidebarOpen}
        onClick={toggleSidebar}
      >
        <PanelLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Open PDF (Ctrl+O)"
        onClick={() => void openViaDialog()}
      >
        <FolderOpen />
      </Button>
      <Button
        variant={tab.dirty ? 'default' : 'ghost'}
        size="icon"
        title={tab.dirty ? 'Save (Ctrl+S) — unsaved changes' : 'Save (Ctrl+S)'}
        onClick={() => void saveDocument(tab)}
      >
        <Save />
      </Button>
      {hasForm && (
        <Button
          variant="ghost"
          size="icon"
          title="Reset form fields"
          onClick={() => resetForm(tab.sourceIds)}
        >
          <FormInput />
        </Button>
      )}

      <Divider />

      <Button variant="ghost" size="icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        <Undo2 />
      </Button>
      <Button variant="ghost" size="icon" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
        <Redo2 />
      </Button>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        title="Previous page"
        disabled={currentPage <= 1}
        onClick={() => requestScrollToPage(currentPage - 1)}
      >
        <ChevronUp />
      </Button>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Input
          aria-label="Page number"
          className="w-12 text-center"
          value={pageInput}
          inputMode="numeric"
          onChange={(event) => setPageInput(event.target.value)}
          onFocus={() => (inputFocused.current = true)}
          onBlur={() => {
            inputFocused.current = false
            commitPage()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className="tabular-nums">/ {pageCount}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Next page"
        disabled={currentPage >= pageCount}
        onClick={() => requestScrollToPage(currentPage + 1)}
      >
        <ChevronDown />
      </Button>

      <Divider />

      <Button variant="ghost" size="icon" title="Zoom out (Ctrl+-)" onClick={zoomOut}>
        <ZoomOut />
      </Button>
      <button
        type="button"
        className="min-w-14 rounded px-1 text-center text-sm tabular-nums hover:bg-accent"
        title="Reset zoom to fit width"
        onClick={() => setZoomMode('fit-width')}
      >
        {Math.round(scale * 100)}%
      </button>
      <Button variant="ghost" size="icon" title="Zoom in (Ctrl++)" onClick={zoomIn}>
        <ZoomIn />
      </Button>
      <Button
        variant={zoomMode === 'fit-width' ? 'secondary' : 'ghost'}
        size="sm"
        title="Fit width"
        onClick={() => setZoomMode('fit-width')}
      >
        Width
      </Button>
      <Button
        variant={zoomMode === 'fit-page' ? 'secondary' : 'ghost'}
        size="sm"
        title="Fit page"
        onClick={() => setZoomMode('fit-page')}
      >
        Page
      </Button>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        title="Rotate page left"
        onClick={() => rotateCurrent(-90)}
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Rotate page right"
        onClick={() => rotateCurrent(90)}
      >
        <RotateCw />
      </Button>

      <Divider />

      <div className="flex items-center rounded-md border p-0.5">
        {LAYOUTS.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            type="button"
            title={label}
            aria-pressed={layout === mode}
            className={cn(
              'flex size-7 items-center justify-center rounded-[5px] transition-colors',
              layout === mode ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
            )}
            onClick={() => setLayout(mode)}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <DocumentTools tab={tab} />
        <OcrControls tab={tab} />
        <Button
          variant={searchOpen ? 'secondary' : 'ghost'}
          size="icon"
          title="Find in document (Ctrl+F)"
          aria-pressed={searchOpen}
          onClick={() => (searchOpen ? closeSearch() : openSearch())}
        >
          <Search />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title={READING_LABEL[readingMode]}
          onClick={() => setReadingMode(READING_NEXT[readingMode])}
        >
          {readingMode === 'normal' ? 'Normal' : readingMode === 'sepia' ? 'Sepia' : 'Night'}
        </Button>
        <Button variant="ghost" size="icon" title="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Toggle fullscreen (F11)"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </div>
    </div>
  )
}
