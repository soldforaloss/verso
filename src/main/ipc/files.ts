import { BrowserWindow } from 'electron'
import { EmptyRequestSchema, PartialPreferencesSchema, ReadFileRequestSchema } from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import {
  clearRecentFiles,
  getPreferences,
  getRecentFiles,
  openFileDialog,
  readPdf,
  setPreferences
} from '../files'

/** Registers file/dialog/recent/preferences IPC handlers (M1). */
export function registerFileHandlers(): void {
  handle(IpcChannels.openFileDialog, EmptyRequestSchema, (_request, event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0]
    if (!window) throw new Error('No window available for the open dialog.')
    return openFileDialog(window)
  })

  handle(IpcChannels.readFile, ReadFileRequestSchema, (request) => readPdf(request.path))

  handle(IpcChannels.getRecentFiles, EmptyRequestSchema, () => getRecentFiles())
  handle(IpcChannels.clearRecentFiles, EmptyRequestSchema, () => clearRecentFiles())

  handle(IpcChannels.getPreferences, EmptyRequestSchema, () => getPreferences())
  handle(IpcChannels.setPreferences, PartialPreferencesSchema, (request) => setPreferences(request))
}
