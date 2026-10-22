import { spawnSync } from 'node:child_process'
import ffmpegStatic from 'ffmpeg-static'

export const FFMPEG_PATH = ffmpegStatic as string

export interface TestVideoOptions {
  durationSec?: number
  width?: number
  height?: number
  fps?: number
}

export interface MediaInfo {
  durationMs: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
  videoCodec: string | null
}

export function createTestWebm(outputPath: string, options: TestVideoOptions = {}): void {
  const { durationSec = 2, width = 640, height = 360, fps = 30 } = options
  const result = spawnSync(
    FFMPEG_PATH,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${width}x${height}:rate=${fps}`,
      '-t',
      String(durationSec),
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '1M',
      '-pix_fmt',
      'yuv420p',
      outputPath
    ],
    { encoding: 'utf8' }
  )

  if (result.status !== 0) {
    throw new Error(`No se pudo generar el vídeo de prueba: ${result.stderr}`)
  }
}

export function probeMedia(filePath: string): MediaInfo {
  const result = spawnSync(FFMPEG_PATH, ['-hide_banner', '-i', filePath], {
    encoding: 'utf8'
  })
  const output = result.stderr

  const durationMatch = /Duration:\s(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output)
  if (!durationMatch) {
    throw new Error(`No se pudo leer la duración de ${filePath}: ${output}`)
  }

  const durationMs =
    (Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])) *
    1000

  const videoLine = output
    .split('\n')
    .find((line) => line.includes('Stream #') && line.includes('Video:'))
  if (!videoLine) {
    throw new Error(`No se encontró pista de vídeo en ${filePath}: ${output}`)
  }

  const dimensions = /,\s(\d{2,5})x(\d{2,5})(?:[\s,]|$)/.exec(videoLine)
  if (!dimensions) {
    throw new Error(`No se pudieron leer las dimensiones de ${filePath}: ${videoLine}`)
  }

  const fpsMatch = /(\d+(?:\.\d+)?)\s*fps/.exec(videoLine)
  const codecMatch = /Video:\s([a-z0-9]+)/i.exec(videoLine)

  return {
    durationMs,
    width: Number(dimensions[1]),
    height: Number(dimensions[2]),
    fps: fpsMatch ? Number(fpsMatch[1]) : 0,
    hasAudio: output.includes('Audio:'),
    videoCodec: codecMatch ? codecMatch[1] : null
  }
}
