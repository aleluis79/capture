import type { QualityPreset } from './types'

export interface QualityProfile {
  crf: number
  bitsPerPixel: number
  label: string
}

export const QUALITY_PROFILES: Record<QualityPreset, QualityProfile> = {
  high: { crf: 18, bitsPerPixel: 0.12, label: 'Alta' },
  medium: { crf: 21, bitsPerPixel: 0.075, label: 'Media' },
  low: { crf: 24, bitsPerPixel: 0.045, label: 'Baja' }
}

const MIN_BITRATE = 1_000_000
const MAX_BITRATE = 50_000_000
const BITRATE_STEP = 100_000

export function crfForQuality(quality: QualityPreset): number {
  return QUALITY_PROFILES[quality].crf
}

interface BitrateOptions {
  width: number
  height: number
  fps: number
  quality: QualityPreset
}

export function bitrateFor({ width, height, fps, quality }: BitrateOptions): number {
  const pixels = Math.max(1, Math.floor(width)) * Math.max(1, Math.floor(height))
  const frames = Math.max(1, fps)
  const raw = pixels * frames * QUALITY_PROFILES[quality].bitsPerPixel
  const clamped = Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, raw))
  return Math.round(clamped / BITRATE_STEP) * BITRATE_STEP
}
