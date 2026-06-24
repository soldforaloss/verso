import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const MAIN_ENTRY = join(__dirname, '../../out/main/index.js')
export const FIXTURE_PDF = join(__dirname, '../fixtures/sample.pdf')

/**
 * Launches the built Electron app with an isolated, throwaway userData dir so
 * persisted preferences/recents never leak between tests or into the real
 * profile. Extra CLI args (e.g. a PDF path) are forwarded.
 */
export function launchVerso(extraArgs: string[] = []): Promise<ElectronApplication> {
  const userData = mkdtempSync(join(tmpdir(), 'verso-e2e-'))
  return electron.launch({
    args: [MAIN_ENTRY, ...extraArgs],
    env: { ...process.env, VERSO_USER_DATA: userData }
  })
}
