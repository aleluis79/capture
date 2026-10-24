import { describe, expect, it } from 'vitest'
import { buildExportArgs, buildPartPath } from '@shared/export'

const baseInput = {
  inputPath: '/tmp/captura/source.webm',
  outputPath: '/home/alejandro/Vídeos/Capturas/captura-2026-10-22_17-45-00.mp4',
  startMs: 0,
  endMs: null,
  width: 1920,
  height: 1080,
  fps: 30,
  quality: 'medium' as const
}

describe('buildPartPath', () => {
  it('inserta .part antes de la extensión mp4', () => {
    expect(buildPartPath('/videos/captura.mp4')).toBe('/videos/captura.part.mp4')
  })

  it('añade .part.mp4 si no hay extensión', () => {
    expect(buildPartPath('/videos/captura')).toBe('/videos/captura.part.mp4')
  })

  it('admite extensiones en mayúsculas', () => {
    expect(buildPartPath('/videos/CAPTURA.MP4')).toBe('/videos/CAPTURA.part.mp4')
  })
})

describe('buildExportArgs', () => {
  it('construye la escala, el relleno y el FPS de salida', () => {
    const args = buildExportArgs(baseInput)
    const vf = args[args.indexOf('-vf') + 1]

    expect(vf).toBe(
      'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,' +
        'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,' +
        'setsar=1,fps=30,format=yuv420p'
    )
  })

  it('incluye códec H.264, CRF, faststart y codificación de audio AAC opcional por defecto', () => {
    const args = buildExportArgs(baseInput)

    expect(args).toContain('-c:v')
    expect(args).toContain('libx264')
    expect(args).toContain('-crf')
    expect(args[args.indexOf('-crf') + 1]).toBe('21')
    expect(args).toContain('+faststart')
    expect(args).toContain('0:v:0')
    expect(args).toContain('0:a:0?')
    expect(args).toContain('-c:a')
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac')
    expect(args).toContain('-b:a')
    expect(args[args.indexOf('-b:a') + 1]).toBe('128k')
    expect(args).not.toContain('-an')
    expect(args).toContain('-pix_fmt')
    expect(args[args.indexOf('-pix_fmt') + 1]).toBe('yuv420p')
  })

  it('permite silenciar explícitamente la salida con includeAudio: false', () => {
    const args = buildExportArgs({ ...baseInput, includeAudio: false })

    expect(args).toContain('-an')
    expect(args).not.toContain('-c:a')
  })

  it('aplica loudnorm cuando la normalización está activa', () => {
    const args = buildExportArgs({ ...baseInput, normalizeAudio: true })

    expect(args).toContain('-af')
    expect(args[args.indexOf('-af') + 1]).toBe('loudnorm=I=-16:TP=-1.5:LRA=11')
  })

  it('omite loudnorm cuando la normalización está desactivada', () => {
    const args = buildExportArgs({ ...baseInput, normalizeAudio: false })

    expect(args).not.toContain('-af')
  })

  it('omite el filtro de audio cuando no hay pista de sonido', () => {
    const args = buildExportArgs({ ...baseInput, includeAudio: false, normalizeAudio: true })

    expect(args).not.toContain('-af')
    expect(args).toContain('-an')
  })

  it('escribe en un archivo .part y sobrescribe sin preguntar', () => {
    const args = buildExportArgs(baseInput)

    expect(args.at(-1)).toBe('/home/alejandro/Vídeos/Capturas/captura-2026-10-22_17-45-00.part.mp4')
    expect(args).toContain('-y')
  })

  it('añade el recorte con precisión de milisegundos', () => {
    const args = buildExportArgs({ ...baseInput, startMs: 2500, endMs: 10000 })

    expect(args[args.indexOf('-ss') + 1]).toBe('2.500')
    expect(args[args.indexOf('-t') + 1]).toBe('7.500')
  })

  it('omite el recorte cuando el intervalo es completo', () => {
    const args = buildExportArgs({ ...baseInput, startMs: 0, endMs: null })

    expect(args).not.toContain('-ss')
    expect(args).not.toContain('-t')
  })

  it('omite -ss cuando el inicio es cero pero conserva el fin', () => {
    const args = buildExportArgs({ ...baseInput, startMs: 0, endMs: 5000 })

    expect(args).not.toContain('-ss')
    expect(args[args.indexOf('-t') + 1]).toBe('5.000')
  })

  it('formatea FPS decimales', () => {
    const args = buildExportArgs({ ...baseInput, fps: 29.97 })
    const vf = args[args.indexOf('-vf') + 1]

    expect(vf).toContain('fps=29.97')
  })

  it('rechaza intervalos inválidos', () => {
    expect(() => buildExportArgs({ ...baseInput, startMs: 5000, endMs: 5000 })).toThrow()
    expect(() => buildExportArgs({ ...baseInput, startMs: 6000, endMs: 5000 })).toThrow()
  })

  it('rechaza dimensiones no positivas', () => {
    expect(() => buildExportArgs({ ...baseInput, width: 0 })).toThrow()
    expect(() => buildExportArgs({ ...baseInput, height: -2 })).toThrow()
  })
})
