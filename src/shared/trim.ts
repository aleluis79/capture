export const MIN_TRIM_MS = 100

export type TrimError = 'invalid-order' | 'too-short' | 'empty-recording'

export type TrimValidation =
  { valid: true; startMs: number; endMs: number } | { valid: false; error: TrimError }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function validateTrim(startMs: number, endMs: number, durationMs: number): TrimValidation {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { valid: false, error: 'empty-recording' }
  }

  const safeStart = Number.isFinite(startMs) ? startMs : 0
  const safeEnd = Number.isFinite(endMs) ? endMs : durationMs

  const start = clamp(safeStart, 0, durationMs)
  const end = clamp(safeEnd, 0, durationMs)

  if (end <= start) {
    return { valid: false, error: 'invalid-order' }
  }

  if (end - start < MIN_TRIM_MS) {
    return { valid: false, error: 'too-short' }
  }

  return { valid: true, startMs: start, endMs: end }
}
