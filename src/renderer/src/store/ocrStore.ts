import { create } from 'zustand'
import { onOcrProgress, recognizePage, type OcrWord } from '@/lib/ocr'
import { augmentSourceWithText } from '@/lib/ocrAugment'
import { getSource, useDocumentStore, type DocumentTab } from './documentStore'

type OcrStatus = 'idle' | 'running' | 'done' | 'error'

interface OcrTarget {
  sourceId: string
  pageIndex: number
}

interface OcrState {
  status: OcrStatus
  progress: number
  message: string
  error: string | null
  runDocument: (tab: DocumentTab) => Promise<void>
  runPage: (tab: DocumentTab, logicalPage: number) => Promise<void>
}

async function run(
  set: (partial: Partial<OcrState>) => void,
  tab: DocumentTab,
  targets: OcrTarget[]
): Promise<void> {
  if (targets.length === 0) return
  set({ status: 'running', error: null, progress: 0, message: 'Starting OCR…' })
  const total = targets.length
  const wordsBySource = new Map<string, Map<number, OcrWord[]>>()

  try {
    let done = 0
    for (const { sourceId, pageIndex } of targets) {
      const source = getSource(sourceId)
      if (!source) {
        done += 1
        continue
      }
      onOcrProgress((status, progress) =>
        set({
          message: `${status || 'Recognizing'} — page ${done + 1} of ${total}`,
          progress: (done + progress) / total
        })
      )
      const page = await source.pdf.getPage(pageIndex + 1)
      const { words } = await recognizePage(page)
      if (!wordsBySource.has(sourceId)) wordsBySource.set(sourceId, new Map())
      wordsBySource.get(sourceId)!.set(pageIndex, words)
      done += 1
      set({ progress: done / total })
    }
    onOcrProgress(null)

    set({ message: 'Embedding text layer…' })
    for (const [sourceId, wordsByPage] of wordsBySource) {
      const source = getSource(sourceId)
      if (!source) continue
      const bytes = await augmentSourceWithText(source.bytes, wordsByPage)
      await useDocumentStore.getState().replaceSource(tab.id, sourceId, bytes)
    }

    set({
      status: 'done',
      progress: 1,
      message: `OCR complete (${total} page${total === 1 ? '' : 's'})`
    })
  } catch (error) {
    onOcrProgress(null)
    set({ status: 'error', error: error instanceof Error ? error.message : 'OCR failed' })
  }
}

/** Distinct source pages referenced by the tab, in order. */
function documentTargets(tab: DocumentTab): OcrTarget[] {
  const seen = new Set<string>()
  const targets: OcrTarget[] = []
  for (const ref of tab.pages) {
    if (ref.kind !== 'source') continue
    const key = `${ref.sourceId}:${ref.sourceIndex}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push({ sourceId: ref.sourceId, pageIndex: ref.sourceIndex })
  }
  return targets
}

export const useOcrStore = create<OcrState>((set) => ({
  status: 'idle',
  progress: 0,
  message: '',
  error: null,
  runDocument: (tab) => run(set, tab, documentTargets(tab)),
  runPage: (tab, logicalPage) => {
    const ref = tab.pages[logicalPage - 1]
    if (!ref || ref.kind !== 'source') return Promise.resolve()
    return run(set, tab, [{ sourceId: ref.sourceId, pageIndex: ref.sourceIndex }])
  }
}))
