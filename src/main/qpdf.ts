import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { app } from 'electron'
import log from 'electron-log/main'
import type { SecurityStatus, TransformPdfRequest } from '@shared/ipc'
import { buildQpdfArgs } from './qpdfArgs'

export { buildQpdfArgs }

/**
 * Thin wrapper around the bundled **qpdf** sidecar (Apache-2.0). qpdf handles
 * the PDF security operations pdf-lib cannot: real 256-bit AES encryption,
 * password removal, structural repair, and linearization.
 *
 * The renderer never supplies raw arguments — every flag is built here from a
 * validated request, the binary path is resolved only from trusted locations,
 * and qpdf runs on temp files (no shell), so a hostile renderer cannot turn
 * this into arbitrary command execution.
 */

const MAX_PDF_BYTES = 512 * 1024 * 1024
const BINARY = process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'

let resolvedBinary: string | null = null

/** Locates the qpdf binary, preferring a bundled copy, falling back to PATH. */
function binary(): string {
  if (resolvedBinary) return resolvedBinary
  const candidates = [
    process.env['QPDF_PATH'],
    join(process.resourcesPath, 'bin', BINARY), // packaged (extraResources)
    join(app.getAppPath(), 'resources', 'bin', BINARY), // dev / unpacked
    join(process.cwd(), 'resources', 'bin', BINARY)
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      resolvedBinary = candidate
      return candidate
    }
  }
  // Last resort: rely on PATH (bare command; availability decided by --version).
  resolvedBinary = 'qpdf'
  return resolvedBinary
}

function runQpdf(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary(), args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => reject(error)) // ENOENT when qpdf is missing
    child.on('close', (code) => {
      // qpdf: 0 = success, 3 = success with warnings, 2 = error.
      if (code === 0 || code === 3) resolve(stdout)
      else reject(new Error(stderr.trim() || `qpdf exited with code ${code}`))
    })
  })
}

/** Reports whether qpdf is runnable and, if so, its version string. */
export async function getSecurityStatus(): Promise<SecurityStatus> {
  try {
    const out = await runQpdf(['--version'])
    const match = out.match(/qpdf version ([\d.]+)/i)
    return { available: true, version: match ? match[1]! : out.trim().split('\n')[0]! }
  } catch (error) {
    log.info('[qpdf] sidecar unavailable:', error instanceof Error ? error.message : error)
    return { available: false, version: null }
  }
}

/** Runs a transform on the given bytes via temp files and returns the result. */
export async function transformPdf(request: TransformPdfRequest): Promise<Uint8Array> {
  if (request.bytes.length === 0) throw new Error('Nothing to transform.')
  if (request.bytes.length > MAX_PDF_BYTES) throw new Error('File is too large.')

  const dir = tmpdir()
  const inputPath = join(dir, `verso-${randomUUID()}.pdf`)
  const outputPath = join(dir, `verso-${randomUUID()}.pdf`)
  await writeFile(inputPath, request.bytes)
  try {
    await runQpdf(buildQpdfArgs(request, inputPath, outputPath))
    return new Uint8Array(await readFile(outputPath))
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}
