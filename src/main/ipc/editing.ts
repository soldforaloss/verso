import {
  EditImageRequestSchema,
  EditTextRequestSchema,
  LocateImageRequestSchema,
  LocateTextRequestSchema
} from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { editImage, editText, locateImage, locateText } from '../pdfiumEdit'

/** Registers the Tier-3 PDFium content-editing handlers (text + images). */
export function registerEditingHandlers(): void {
  handle(IpcChannels.pdfiumLocateText, LocateTextRequestSchema, (request) => locateText(request))
  handle(IpcChannels.pdfiumEditText, EditTextRequestSchema, (request) => editText(request))
  handle(IpcChannels.pdfiumLocateImage, LocateImageRequestSchema, (request) => locateImage(request))
  handle(IpcChannels.pdfiumEditImage, EditImageRequestSchema, (request) => editImage(request))
}
