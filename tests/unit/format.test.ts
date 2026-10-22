import { describe, expect, it } from 'vitest'
import {
  buildOutputFilename,
  formatBytes,
  formatDuration,
  parseProgress,
  parseProgressLine
} from '@shared/format'

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5_000, '0:05'],
    [65_000, '1:05'],
    [3_600_000, '1:00:00'],
    [3_661_000, '1:01:01'],
    [86_399_000, '23:59:59']
  ])('formatea %i ms como %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })

  it('trata valores negativos como cero', () => {
    expect(formatDuration(-1000)).toBe('0:00')
  })

  it('redondea hacia abajo los milisegundos', () => {
    expect(formatDuration(5_999)).toBe('0:05')
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1,0 KB'],
    [1536, '1,5 KB'],
    [1_048_576, '1,0 MB'],
    [5_505_024, '5,3 MB'],
    [1_073_741_824, '1,0 GB']
  ])('formatea %i bytes como %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  it('trata valores negativos como cero', () => {
    expect(formatBytes(-5)).toBe('0 B')
  })
})

describe('buildOutputFilename', () => {
  it('usa el patrón captura-AAAA-MM-DD_HH-mm-ss.mp4', () => {
    const date = new Date(2026, 9, 22, 17, 45, 0)
    expect(buildOutputFilename(date)).toBe('captura-2026-10-22_17-45-00.mp4')
  })

  it('rellena con ceros', () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    expect(buildOutputFilename(date)).toBe('captura-2026-01-02_03-04-05.mp4')
  })
})

describe('parseProgress', () => {
  it('calcula el porcentaje a partir de out_time_us', () => {
    expect(parseProgress(5_000_000, 10_000)).toBe(50)
    expect(parseProgress(2_500_000, 10_000)).toBe(25)
  })

  it('limita el porcentaje entre 0 y 100', () => {
    expect(parseProgress(-1, 10_000)).toBe(0)
    expect(parseProgress(20_000_000, 10_000)).toBe(100)
  })

  it('devuelve 0 si la duración no es válida', () => {
    expect(parseProgress(5_000_000, 0)).toBe(0)
    expect(parseProgress(5_000_000, Number.NaN)).toBe(0)
  })

  it('redondea a un decimal', () => {
    expect(parseProgress(3_333_000, 10_000)).toBe(33.3)
  })
})

describe('parseProgressLine', () => {
  it('extrae out_time_us y lo convierte a milisegundos', () => {
    expect(parseProgressLine('out_time_us=5000000')).toBe(5000)
  })

  it('ignora líneas que no contienen out_time_us', () => {
    expect(parseProgressLine('progress=continue')).toBeNull()
    expect(parseProgressLine('')).toBeNull()
  })

  it('ignora valores no numéricos', () => {
    expect(parseProgressLine('out_time_us=N/A')).toBeNull()
  })
})
