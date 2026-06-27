import {
  app,
  Menu,
  shell,
  dialog,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'
import { checkForUpdatesInteractive } from './updater'

const HOMEPAGE = 'https://versoeditor.com'
const REPOSITORY = 'https://github.com/soldforaloss/verso'

/**
 * Builds and installs the native application menu.
 *
 * Only items that are fully functional today are included; feature menus
 * (Open/Save, page operations, annotation tools, …) are added in their own
 * milestones so the menu never advertises a capability that does not exist.
 */
export function installApplicationMenu(window: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged

  const showAbout = (): void => {
    void dialog.showMessageBox(window, {
      type: 'info',
      title: 'About Verso',
      message: 'Verso',
      detail:
        `Version ${app.getVersion()}\n` +
        `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}\n\n` +
        'A fast, private, open-source PDF viewer and editor.\n' +
        'No telemetry. Everything stays on your device.',
      buttons: ['OK'],
      noLink: true
    })
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: '&File',
      // Route Quit through window.close() (not role:'quit'/app.quit) so the
      // unsaved-changes guard and crash-recovery cleanup run, instead of a bare
      // app quit that bypasses both.
      submenu: [
        isMac
          ? { role: 'close' }
          : { label: 'Quit', accelerator: 'Ctrl+Q', click: () => window.close() }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '&View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev
          ? ([
              { type: 'separator' },
              { role: 'reload' },
              { role: 'toggleDevTools' }
            ] as MenuItemConstructorOptions[])
          : [])
      ]
    },
    {
      label: '&Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([{ type: 'separator' }, { role: 'front' }] as MenuItemConstructorOptions[])
          : ([{ role: 'close' }] as MenuItemConstructorOptions[]))
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Verso Website',
          click: () => void shell.openExternal(HOMEPAGE)
        },
        {
          label: 'Source Code (GitHub)',
          click: () => void shell.openExternal(REPOSITORY)
        },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => checkForUpdatesInteractive(window) },
        { label: 'About Verso', click: showAbout }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
