import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractThumbnail, probeMedia, resolveFfmpegPath } from '@main/ffmpeg'
import { FFMPEG_PATH, createTestWebm } from '../helpers/media'

let workDir: string
let sourcePath: string

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'captura-ffmpeg-'))
  sourcePath = join(workDir, 'source.webm')
  createTestWebm(sourcePath, { durationSec: 2, width: 640, height: 360, fps: 30 })
})

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('resolveFfmpegPath', () => {
  it('usa el binario de recursos en una app empaquetada', () => {
    const resources = join(workDir, 'resources')
    const binary = join(resources, 'ffmpeg', 'ffmpeg')
    mkdirSync(join(resources, 'ffmpeg'), { recursive: true })
    writeFileSync(binary, 'binario')

    expect(
      resolveFfmpegPath({
        isPackaged: true,
        resourcesPath: resources,
        platform: 'linux',
        devPath: null
      })
    ).toBe(binary)
  })

  it('busca ffmpeg.exe en Windows', () => {
    const resources = join(workDir, 'resources-win')
    const binary = join(resources, 'ffmpeg', 'ffmpeg.exe')
    mkdirSync(join(resources, 'ffmpeg'), { recursive: true })
    writeFileSync(binary, 'binario')

    expect(
      resolveFfmpegPath({
        isPackaged: true,
        resourcesPath: resources,
        platform: 'win32',
        devPath: null
      })
    ).toBe(binary)
  })

  it('devuelve null si el binario empaquetado no existe', () => {
    expect(
      resolveFfmpegPath({
        isPackaged: true,
        resourcesPath: join(workDir, 'no-existe'),
        platform: 'linux',
        devPath: null
      })
    ).toBeNull()
  })

  it('usa la ruta de desarrollo si existe', () => {
    const devPath = join(workDir, 'dev-ffmpeg')
    writeFileSync(devPath, 'binario')

    expect(
      resolveFfmpegPath({
        isPackaged: false,
        resourcesPath: '',
        platform: 'linux',
        devPath
      })
    ).toBe(devPath)
  })

  it('devuelve null en desarrollo si la ruta no existe', () => {
    expect(
      resolveFfmpegPath({
        isPackaged: false,
        resourcesPath: '',
        platform: 'linux',
        devPath: join(workDir, 'no-existe')
      })
    ).toBeNull()
  })
})

describe('probeMedia', () => {
  it('lee duración, resolución y FPS del archivo intermedio', async () => {
    const info = await probeMedia(FFMPEG_PATH, sourcePath)

    expect(info).not.toBeNull()
    expect(info?.width).toBe(640)
    expect(info?.height).toBe(360)
    expect(info?.fps).toBe(30)
    expect(info?.durationMs).toBeGreaterThan(1_800)
    expect(info?.durationMs).toBeLessThan(2_300)
  })

  it('devuelve null si el archivo no existe', async () => {
    expect(await probeMedia(FFMPEG_PATH, join(workDir, 'no-existe.webm'))).toBeNull()
  })
})

describe('extractThumbnail', () => {
  it('genera una miniatura JPEG', async () => {
    const output = join(workDir, 'thumb.jpg')
    const ok = await extractThumbnail(FFMPEG_PATH, sourcePath, output, 500)

    expect(ok).toBe(true)
    expect(existsSync(output)).toBe(true)

    const data = readFileSync(output)
    expect(data.length).toBeGreaterThan(100)
    expect(data[0]).toBe(0xff)
    expect(data[1]).toBe(0xd8)
  })

  it('devuelve false si no puede extraerla', async () => {
    const output = join(workDir, 'thumb-fallida.jpg')
    const ok = await extractThumbnail(FFMPEG_PATH, join(workDir, 'no-existe.webm'), output)

    expect(ok).toBe(false)
    expect(existsSync(output)).toBe(false)
  })
})
