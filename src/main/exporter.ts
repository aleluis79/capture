import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { buildExportArgs, buildPartPath } from '@shared/export'
import { parseProgress, parseProgressLine } from '@shared/format'
import type { QualityPreset } from '@shared/types'

export type ExportErrorCode =
  'cancelled' | 'ffmpeg-missing' | 'no-space' | 'invalid-request' | 'ffmpeg-failed'

export class ExportError extends Error {
  constructor(
    message: string,
    readonly code: ExportErrorCode,
    readonly detail?: string
  ) {
    super(message)
    this.name = 'ExportError'
  }
}

export interface ExportRequest {
  exportId: string
  inputPath: string
  outputPath: string
  startMs: number
  endMs: number
  width: number
  height: number
  fps: number
  quality: QualityPreset
  normalizeAudio?: boolean
}

export interface ExportCallbacks {
  onProgress?: (percent: number) => void
}

export interface ExportResult {
  path: string
  sizeBytes: number
}

interface ExportJob {
  child: ChildProcessWithoutNullStreams
  partPath: string
  cancelled: boolean
}

export class Exporter {
  private readonly jobs = new Map<string, ExportJob>()

  constructor(private readonly ffmpegPath: string | null) {}

  isRunning(exportId: string): boolean {
    return this.jobs.has(exportId)
  }

  cancel(exportId: string): boolean {
    const job = this.jobs.get(exportId)
    if (!job || job.cancelled) {
      return false
    }

    job.cancelled = true
    if (process.platform === 'win32' && job.child.pid) {
      spawn('taskkill', ['/pid', String(job.child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      })
    } else {
      job.child.kill('SIGTERM')
    }
    return true
  }

  async run(request: ExportRequest, callbacks: ExportCallbacks = {}): Promise<ExportResult> {
    if (!this.ffmpegPath) {
      throw new ExportError(
        'No se encontró el componente de exportación (FFmpeg). Reinstala la aplicación.',
        'ffmpeg-missing'
      )
    }

    if (this.jobs.has(request.exportId)) {
      throw new ExportError('Ya hay una exportación en curso.', 'invalid-request')
    }

    let args: string[]
    try {
      args = buildExportArgs(request)
    } catch (error) {
      throw new ExportError(
        error instanceof Error ? error.message : 'La petición de exportación no es válida.',
        'invalid-request'
      )
    }

    await mkdir(dirname(request.outputPath), { recursive: true })

    const partPath = buildPartPath(request.outputPath)
    const child = spawn(this.ffmpegPath, args, {
      windowsHide: true
    }) as ChildProcessWithoutNullStreams

    const job: ExportJob = { child, partPath, cancelled: false }
    this.jobs.set(request.exportId, job)

    const durationMs = Math.max(1, request.endMs - request.startMs)

    return new Promise<ExportResult>((resolve, reject) => {
      let stderr = ''
      let stdoutBuffer = ''
      let settled = false

      const finishWithError = async (error: ExportError): Promise<void> => {
        if (settled) {
          return
        }
        settled = true
        this.jobs.delete(request.exportId)
        await rm(partPath, { force: true }).catch(() => undefined)
        reject(error)
      }

      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdoutBuffer += chunk
        const lines = stdoutBuffer.split(/\r?\n/)
        stdoutBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const outTimeMs = parseProgressLine(line)
          if (outTimeMs !== null) {
            callbacks.onProgress?.(parseProgress(outTimeMs * 1000, durationMs))
          }
        }
      })

      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => {
        stderr = (stderr + chunk).slice(-16_384)
      })

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          void finishWithError(
            new ExportError(
              'No se encontró el componente de exportación (FFmpeg). Reinstala la aplicación.',
              'ffmpeg-missing'
            )
          )
          return
        }
        void finishWithError(
          new ExportError('No se pudo iniciar la exportación.', 'ffmpeg-failed', error.message)
        )
      })

      child.on('close', (code) => {
        if (settled) {
          return
        }

        if (job.cancelled) {
          void finishWithError(new ExportError('Exportación cancelada.', 'cancelled'))
          return
        }

        if (code !== 0) {
          const noSpace = /no space left|enospc|not enough space/i.test(stderr)
          void finishWithError(
            noSpace
              ? new ExportError(
                  'No hay espacio suficiente en el disco para exportar el vídeo.',
                  'no-space',
                  stderr
                )
              : new ExportError('La exportación falló.', 'ffmpeg-failed', stderr)
          )
          return
        }

        settled = true
        this.jobs.delete(request.exportId)

        void (async () => {
          try {
            const info = await stat(partPath)
            await rm(request.outputPath, { force: true })
            await rename(partPath, request.outputPath)
            callbacks.onProgress?.(100)
            resolve({ path: request.outputPath, sizeBytes: info.size })
          } catch (error) {
            await rm(partPath, { force: true }).catch(() => undefined)
            reject(
              new ExportError(
                'No se pudo finalizar el archivo exportado.',
                'ffmpeg-failed',
                error instanceof Error ? error.message : String(error)
              )
            )
          }
        })()
      })
    })
  }
}
