import type { ExportedFile, HistoryEntry, RecordingMode } from './types'

const MODES: RecordingMode[] = ['screen', 'window', 'region']

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isExport(value: unknown): value is ExportedFile {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    isNonEmptyString(candidate.path) &&
    isNonEmptyString(candidate.createdAt) &&
    isPositiveNumber(candidate.width) &&
    isPositiveNumber(candidate.height) &&
    isPositiveNumber(candidate.fps)
  )
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const isRecovered = candidate.status === 'recovered'
  const dimensionsValid = isRecovered
    ? isNonNegativeNumber(candidate.width) && isNonNegativeNumber(candidate.height)
    : isPositiveNumber(candidate.width) && isPositiveNumber(candidate.height)

  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.createdAt) &&
    isNonNegativeNumber(candidate.durationMs) &&
    isNonNegativeNumber(candidate.sizeBytes) &&
    dimensionsValid &&
    isPositiveNumber(candidate.fps) &&
    MODES.includes(candidate.mode as RecordingMode) &&
    isNonEmptyString(candidate.sourcePath) &&
    (candidate.thumbPath === null || isNonEmptyString(candidate.thumbPath)) &&
    Array.isArray(candidate.exports) &&
    (candidate.status === 'complete' || candidate.status === 'recovered')
  )
}

function sanitizeExports(value: unknown): ExportedFile[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isExport)
}

export function sortEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function sanitizeHistory(input: unknown): HistoryEntry[] {
  if (!Array.isArray(input)) {
    return []
  }

  const valid = input.filter(isHistoryEntry).map((entry) => ({
    ...entry,
    exports: sanitizeExports(entry.exports)
  }))

  return sortEntries(valid)
}

export function addHistoryEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries.filter((existing) => existing.id !== entry.id)]
}

export function removeHistoryEntry(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

export function findEntry(entries: HistoryEntry[], id: string): HistoryEntry | null {
  return entries.find((entry) => entry.id === id) ?? null
}

export function addExportToEntry(
  entries: HistoryEntry[],
  id: string,
  exported: ExportedFile
): HistoryEntry[] {
  return entries.map((entry) =>
    entry.id === id ? { ...entry, exports: [...entry.exports, exported] } : entry
  )
}

export function totalSize(entries: HistoryEntry[]): number {
  return entries.reduce((total, entry) => total + entry.sizeBytes, 0)
}

export function cleanupCandidates(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.filter((entry) => entry.exports.length > 0)
}

export function hasSource(entries: HistoryEntry[], id: string): boolean {
  const entry = findEntry(entries, id)
  return entry !== null && entry.sourcePath.length > 0
}
