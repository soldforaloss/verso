import { EmptyRequestSchema, TransformPdfRequestSchema } from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { getSecurityStatus, transformPdf } from '../qpdf'

/** Registers the qpdf-backed security handlers (M8). */
export function registerSecurityHandlers(): void {
  handle(IpcChannels.getSecurityStatus, EmptyRequestSchema, () => getSecurityStatus())
  handle(IpcChannels.transformPdf, TransformPdfRequestSchema, (request) => transformPdf(request))
}
