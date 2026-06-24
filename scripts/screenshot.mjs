#!/usr/bin/env node
// Captures README screenshots by launching the built app under Playwright's
// Electron driver. Run `npm run build` first. Writes into docs/assets/.
import { _electron as electron } from '@playwright/test'
import { join } from 'node:path'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

const root = process.cwd()
const MAIN = join(root, 'out/main/index.js')
const FIXTURE = join(root, 'tests/fixtures/sample.pdf')
const OUT = join(root, 'docs/assets')
mkdirSync(OUT, { recursive: true })

async function shoot(name, args, ready) {
  const userData = mkdtempSync(join(tmpdir(), 'verso-shot-'))
  const app = await electron.launch({
    args: [MAIN, ...args],
    env: { ...process.env, VERSO_USER_DATA: userData }
  })
  const win = await app.firstWindow()
  await ready(win)
  await win.waitForTimeout(1200)
  await win.screenshot({ path: join(OUT, name) })
  await app.close()
  console.log(`[screenshot] wrote docs/assets/${name}`)
}

// Landing screen (logo + open action).
await shoot('home.png', [], (win) =>
  win.getByText('A calm place to read and edit PDFs.').waitFor({ timeout: 30_000 })
)

// Viewer with the sample document open.
await shoot('viewer.png', [FIXTURE], (win) =>
  win.locator('[data-page-number="1"] canvas').waitFor({ timeout: 30_000 })
)
