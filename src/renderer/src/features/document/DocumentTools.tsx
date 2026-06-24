import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetadataDialog } from './MetadataDialog'
import type { DocumentTab } from '@/store/documentStore'

/**
 * Toolbar group for document-level tools introduced in M8: metadata, image
 * export, security (qpdf), and printing. Each opens its own dialog; dialog open
 * state is local so the rest of the toolbar never re-renders on toggle.
 */
export function DocumentTools({ tab }: { tab: DocumentTab }): React.JSX.Element {
  const [metadataOpen, setMetadataOpen] = useState(false)

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

      <MetadataDialog tab={tab} open={metadataOpen} onOpenChange={setMetadataOpen} />
    </>
  )
}
