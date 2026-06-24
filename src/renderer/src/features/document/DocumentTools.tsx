import { useState } from 'react'
import { EyeOff, ImageDown, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetadataDialog } from './MetadataDialog'
import { ExportDialog } from './ExportDialog'
import { RedactionDialog } from './RedactionDialog'
import { redactedPageNumbers } from '@/lib/redaction'
import type { DocumentTab } from '@/store/documentStore'

/**
 * Toolbar group for document-level tools introduced in M8: metadata, image
 * export, security (qpdf), and printing. Each opens its own dialog; dialog open
 * state is local so the rest of the toolbar never re-renders on toggle.
 */
export function DocumentTools({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [redactionOpen, setRedactionOpen] = useState(false)
  const hasRedactions = redactedPageNumbers(tab).length > 0

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Document properties"
        onClick={() => setMetadataOpen(true)}
      >
        <Info />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Export as image (PNG/JPEG)"
        onClick={() => setExportOpen(true)}
      >
        <ImageDown />
      </Button>
      {hasRedactions && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          title="Apply redactions (permanent)"
          onClick={() => setRedactionOpen(true)}
        >
          <EyeOff />
        </Button>
      )}

      <MetadataDialog tab={tab} open={metadataOpen} onOpenChange={setMetadataOpen} />
      <ExportDialog tab={tab} open={exportOpen} onOpenChange={setExportOpen} />
      <RedactionDialog tab={tab} open={redactionOpen} onOpenChange={setRedactionOpen} />
    </>
  )
}
