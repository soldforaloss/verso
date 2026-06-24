import { BrowserWindow } from 'electron'
import {
  EmptyRequestSchema,
  PartialPreferencesSchema,
  ReadFileRequestSchema,
  SaveDialogRequestSchema,
  WriteFileRequestSchema,
  WriteInDirRequestSchema
} from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import {
  clearRecentFiles,
  getPreferences,
  getRecentFiles,
  openFileDialog,
  readPdf,
  selectDirectory,
  setPreferences,
  showSaveDialog,
  writePdf,
  writePdfInDir
} from '../files'

function windowFor(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0]
  if (!window) throw new Error('No window available for the dialog.')
  return window
}

/** Registers file/dialog/recent/preferences/save IPC handlers. */
export function registerFileHandlers(): void {
  handle(IpcChannels.openFileDialog, EmptyRequestSchema, (_request, event) =>
    openFileDialog(windowFor(event))
  )

  handle(IpcChannels.readFile, ReadFileRequestSchema, (request) => readPdf(request.path))

  handle(IpcChannels.getRecentFiles, EmptyRequestSchema, () => getRecentFiles())
  handle(IpcChannels.clearRecentFiles, EmptyRequestSchema, () => clearRecentFiles())

  handle(IpcChannels.getPreferences, EmptyRequestSchema, () => getPreferences())
  handle(IpcChannels.setPreferences, PartialPreferencesSchema, (request) => setPreferences(request))

  handle(IpcChannels.showSaveDialog, SaveDialogRequestSchema, (request, event) =>
    showSaveDialog(windowFor(event), request.defaultName)
  )
  handle(IpcChannels.selectDirectory, EmptyRequestSchema, (_request, event) =>
    selectDirectory(windowFor(event))
  )
  handle(IpcChannels.writeFile, WriteFileRequestSchema, (request) =>
    writePdf(request.path, request.bytes)
  )
  handle(IpcChannels.writeFileInDir, WriteInDirRequestSchema, (request) =>
    writePdfInDir(request.dir, request.name, request.bytes)
  )
}
