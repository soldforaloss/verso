import { PrintPdfRequestSchema } from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { printPdf } from '../print'

/** Registers the print handler (M8). */
export function registerPrintHandlers(): void {
  handle(IpcChannels.printPdf, PrintPdfRequestSchema, (request) => printPdf(request))
}
