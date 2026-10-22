import { crfForQuality } from './quality'
import type { QualityPreset } from './types'

export interface ExportArgsInput {
  inputPath: string
  outputPath: string
  startMs: number
  endMs: number | null
  width: number
  height: number
  fps: number
  quality: QualityPreset
}

export function buildPartPath(outputPath: string): string {
  if (/\.mp4$/i.test(outputPath)) {
    return outputPath.replace(/\.mp4$/i, '.part.mp4')
  }
  return `${outputPath}.part.mp4`
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3)
}

function formatFps(fps: number): string {
  return Number.isInteger(fps) ? String(fps) : String(Number(fps.toFixed(3)))
}

export function buildVideoFilter(width: number, height: number, fps: number): string {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    'setsar=1',
    `fps=${formatFps(fps)}`,
    'format=yuv420p'
  ].join(',')
}

export function buildExportArgs(input: ExportArgsInput): string[] {
  const { inputPath, outputPath, startMs, endMs, width, height, fps, quality } = input

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error('La resolución de salida no es válida')
  }
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error('La resolución de salida debe tener dimensiones pares')
  }
  if (!Number.isFinite(fps) || fps <= 0 || fps > 120) {
    throw new Error('El FPS de salida no es válido')
  }
  if (!Number.isFinite(startMs) || startMs < 0) {
    throw new Error('El inicio del recorte no es válido')
  }
  if (endMs !== null && (!Number.isFinite(endMs) || endMs <= startMs)) {
    throw new Error('El fin del recorte debe ser mayor que el inicio')
  }

  const args = [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-nostats',
    '-i',
    inputPath
  ]

  if (startMs > 0) {
    args.push('-ss', seconds(startMs))
  }

  if (endMs !== null) {
    args.push('-t', seconds(endMs - startMs))
  }

  args.push(
    '-vf',
    buildVideoFilter(width, height, fps),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(crfForQuality(quality)),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    '-y',
    buildPartPath(outputPath)
  )

  return args
}
