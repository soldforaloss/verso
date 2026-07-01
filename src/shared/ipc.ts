import { z } from 'zod'

/**
 * zod schemas for every IPC channel's request and response payloads.
 *
 * These are the contract enforced at the trust boundary: the main process
 * validates each incoming request against the request schema and rejects
 * anything that does not match (see `src/main/ipc/registry.ts`). Renderer and
 * preload code derive their static types from the same schemas, so the wire
 * format can never drift between processes.
 *
 * Imported only by the main process and (as types) the renderer — never by the
 * preload, which stays dependency-free.
 */

export const PingRequestSchema = z.object({
  message: z.string().min(1).max(1_000)
})
export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingResponseSchema = z.object({
  reply: z.string(),
  receivedAt: z.number().int().nonnegative()
})
export type PingResponse = z.infer<typeof PingResponseSchema>

/** No-argument request marker. zod parses `undefined` against this. */
export const EmptyRequestSchema = z.void()

export const AppInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  platform: z.string(),
  arch: z.string(),
  electron: z.string(),
  chrome: z.string(),
  node: z.string()
})
export type AppInfo = z.infer<typeof AppInfoSchema>

// --- Documents -------------------------------------------------------------

/** A PDF loaded into memory and handed to the renderer. */
export const OpenedDocumentSchema = z.object({
  /** Stable per-open identifier (used as the tab/document key). */
  id: z.string(),
  /** Display name (file name without directory). */
  name: z.string(),
  /** Absolute path on disk, or null for documents with no backing file. */
  path: z.string().nullable(),
  /** Raw PDF bytes. */
  bytes: z.instanceof(Uint8Array)
})
export type OpenedDocument = z.infer<typeof OpenedDocumentSchema>

export const ReadFileRequestSchema = z.object({
  path: z.string().min(1).max(4_096)
})
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>

// --- Recent files ----------------------------------------------------------

export const RecentFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  lastOpenedAt: z.number().int().nonnegative()
})
export type RecentFile = z.infer<typeof RecentFileSchema>

// --- Preferences -----------------------------------------------------------

export const ThemeModeSchema = z.enum(['light', 'dark', 'system'])
export type ThemeMode = z.infer<typeof ThemeModeSchema>

export const LayoutModeSchema = z.enum(['continuous', 'single', 'two-up'])
export type LayoutMode = z.infer<typeof LayoutModeSchema>

export const ReadingModeSchema = z.enum(['normal', 'sepia', 'night'])
export type ReadingMode = z.infer<typeof ReadingModeSchema>

/** Persisted UI preferences. Every field has a default. */
export const PreferencesSchema = z.object({
  theme: ThemeModeSchema.default('system'),
  layout: LayoutModeSchema.default('continuous'),
  readingMode: ReadingModeSchema.default('normal'),
  sidebarOpen: z.boolean().default(true),
  /** Tesseract language code for OCR (a bundled `best_int` model). */
  ocrLanguage: z.string().default('eng'),
  /** Experimental: render pages with the Tier-3 PDFium (WASM) engine. */
  experimentalPdfiumRenderer: z.boolean().default(false)
})
export type Preferences = z.infer<typeof PreferencesSchema>

/** A partial update accepted by `setPreferences`. */
export const PartialPreferencesSchema = PreferencesSchema.partial()
export type PartialPreferences = z.infer<typeof PartialPreferencesSchema>

// --- Saving / exporting ----------------------------------------------------

export const SaveDialogRequestSchema = z.object({
  defaultName: z.string().min(1).max(255)
})
export type SaveDialogRequest = z.infer<typeof SaveDialogRequestSchema>

export const WriteFileRequestSchema = z.object({
  path: z.string().min(1).max(4_096),
  bytes: z.instanceof(Uint8Array)
})
export type WriteFileRequest = z.infer<typeof WriteFileRequestSchema>

export const WriteInDirRequestSchema = z.object({
  dir: z.string().min(1).max(4_096),
  name: z.string().min(1).max(255),
  bytes: z.instanceof(Uint8Array)
})
export type WriteInDirRequest = z.infer<typeof WriteInDirRequestSchema>

// --- Crash recovery --------------------------------------------------------

/** Autosaves a recovery snapshot of a dirty document. */
export const RecoverySaveRequestSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  path: z.string().nullable(),
  bytes: z.instanceof(Uint8Array)
})
export type RecoverySaveRequest = z.infer<typeof RecoverySaveRequestSchema>

/** Metadata for a recoverable document (bytes fetched separately). */
export const RecoveryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string().nullable(),
  savedAt: z.number().int().nonnegative()
})
export type RecoveryEntry = z.infer<typeof RecoveryEntrySchema>

export const RecoveryIdRequestSchema = z.object({ id: z.string().min(1).max(128) })
export type RecoveryIdRequest = z.infer<typeof RecoveryIdRequestSchema>

// --- Security (qpdf sidecar) -----------------------------------------------

/** Availability of the bundled qpdf sidecar binary. */
export const SecurityStatusSchema = z.object({
  available: z.boolean(),
  version: z.string().nullable()
})
export type SecurityStatus = z.infer<typeof SecurityStatusSchema>

/** Permission flags applied when encrypting (256-bit AES). */
export const PdfPermissionsSchema = z.object({
  printing: z.boolean(),
  modifying: z.boolean(),
  copying: z.boolean(),
  annotating: z.boolean()
})
export type PdfPermissions = z.infer<typeof PdfPermissionsSchema>

const PASSWORD_MAX = 256

/**
 * A qpdf transform request. The bytes are the document to transform; the main
 * process never lets the renderer supply raw qpdf arguments — every flag is
 * derived from these validated fields.
 */
export const TransformPdfRequestSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('encrypt'),
    bytes: z.instanceof(Uint8Array),
    userPassword: z.string().max(PASSWORD_MAX),
    ownerPassword: z.string().max(PASSWORD_MAX),
    permissions: PdfPermissionsSchema
  }),
  z.object({
    operation: z.literal('decrypt'),
    bytes: z.instanceof(Uint8Array),
    password: z.string().max(PASSWORD_MAX)
  }),
  z.object({ operation: z.literal('repair'), bytes: z.instanceof(Uint8Array) }),
  z.object({ operation: z.literal('linearize'), bytes: z.instanceof(Uint8Array) })
])
export type TransformPdfRequest = z.infer<typeof TransformPdfRequestSchema>

export type TransformOperation = TransformPdfRequest['operation']

// --- Printing --------------------------------------------------------------

export const PrintPdfRequestSchema = z.object({
  bytes: z.instanceof(Uint8Array)
})
export type PrintPdfRequest = z.infer<typeof PrintPdfRequestSchema>

// --- Tier-3 true text editing (PDFium) -------------------------------------

/** Hard cap on PDF bytes accepted over IPC (mirrors the qpdf/PDFium guards). */
const MAX_PDF_BYTES = 512 * 1024 * 1024
const MAX_PAGE_INDEX = 1_000_000
const EDIT_TEXT_MAX = 2_000
/** A bundled .ttf is well under this; caps the font-swap payload. */
const MAX_FONT_BYTES = 8 * 1024 * 1024

/** Bytes that are a Uint8Array within the size cap — the trust-boundary guard. */
const PdfBytesSchema = z
  .instanceof(Uint8Array)
  .refine((b) => b.byteLength <= MAX_PDF_BYTES, 'PDF exceeds the size limit')

/** The three generic font families the true-text editor offers. */
export const FontFamilySchema = z.enum(['sans-serif', 'serif', 'monospace'])
export type FontFamily = z.infer<typeof FontFamilySchema>

/** A text object's visual style, reported by locate and shown in the editor. */
export const TextStyleSchema = z.object({
  /** On-page (effective) font size in points. */
  sizePt: z.number().positive().max(2_000),
  /** Fill colour as `#rrggbb`. */
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bold: z.boolean(),
  italic: z.boolean(),
  family: FontFamilySchema
})
export type TextStyle = z.infer<typeof TextStyleSchema>

/** A page-space rectangle (PDF user space, origin bottom-left). */
export const PageRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})
export type PageRect = z.infer<typeof PageRectSchema>

/** Asks which text object sits under a click on a page. */
export const LocateTextRequestSchema = z.object({
  bytes: PdfBytesSchema,
  pageIndex: z.number().int().nonnegative().max(MAX_PAGE_INDEX),
  /** Click position in PDF page space (origin bottom-left). */
  x: z.number().finite(),
  y: z.number().finite()
})
export type LocateTextRequest = z.infer<typeof LocateTextRequestSchema>

/** The located text object's current string, page-space rect, and style. */
export const LocatedTextSchema = z.object({
  text: z.string(),
  rect: PageRectSchema,
  style: TextStyleSchema
})
export type LocatedText = z.infer<typeof LocatedTextSchema>

/**
 * The desired style on a styled edit. `fontBytes` (a bundled .ttf) is present
 * only when the weight/slant/family changed — a size-only change reuses the
 * object's original font, and a colour/text-only change needs no style at all.
 */
export const EditStyleSchema = z.object({
  sizePt: z.number().positive().max(2_000),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontBytes: z
    .instanceof(Uint8Array)
    .refine((b) => b.byteLength <= MAX_FONT_BYTES, 'Font exceeds the size limit')
    .optional()
})
export type EditStyle = z.infer<typeof EditStyleSchema>

/** Replaces the text object under a click with `newText` (+ optional style). */
export const EditTextRequestSchema = z.object({
  bytes: PdfBytesSchema,
  pageIndex: z.number().int().nonnegative().max(MAX_PAGE_INDEX),
  x: z.number().finite(),
  y: z.number().finite(),
  newText: z.string().max(EDIT_TEXT_MAX),
  style: EditStyleSchema.optional()
})
export type EditTextRequest = z.infer<typeof EditTextRequestSchema>

// --- Tier-3 in-place image editing (PDFium) --------------------------------

/** A point on a page (shared by the locate-image request). */
export const LocateImageRequestSchema = z.object({
  bytes: PdfBytesSchema,
  pageIndex: z.number().int().nonnegative().max(MAX_PAGE_INDEX),
  x: z.number().finite(),
  y: z.number().finite()
})
export type LocateImageRequest = z.infer<typeof LocateImageRequestSchema>

/** The located image object's page-space rect. */
export const LocatedImageSchema = z.object({ rect: PageRectSchema })
export type LocatedImage = z.infer<typeof LocatedImageSchema>

const MAX_DIM = 100_000

/** A new axis-aligned placement rect for an image (PDF user space). */
const PositiveRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().max(MAX_DIM),
  height: z.number().finite().positive().max(MAX_DIM)
})

/** Moves/resizes or deletes the image object under a click. */
export const EditImageRequestSchema = z.object({
  bytes: PdfBytesSchema,
  pageIndex: z.number().int().nonnegative().max(MAX_PAGE_INDEX),
  x: z.number().finite(),
  y: z.number().finite(),
  op: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('transform'), rect: PositiveRectSchema }),
    z.object({ kind: z.literal('delete') })
  ])
})
export type EditImageRequest = z.infer<typeof EditImageRequestSchema>

// --- Digital signatures (PKI) ----------------------------------------------

const SIG_FIELD_MAX = 256

/**
 * Cryptographically signs the given PDF. The certificate (a `.p12`/`.pfx`) is
 * chosen via a native file dialog in the main process — its private key never
 * crosses this boundary. The passphrase unlocks it for this one operation.
 */
export const SignPdfRequestSchema = z.object({
  bytes: PdfBytesSchema,
  passphrase: z.string().max(1_024),
  reason: z.string().max(SIG_FIELD_MAX).optional(),
  name: z.string().max(SIG_FIELD_MAX).optional(),
  location: z.string().max(SIG_FIELD_MAX).optional(),
  contactInfo: z.string().max(SIG_FIELD_MAX).optional()
})
export type SignPdfRequest = z.infer<typeof SignPdfRequestSchema>

/** Asks the main process to verify a PDF's digital signatures. */
export const VerifySignaturesRequestSchema = z.object({ bytes: PdfBytesSchema })
export type VerifySignaturesRequest = z.infer<typeof VerifySignaturesRequestSchema>

/** The verification result for a single signature in a PDF. */
export const SignatureInfoSchema = z.object({
  signerName: z.string(),
  /** integrityIntact && signatureValid. */
  valid: z.boolean(),
  integrityIntact: z.boolean(),
  signatureValid: z.boolean(),
  coversWholeDocument: z.boolean(),
  signedAt: z.string().nullable(),
  certValidFrom: z.string().nullable(),
  certValidTo: z.string().nullable()
})
export type SignatureInfo = z.infer<typeof SignatureInfoSchema>
