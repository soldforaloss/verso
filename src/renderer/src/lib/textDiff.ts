/**
 * Word-level text diff (LCS-based). Pure and unit-tested. Tokenizes on
 * whitespace, finds the longest common subsequence of words, and emits a
 * sequence of same / added / removed runs (consecutive same-type words merged).
 */
export type DiffType = 'same' | 'add' | 'remove'

export interface DiffRun {
  type: DiffType
  text: string
}

export interface DiffSummary {
  runs: DiffRun[]
  added: number
  removed: number
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export function diffWords(before: string, after: string): DiffSummary {
  const a = tokenize(before)
  const b = tokenize(after)
  const n = a.length
  const m = b.length

  // LCS lengths table (n+1 × m+1), filled from the bottom-right.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  const tokens: { type: DiffType; word: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ type: 'same', word: a[i]! })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      tokens.push({ type: 'remove', word: a[i]! })
      i += 1
    } else {
      tokens.push({ type: 'add', word: b[j]! })
      j += 1
    }
  }
  while (i < n) {
    tokens.push({ type: 'remove', word: a[i]! })
    i += 1
  }
  while (j < m) {
    tokens.push({ type: 'add', word: b[j]! })
    j += 1
  }

  // Merge consecutive same-type runs into single text spans.
  const runs: DiffRun[] = []
  let added = 0
  let removed = 0
  for (const token of tokens) {
    if (token.type === 'add') added += 1
    if (token.type === 'remove') removed += 1
    const last = runs[runs.length - 1]
    if (last && last.type === token.type) last.text += ` ${token.word}`
    else runs.push({ type: token.type, text: token.word })
  }

  return { runs, added, removed }
}
