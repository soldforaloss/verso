import { Loader2, ScanText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOcrStore } from '@/store/ocrStore'
import type { DocumentTab } from '@/store/documentStore'

/**
 * OCR control: recognizes the document's text (English, fully offline) and
 * embeds an invisible, selectable/searchable text layer. Shows live progress.
 */
export function OcrControls({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const status = useOcrStore((s) => s.status)
  const progress = useOcrStore((s) => s.progress)
  const message = useOcrStore((s) => s.message)
  const runDocument = useOcrStore((s) => s.runDocument)
  const running = status === 'running'

  return (
    <Button
      variant="ghost"
      size="sm"
      title={running ? message : 'Recognize text (OCR) — English, offline'}
      disabled={running}
      onClick={() => void runDocument(tab)}
    >
      {running ? <Loader2 className="animate-spin" /> : <ScanText />}
      {running ? `${Math.round(progress * 100)}%` : 'OCR'}
    </Button>
  )
}
