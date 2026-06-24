import { PDFDocument } from 'pdf-lib'

/**
 * The editable Document Information dictionary fields. Kept as plain strings so
 * the editor is a simple controlled form; keywords are a comma-separated string
 * (split into the PDF's keyword array on apply).
 */
export interface DocumentMetadata {
  title: string
  author: string
  subject: string
  keywords: string
  creator: string
  producer: string
}

/** Read-only dates surfaced alongside the editable fields. */
export interface MetadataDates {
  creationDate: Date | null
  modificationDate: Date | null
}

export const EMPTY_METADATA: DocumentMetadata = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: ''
}

function dateOrNull(value: Date | undefined): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null
}

/** Reads the Info dictionary from PDF bytes without mutating it. */
export async function readMetadata(bytes: Uint8Array): Promise<DocumentMetadata & MetadataDates> {
  // `updateMetadata: false` keeps pdf-lib from rewriting Producer/ModDate on
  // load, so we report what is actually in the file.
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  let creationDate: Date | undefined
  let modificationDate: Date | undefined
  try {
    creationDate = doc.getCreationDate()
  } catch {
    /* malformed date entry — ignore */
  }
  try {
    modificationDate = doc.getModificationDate()
  } catch {
    /* malformed date entry — ignore */
  }
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
    creationDate: dateOrNull(creationDate),
    modificationDate: dateOrNull(modificationDate)
  }
}

/**
 * Writes the editable metadata fields onto a loaded document. The modification
 * date is bumped to now; the creation date is left untouched.
 */
export function applyMetadata(doc: PDFDocument, meta: DocumentMetadata): void {
  doc.setTitle(meta.title)
  doc.setAuthor(meta.author)
  doc.setSubject(meta.subject)
  doc.setKeywords(
    meta.keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean)
  )
  doc.setCreator(meta.creator)
  doc.setProducer(meta.producer)
  doc.setModificationDate(new Date())
}
