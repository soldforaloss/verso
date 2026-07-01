import type { TransformPdfRequest } from '@shared/ipc'

/**
 * Builds the qpdf argument vector for a transform. Pure and deterministic (no
 * electron / fs imports) so it can be unit-tested without the binary present.
 * Keeping this separate is also the security boundary: the renderer can only
 * choose an operation and validated options — never a raw qpdf command line.
 */
export function buildQpdfArgs(
  request: TransformPdfRequest,
  inputPath: string,
  outputPath: string
): string[] {
  switch (request.operation) {
    case 'encrypt': {
      const { permissions } = request
      return [
        '--encrypt',
        request.userPassword,
        request.ownerPassword,
        '256',
        `--print=${permissions.printing ? 'full' : 'none'}`,
        `--modify=${permissions.modifying ? 'all' : 'none'}`,
        `--extract=${permissions.copying ? 'y' : 'n'}`,
        `--annotate=${permissions.annotating ? 'y' : 'n'}`,
        '--',
        inputPath,
        outputPath
      ]
    }
    case 'decrypt':
      return ['--decrypt', `--password=${request.password}`, inputPath, outputPath]
    case 'repair':
      // Reading and rewriting the file normalizes/recovers its structure.
      return [inputPath, outputPath]
    case 'linearize':
      return ['--linearize', inputPath, outputPath]
    case 'optimize':
      // Reduce file size: pack objects into compressed object streams and
      // re-deflate every stream at maximum effort. Structural only (qpdf never
      // touches image data), so it never degrades quality — it just squeezes
      // out the slack a generating tool left behind.
      return [
        '--object-streams=generate',
        '--compress-streams=y',
        '--recompress-flate',
        '--compression-level=9',
        // End option parsing so the temp paths are never mistaken for flags.
        '--',
        inputPath,
        outputPath
      ]
  }
}
