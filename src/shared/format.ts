function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${minutes}:${pad(seconds)}`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  if (bytes < 1024) {
    return `${Math.floor(bytes)} B`
  }

  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1).replace('.', ',')} ${BYTE_UNITS[unitIndex]}`
}

export function buildOutputFilename(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `captura-${year}-${month}-${day}_${hours}-${minutes}-${seconds}.mp4`
}

export function parseProgress(outTimeUs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(outTimeUs)) {
    return 0
  }

  const percent = (outTimeUs / 1000 / durationMs) * 100
  const clamped = Math.min(100, Math.max(0, percent))
  return Math.round(clamped * 10) / 10
}

export function parseProgressLine(line: string): number | null {
  const match = /^out_time_us=(-?\d+)\s*$/.exec(line.trim())
  if (!match) {
    return null
  }

  const value = Number(match[1])
  if (!Number.isFinite(value)) {
    return null
  }

  return value / 1000
}
