import { useState } from 'react'
import {
  BadgeCheck,
  Crop,
  EyeOff,
  FileSignature,
  GitCompare,
  ImageDown,
  ImagePlus,
  Info,
  Lock,
  PenTool,
  Printer,
  ShieldCheck,
  Stamp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { MetadataDialog } from './MetadataDialog'
import { CompareView } from './CompareView'
import { CropDialog } from './CropDialog'
import { ExportDialog } from './ExportDialog'
import { RedactionDialog } from './RedactionDialog'
import { SecurityDialog } from './SecurityDialog'
import { SignatureDialog } from './SignatureDialog'
import { DigitalSignDialog } from './DigitalSignDialog'
import { SignaturePanel } from './SignaturePanel'
import { StampDialog } from './StampDialog'
import { InsertDialog } from './InsertDialog'
import { redactedPageNumbers } from '@/lib/redaction'
import { buildDocumentPdf } from '@/lib/save'
import { addImageAnnotation } from '@/lib/annotationOps'
import { rasterizeToPng } from '@/lib/imageInsert'
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
  const [cropOpen, setCropOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [redactionOpen, setRedactionOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [digitalSignOpen, setDigitalSignOpen] = useState(false)
  const [signaturesOpen, setSignaturesOpen] = useState(false)
  const [stampOpen, setStampOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [compare, setCompare] = useState<{ bytes: Uint8Array; name: string } | null>(null)
  const hasRedactions = redactedPageNumbers(tab).length > 0

  const openCompare = async (): Promise<void> => {
    const doc = await window.api.openFileDialog()
    if (doc) setCompare({ bytes: doc.bytes, name: doc.name })
  }

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

  // "Add image": pick a PNG/JPEG from disk (mime sniffed in main), normalize it
  // to a PNG, and drop it on the current page as a movable/resizable image
  // annotation — the same lifecycle as stamps and signatures. Errors (too large,
  // unsupported type, undecodable) surface to the user instead of silently
  // no-op'ing: main throws user-safe messages, which we relay.
  const addImage = async (): Promise<void> => {
    try {
      const picked = await window.api.pickImage()
      if (!picked) return
      const image = await rasterizeToPng(picked.bytes, picked.mime)
      if (!image) {
        setImageError('That image could not be decoded — the file may be corrupt.')
        return
      }
      placeImage(image)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'The image could not be added.')
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
      <Button variant="ghost" size="icon" title="Crop pages" onClick={() => setCropOpen(true)}>
        <Crop />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Compare with another PDF"
        onClick={() => void openCompare()}
      >
        <GitCompare />
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
      <Button
        variant="ghost"
        size="icon"
        title="Digitally sign (certificate)"
        onClick={() => setDigitalSignOpen(true)}
      >
        <FileSignature />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Verify digital signatures"
        onClick={() => setSignaturesOpen(true)}
      >
        <ShieldCheck />
      </Button>
      <Button variant="ghost" size="icon" title="Add stamp" onClick={() => setStampOpen(true)}>
        <BadgeCheck />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Add image (from file)"
        onClick={() => void addImage()}
      >
        <ImagePlus />
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

      {compare && (
        <CompareView
          tab={tab}
          otherBytes={compare.bytes}
          otherName={compare.name}
          onClose={() => setCompare(null)}
        />
      )}
      <MetadataDialog tab={tab} open={metadataOpen} onOpenChange={setMetadataOpen} />
      <CropDialog tab={tab} open={cropOpen} onOpenChange={setCropOpen} />
      <ExportDialog tab={tab} open={exportOpen} onOpenChange={setExportOpen} />
      <SecurityDialog tab={tab} open={securityOpen} onOpenChange={setSecurityOpen} />
      <RedactionDialog tab={tab} open={redactionOpen} onOpenChange={setRedactionOpen} />
      <SignatureDialog open={signOpen} onOpenChange={setSignOpen} onInsert={placeImage} />
      <DigitalSignDialog tab={tab} open={digitalSignOpen} onOpenChange={setDigitalSignOpen} />
      <SignaturePanel tab={tab} open={signaturesOpen} onOpenChange={setSignaturesOpen} />
      <StampDialog open={stampOpen} onOpenChange={setStampOpen} onInsert={placeImage} />
      <InsertDialog tab={tab} open={insertOpen} onOpenChange={setInsertOpen} />

      <Dialog open={imageError !== null} onOpenChange={(open) => !open && setImageError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Couldn&apos;t add image</DialogTitle>
            <DialogDescription>{imageError}</DialogDescription>
          </DialogHeader>
          <Button className="justify-self-end" onClick={() => setImageError(null)}>
            OK
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
