#!/usr/bin/env node
// Downloads the qpdf sidecar (Apache-2.0) into resources/bin so Verso's
// security features (encrypt/decrypt/repair/linearize) work in dev and get
// bundled by electron-builder. The binaries are NOT committed (see .gitignore);
// run `npm run fetch:qpdf` once, or let CI/release do it.
//
// qpdf does not publish macOS binaries — on macOS install via Homebrew
// (`brew install qpdf`); Verso resolves qpdf from PATH as a fallback.
import { mkdirSync, rmSync, existsSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const VERSION = process.env.QPDF_VERSION || '12.3.2'
const force = process.argv.includes('--force')
const root = process.cwd()
const destDir = join(root, 'resources', 'bin')

function targetForPlatform() {
  if (process.platform === 'win32') {
    return { asset: `qpdf-${VERSION}-msvc64.zip`, inner: `qpdf-${VERSION}-msvc64/bin`, exe: 'qpdf.exe' }
  }
  if (process.platform === 'linux') {
    return {
      asset: `qpdf-${VERSION}-bin-linux-x86_64.zip`,
      inner: `qpdf-${VERSION}-bin-linux-x86_64/bin`,
      exe: 'qpdf'
    }
  }
  return null
}

function extract(zipPath, outDir) {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${outDir}" -Force`],
      { stdio: 'inherit' }
    )
  } else {
    execFileSync('unzip', ['-o', zipPath, '-d', outDir], { stdio: 'inherit' })
  }
}

async function main() {
  const target = targetForPlatform()
  if (!target) {
    console.log('[fetch-qpdf] No prebuilt qpdf for macOS. Install with: brew install qpdf')
    return
  }

  const exePath = join(destDir, target.exe)
  if (existsSync(exePath) && !force) {
    console.log(`[fetch-qpdf] ${exePath} already present (use --force to refresh).`)
    return
  }

  const url = `https://github.com/qpdf/qpdf/releases/download/v${VERSION}/${target.asset}`
  console.log(`[fetch-qpdf] Downloading ${url}`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`)

  const work = join(tmpdir(), `verso-qpdf-${Date.now()}`)
  mkdirSync(work, { recursive: true })
  const zipPath = join(work, target.asset)
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()))

  console.log('[fetch-qpdf] Extracting…')
  extract(zipPath, work)

  const binDir = join(work, target.inner)
  if (!existsSync(binDir)) throw new Error(`Expected ${binDir} in the archive.`)

  mkdirSync(destDir, { recursive: true })
  let copied = 0
  for (const entry of readdirSync(binDir)) {
    copyFileSync(join(binDir, entry), join(destDir, entry))
    copied += 1
  }
  rmSync(work, { recursive: true, force: true })
  console.log(`[fetch-qpdf] Installed ${copied} files into resources/bin (qpdf ${VERSION}).`)
}

main().catch((error) => {
  console.error('[fetch-qpdf]', error.message)
  process.exit(1)
})
