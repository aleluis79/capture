import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface FfmpegPathOptions {
  isPackaged: boolean
  resourcesPath: string
  platform: string
  devPath: string | null
}

export function resolveFfmpegPath(options: FfmpegPathOptions): string | null {
  if (options.isPackaged) {
    const name = options.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const candidate = join(options.resourcesPath, 'ffmpeg', name)
    return existsSync(candidate) ? candidate : null
  }

  if (options.devPath && existsSync(options.devPath)) {
    return options.devPath
  }

  return null
}

export interface MediaProbe {
  durationMs: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
}

function runCapture(
  binary: string,
  args: string[]
): Promise<{ code: number | null; stderr: string; spawnError: NodeJS.ErrnoException | null }> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, { windowsHide: true })
    let stderr = ''
    let spawnError: NodeJS.ErrnoException | null = null

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-32_768)
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      spawnError = error
    })

    child.on('close', (code) => {
      resolve({ code, stderr, spawnError })
    })
  })
}

export async function probeMedia(ffmpegPath: string, filePath: string): Promise<MediaProbe | null> {
  const { stderr, spawnError } = await runCapture(ffmpegPath, ['-hide_banner', '-i', filePath])

  if (spawnError) {
    return null
  }

  const durationMatch = /Duration:\s(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
  const lines = stderr.split('\n')
  const videoLine = lines.find((line) => line.includes('Stream #') && line.includes('Video:'))
  const hasAudio = lines.some((line) => line.includes('Stream #') && line.includes('Audio:'))

  if (!durationMatch || !videoLine) {
    return null
  }

  const dimensions = /,\s(\d{2,5})x(\d{2,5})(?:[\s,]|$)/.exec(videoLine)
  if (!dimensions) {
    return null
  }

  const fpsMatch = /(\d+(?:\.\d+)?)\s*fps/.exec(videoLine)
  const durationMs =
    (Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])) *
    1000

  return {
    durationMs: Math.round(durationMs),
    width: Number(dimensions[1]),
    height: Number(dimensions[2]),
    fps: fpsMatch ? Math.round(Number(fpsMatch[1])) : 0,
    hasAudio
  }
}

export async function extractThumbnail(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  atMs = 500
): Promise<boolean> {
  const { code, spawnError } = await runCapture(ffmpegPath, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-ss',
    (atMs / 1000).toFixed(3),
    '-frames:v',
    '1',
    '-vf',
    'scale=320:-2',
    '-q:v',
    '3',
    outputPath
  ])

  return !spawnError && code === 0 && existsSync(outputPath)
}
