import { EditTextRequestSchema, LocateTextRequestSchema } from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { editText, locateText } from '../pdfiumEdit'

/** Registers the Tier-3 PDFium true-text-editing handlers. */
export function registerEditingHandlers(): void {
  handle(IpcChannels.pdfiumLocateText, LocateTextRequestSchema, (request) => locateText(request))
  handle(IpcChannels.pdfiumEditText, EditTextRequestSchema, (request) => editText(request))
}
