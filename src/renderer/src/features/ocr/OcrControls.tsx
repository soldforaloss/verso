import { Loader2, ScanText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOcrStore } from '@/store/ocrStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { OCR_LANGUAGES, normalizeOcrLanguage, ocrLanguageLabel } from '@/lib/ocrLanguages'
import type { DocumentTab } from '@/store/documentStore'

/**
 * OCR control: recognizes the document's text in the chosen (bundled, offline)
 * language and embeds an invisible, selectable/searchable text layer. The
 * language picker sits beside the button; both run fully offline.
 */
export function OcrControls({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const status = useOcrStore((s) => s.status)
  const progress = useOcrStore((s) => s.progress)
  const message = useOcrStore((s) => s.message)
  const runDocument = useOcrStore((s) => s.runDocument)
  const language = usePreferencesStore((s) => normalizeOcrLanguage(s.ocrLanguage))
  const setOcrLanguage = usePreferencesStore((s) => s.setOcrLanguage)
  const running = status === 'running'

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        title={running ? message : `Recognize text (OCR) — ${ocrLanguageLabel(language)}, offline`}
        disabled={running}
        onClick={() => void runDocument(tab)}
      >
        {running ? <Loader2 className="animate-spin" /> : <ScanText />}
        {running ? `${Math.round(progress * 100)}%` : 'OCR'}
      </Button>
      <select
        aria-label="OCR language"
        title="OCR language"
        value={language}
        disabled={running}
        onChange={(event) => setOcrLanguage(event.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        {OCR_LANGUAGES.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
