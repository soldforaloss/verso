import { useState } from 'react'
import { BadgeCheck, EyeOff, ImageDown, Info, Lock, PenTool, Printer, Stamp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetadataDialog } from './MetadataDialog'
import { ExportDialog } from './ExportDialog'
import { RedactionDialog } from './RedactionDialog'
import { SecurityDialog } from './SecurityDialog'
import { SignatureDialog } from './SignatureDialog'
import { StampDialog } from './StampDialog'
import { InsertDialog } from './InsertDialog'
import { redactedPageNumbers } from '@/lib/redaction'
import { buildDocumentPdf } from '@/lib/save'
import { addImageAnnotation } from '@/lib/annotationOps'
import { useViewStore } from '@/store/viewStore'
import { useToolStore } from '@/store/toolStore'
import type { SignatureImage } from '@/lib/signature'
import type { DocumentTab } from '@/store/documentStore'

/**
 * Toolbar group for document-level tools: metadata, image export, security
 * (qpdf), redaction, printing, and signatures. Each opens its own dialog; dialog
 * open state is local so the rest of the toolbar never re-renders on toggle.
 */
export function DocumentTools({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [redactionOpen, setRedactionOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [stampOpen, setStampOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
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

  const placeImage = (image: SignatureImage): void => {
    const currentPage = useViewStore.getState().currentPage
    const pageKey = tab.pages[Math.min(currentPage, tab.pages.length) - 1]?.key
    if (!pageKey) return
    const aspect = image.height > 0 ? image.width / image.height : 1
    const id = addImageAnnotation(tab.id, pageKey, image.dataUrl, aspect)
    useToolStore.getState().setTool('select')
    useToolStore.getState().selectAnnotation(pageKey, id)
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
      <Button variant="ghost" size="icon" title="Add signature" onClick={() => setSignOpen(true)}>
        <PenTool />
      </Button>
      <Button variant="ghost" size="icon" title="Add stamp" onClick={() => setStampOpen(true)}>
        <BadgeCheck />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Watermark & page numbers"
        onClick={() => setInsertOpen(true)}
      >
        <Stamp />
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
      <SignatureDialog open={signOpen} onOpenChange={setSignOpen} onInsert={placeImage} />
      <StampDialog open={stampOpen} onOpenChange={setStampOpen} onInsert={placeImage} />
      <InsertDialog tab={tab} open={insertOpen} onOpenChange={setInsertOpen} />
    </>
  )
}
