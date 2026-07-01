import { openViaDialog } from '@/lib/open'
import { requestSaveDocument } from '@/lib/saveGuards'
import { rotatePages } from '@/lib/pageOps'
import { useViewStore } from '@/store/viewStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useSearchStore } from '@/store/searchStore'
import { useHistoryStore } from '@/store/historyStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useUiStore } from '@/store/uiStore'
import { useOcrStore } from '@/store/ocrStore'
import type { DocumentTab } from '@/store/documentStore'

export interface Command {
  id: string
  label: string
  group: string
  /** Extra words to match on (not shown). */
  keywords?: string
  run: () => void
}

function toggleFullscreen(): void {
  if (typeof document === 'undefined') return
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen()
}

/** Builds the command list for the palette, given the active document (or null). */
export function buildCommands(tab: DocumentTab | null): Command[] {
  const view = useViewStore.getState
  const prefs = usePreferencesStore.getState

  const commands: Command[] = [
    {
      id: 'open',
      group: 'File',
      label: 'Open PDF…',
      keywords: 'file',
      run: () => void openViaDialog()
    }
  ]

  if (tab) {
    const pageCount = tab.pages.length
    commands.push(
      { id: 'save', group: 'File', label: 'Save', run: () => void requestSaveDocument(tab) },
      {
        id: 'save-as',
        group: 'File',
        label: 'Save As…',
        run: () => void requestSaveDocument(tab, true)
      },
      {
        id: 'undo',
        group: 'Edit',
        label: 'Undo',
        run: () => {
          useSelectionStore.getState().clear()
          useHistoryStore.getState().undo(tab.id)
        }
      },
      {
        id: 'redo',
        group: 'Edit',
        label: 'Redo',
        run: () => {
          useSelectionStore.getState().clear()
          useHistoryStore.getState().redo(tab.id)
        }
      },
      {
        id: 'rotate-cw',
        group: 'Edit',
        label: 'Rotate page right',
        keywords: 'clockwise turn',
        run: () => rotatePages(tab.id, [view().currentPage - 1], 90)
      },
      {
        id: 'rotate-ccw',
        group: 'Edit',
        label: 'Rotate page left',
        keywords: 'counter clockwise turn',
        run: () => rotatePages(tab.id, [view().currentPage - 1], -90)
      },
      {
        id: 'next-page',
        group: 'View',
        label: 'Next page',
        run: () => view().requestScrollToPage(Math.min(view().currentPage + 1, pageCount))
      },
      {
        id: 'prev-page',
        group: 'View',
        label: 'Previous page',
        run: () => view().requestScrollToPage(Math.max(view().currentPage - 1, 1))
      },
      {
        id: 'ocr',
        group: 'Tools',
        label: 'Recognize text (OCR)',
        keywords: 'scan searchable',
        run: () => void useOcrStore.getState().runDocument(tab)
      }
    )
  }

  commands.push(
    {
      id: 'find',
      group: 'Edit',
      label: 'Find in document',
      keywords: 'search',
      run: () => useSearchStore.getState().open()
    },
    { id: 'zoom-in', group: 'View', label: 'Zoom in', run: () => view().zoomIn() },
    { id: 'zoom-out', group: 'View', label: 'Zoom out', run: () => view().zoomOut() },
    {
      id: 'fit-width',
      group: 'View',
      label: 'Fit width',
      run: () => view().setZoomMode('fit-width')
    },
    { id: 'fit-page', group: 'View', label: 'Fit page', run: () => view().setZoomMode('fit-page') },
    {
      id: 'layout-continuous',
      group: 'View',
      label: 'Layout: Continuous',
      run: () => prefs().setLayout('continuous')
    },
    {
      id: 'layout-single',
      group: 'View',
      label: 'Layout: Single page',
      run: () => prefs().setLayout('single')
    },
    {
      id: 'layout-two-up',
      group: 'View',
      label: 'Layout: Two-up',
      run: () => prefs().setLayout('two-up')
    },
    {
      id: 'reading-normal',
      group: 'View',
      label: 'Reading mode: Normal',
      run: () => prefs().setReadingMode('normal')
    },
    {
      id: 'reading-sepia',
      group: 'View',
      label: 'Reading mode: Sepia',
      run: () => prefs().setReadingMode('sepia')
    },
    {
      id: 'reading-night',
      group: 'View',
      label: 'Reading mode: Night',
      run: () => prefs().setReadingMode('night')
    },
    {
      id: 'toggle-theme',
      group: 'View',
      label: 'Toggle light / dark theme',
      run: () => prefs().toggleTheme()
    },
    {
      id: 'toggle-sidebar',
      group: 'View',
      label: 'Toggle sidebar',
      run: () => prefs().toggleSidebar()
    },
    { id: 'fullscreen', group: 'View', label: 'Toggle fullscreen', run: toggleFullscreen },
    {
      id: 'shortcuts',
      group: 'Tools',
      label: 'Keyboard shortcuts',
      keywords: 'help',
      run: () => useUiStore.getState().openShortcuts()
    },
    {
      id: 'toggle-pdfium',
      group: 'Tools',
      label: prefs().experimentalPdfiumRenderer
        ? 'Disable experimental PDFium renderer'
        : 'Enable experimental PDFium renderer',
      keywords: 'tier-3 render engine fidelity wasm high quality',
      run: () => prefs().setExperimentalPdfiumRenderer(!prefs().experimentalPdfiumRenderer)
    }
  )

  return commands
}

/** Filters commands by a query (all whitespace-separated tokens must match). */
export function filterCommands(commands: Command[], query: string): Command[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return commands
  return commands.filter((command) => {
    const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
}
