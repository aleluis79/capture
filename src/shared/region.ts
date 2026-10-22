import type { Point, Region, ResolutionPreset, Size } from './types'

export const MIN_REGION_SIZE = 16

const PRESET_DIMENSIONS: Record<Exclude<ResolutionPreset, 'native' | 'custom'>, Size> = {
  '2160p': { width: 3840, height: 2160 },
  '1440p': { width: 2560, height: 1440 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 }
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0
}

function even(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2)
}

export function normalizeRegion(region: Region, bounds: Size): Region {
  const boundsWidth = Math.max(0, round(bounds.width))
  const boundsHeight = Math.max(0, round(bounds.height))

  const rawX = round(region.x)
  const rawY = round(region.y)

  const left = Math.min(Math.max(rawX, 0), boundsWidth)
  const top = Math.min(Math.max(rawY, 0), boundsHeight)
  const right = Math.min(Math.max(rawX + round(region.width), left), boundsWidth)
  const bottom = Math.min(Math.max(rawY + round(region.height), top), boundsHeight)

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  }
}

export function toEvenDimensions(size: Size): Size {
  return {
    width: even(round(size.width)),
    height: even(round(size.height))
  }
}

export function isValidRegion(region: Region): boolean {
  return region.width >= MIN_REGION_SIZE && region.height >= MIN_REGION_SIZE
}

export function regionFromPoints(start: Point, end: Point): Region {
  const x = Math.min(round(start.x), round(end.x))
  const y = Math.min(round(start.y), round(end.y))
  return {
    x,
    y,
    width: Math.abs(round(end.x) - round(start.x)),
    height: Math.abs(round(end.y) - round(start.y))
  }
}

interface ResolveOutputOptions {
  preset: ResolutionPreset
  source: Size
  customWidth?: number
  customHeight?: number
}

export function resolveOutputDimensions(options: ResolveOutputOptions): Size {
  const { preset, source, customWidth = 0, customHeight = 0 } = options

  if (preset === 'native') {
    return toEvenDimensions(source)
  }

  if (preset === 'custom') {
    const validCustom =
      Number.isFinite(customWidth) &&
      Number.isFinite(customHeight) &&
      customWidth >= 2 &&
      customHeight >= 2
    return toEvenDimensions(validCustom ? { width: customWidth, height: customHeight } : source)
  }

  return { ...PRESET_DIMENSIONS[preset] }
}

export function computeCropRect(region: Region, source: Size): Region | null {
  const normalized = normalizeRegion(region, source)
  if (!isValidRegion(normalized)) {
    return null
  }

  const dimensions = toEvenDimensions(normalized)
  return {
    x: normalized.x,
    y: normalized.y,
    width: dimensions.width,
    height: dimensions.height
  }
}
