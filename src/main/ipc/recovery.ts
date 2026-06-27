import { EmptyRequestSchema, RecoveryIdRequestSchema, RecoverySaveRequestSchema } from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { discardRecovery, listRecovery, readRecovery, saveRecovery } from '../recovery'

/** Registers crash-recovery IPC handlers (autosave snapshots in userData). */
export function registerRecoveryHandlers(): void {
  handle(IpcChannels.recoverySave, RecoverySaveRequestSchema, (request) => saveRecovery(request))
  handle(IpcChannels.recoveryList, EmptyRequestSchema, () => listRecovery())
  handle(IpcChannels.recoveryRead, RecoveryIdRequestSchema, (request) => readRecovery(request.id))
  handle(IpcChannels.recoveryDiscard, RecoveryIdRequestSchema, (request) =>
    discardRecovery(request.id)
  )
}
