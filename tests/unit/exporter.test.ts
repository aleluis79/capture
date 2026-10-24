import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ExportError, Exporter } from '@main/exporter'
import { FFMPEG_PATH, createTestWebm, measureMeanVolume, probeMedia } from '../helpers/media'

let workDir: string
let sourcePath: string

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'captura-exporter-fixture-'))
  sourcePath = join(workDir, 'source.webm')
  createTestWebm(sourcePath, { durationSec: 3, width: 640, height: 360, fps: 30 })
})

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true })
})

afterEach(() => {
  // cada test limpia sus propias salidas
})

function request(overrides: Partial<Parameters<Exporter['run']>[0]> = {}) {
  const id = `export-${Math.random().toString(36).slice(2)}`
  return {
    exportId: id,
    inputPath: sourcePath,
    outputPath: join(workDir, `${id}.mp4`),
    startMs: 0,
    endMs: 3000,
    width: 320,
    height: 240,
    fps: 30,
    quality: 'medium' as const,
    ...overrides
  }
}

describe('Exporter', () => {
  it('exporta un MP4 H.264 con la resolución, FPS y duración pedidos', async () => {
    const exporter = new Exporter(FFMPEG_PATH)
    const options = request()
    const onProgress: number[] = []

    const result = await exporter.run(options, {
      onProgress: (percent) => onProgress.push(percent)
    })

    expect(result.path).toBe(options.outputPath)
    expect(existsSync(options.outputPath)).toBe(true)
    expect(existsSync(options.outputPath.replace(/\.mp4$/, '.part.mp4'))).toBe(false)

    const info = probeMedia(options.outputPath)
    expect(info.width).toBe(320)
    expect(info.height).toBe(240)
    expect(info.fps).toBe(30)
    expect(info.videoCodec).toBe('h264')
    expect(info.hasAudio).toBe(false)
    expect(info.durationMs).toBeGreaterThan(2_500)
    expect(info.durationMs).toBeLessThan(3_500)
    expect(onProgress.some((percent) => percent > 0)).toBe(true)
  })

  it('conserva la pista de audio en AAC cuando el archivo intermedio tiene sonido', async () => {
    const audioSource = join(workDir, 'source-with-audio.webm')
    createTestWebm(audioSource, {
      durationSec: 2,
      width: 640,
      height: 360,
      fps: 30,
      withAudio: true
    })

    const exporter = new Exporter(FFMPEG_PATH)
    const options = request({ inputPath: audioSource, endMs: 2000 })
    await exporter.run(options)

    const info = probeMedia(options.outputPath)
    expect(info.videoCodec).toBe('h264')
    expect(info.hasAudio).toBe(true)
  })

  it('sube el nivel del audio con la normalización activa', async () => {
    const quietSource = join(workDir, 'quiet.webm')
    createTestWebm(quietSource, {
      durationSec: 2,
      width: 640,
      height: 360,
      fps: 30,
      withAudio: true,
      audioVolume: 0.05
    })

    const exporter = new Exporter(FFMPEG_PATH)
    const plain = request({
      inputPath: quietSource,
      outputPath: join(workDir, 'plain.mp4'),
      endMs: 2000,
      normalizeAudio: false
    })
    await exporter.run(plain)

    const normalized = request({
      inputPath: quietSource,
      outputPath: join(workDir, 'normalized.mp4'),
      endMs: 2000,
      normalizeAudio: true
    })
    await exporter.run(normalized)

    const plainLevel = measureMeanVolume(plain.outputPath)
    const normalizedLevel = measureMeanVolume(normalized.outputPath)

    expect(normalizedLevel).toBeGreaterThan(plainLevel + 3)
  })

  it('aplica el recorte de inicio y fin', async () => {
    const exporter = new Exporter(FFMPEG_PATH)
    const options = request({ startMs: 500, endMs: 1500 })

    await exporter.run(options)

    const info = probeMedia(options.outputPath)
    expect(info.durationMs).toBeGreaterThan(700)
    expect(info.durationMs).toBeLessThan(1_400)
  })

  it('crea la carpeta de salida si no existe', async () => {
    const exporter = new Exporter(FFMPEG_PATH)
    const outputPath = join(workDir, 'sub', 'carpeta', 'salida.mp4')

    await exporter.run(request({ outputPath }))

    expect(existsSync(outputPath)).toBe(true)
  })

  it('rechaza peticiones inválidas sin dejar archivos', async () => {
    const exporter = new Exporter(FFMPEG_PATH)
    const options = request({ width: 321 })
    const partPath = options.outputPath.replace(/\.mp4$/, '.part.mp4')

    await expect(exporter.run(options)).rejects.toThrow()
    expect(existsSync(options.outputPath)).toBe(false)
    expect(existsSync(partPath)).toBe(false)
  })

  it('cancela la exportación, limpia el parcial y conserva el original', async () => {
    const exporter = new Exporter(FFMPEG_PATH)
    const options = request({
      width: 1920,
      height: 1080,
      fps: 120,
      endMs: 3000
    })
    const partPath = options.outputPath.replace(/\.mp4$/, '.part.mp4')

    const promise = exporter.run(options)

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(exporter.isRunning(options.exportId)).toBe(true)
    expect(exporter.cancel(options.exportId)).toBe(true)

    await expect(promise).rejects.toMatchObject({ code: 'cancelled' })

    expect(existsSync(options.outputPath)).toBe(false)
    expect(existsSync(partPath)).toBe(false)
    expect(statSync(sourcePath).size).toBeGreaterThan(0)
    expect(exporter.isRunning(options.exportId)).toBe(false)
  })

  it('informa si no hay binario de FFmpeg', async () => {
    const exporter = new Exporter(null)
    await expect(exporter.run(request())).rejects.toMatchObject({
      code: 'ffmpeg-missing'
    })
  })

  it('marca el error de cancelación como ExportError', async () => {
    const exporter = new Exporter(FFMPEG_PATH)
    const options = request({ width: 1920, height: 1080, fps: 120 })

    const promise = exporter.run(options)
    await new Promise((resolve) => setTimeout(resolve, 50))
    exporter.cancel(options.exportId)

    await expect(promise).rejects.toBeInstanceOf(ExportError)
  })
})
