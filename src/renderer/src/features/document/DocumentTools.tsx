import { useState } from 'react'
import { EyeOff, ImageDown, Info, Lock, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetadataDialog } from './MetadataDialog'
import { ExportDialog } from './ExportDialog'
import { RedactionDialog } from './RedactionDialog'
import { SecurityDialog } from './SecurityDialog'
import { redactedPageNumbers } from '@/lib/redaction'
import { buildDocumentPdf } from '@/lib/save'
import type { DocumentTab } from '@/store/documentStore'

/**
 * Toolbar group for document-level tools introduced in M8: metadata, image
 * export, security (qpdf), redaction, and printing. Each opens its own dialog;
 * dialog open state is local so the rest of the toolbar never re-renders on
 * toggle.
 */
export function DocumentTools({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [redactionOpen, setRedactionOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const hasRedactions = redactedPageNumbers(tab).length > 0

  const print = async (): Promise<void> => {
    setPrinting(true)
    try {
      const bytes = await buildDocumentPdf(tab)
      await window.api.printPdf({ bytes })
    } finally {
      setPrinting(false)
    }
  }

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
      <Button
        variant="ghost"
        size="icon"
        title="Security & optimization"
        onClick={() => setSecurityOpen(true)}
      >
        <Lock />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Print"
        disabled={printing}
        onClick={() => void print()}
      >
        <Printer />
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
      <SecurityDialog tab={tab} open={securityOpen} onOpenChange={setSecurityOpen} />
      <RedactionDialog tab={tab} open={redactionOpen} onOpenChange={setRedactionOpen} />
    </>
  )
}
