import { describe, expect, it } from 'vitest'
import { QUALITY_PROFILES, bitrateFor, crfForQuality } from '@shared/quality'

describe('crfForQuality', () => {
  it('asigna un CRF menor a mayor calidad', () => {
    expect(crfForQuality('high')).toBe(18)
    expect(crfForQuality('medium')).toBe(21)
    expect(crfForQuality('low')).toBe(24)
  })

  it('mantiene la relación alta > media > baja en calidad', () => {
    expect(crfForQuality('high')).toBeLessThan(crfForQuality('medium'))
    expect(crfForQuality('medium')).toBeLessThan(crfForQuality('low'))
  })
})

describe('bitrateFor', () => {
  it('calcula 1080p30 en calidad media', () => {
    expect(bitrateFor({ width: 1920, height: 1080, fps: 30, quality: 'medium' })).toBe(4_700_000)
  })

  it('crece con la calidad para la misma resolución y FPS', () => {
    const base = { width: 1920, height: 1080, fps: 30 }
    const high = bitrateFor({ ...base, quality: 'high' })
    const medium = bitrateFor({ ...base, quality: 'medium' })
    const low = bitrateFor({ ...base, quality: 'low' })

    expect(high).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(low)
  })

  it('crece con la resolución y con los FPS', () => {
    const base = { quality: 'medium' as const }
    expect(bitrateFor({ ...base, width: 3840, height: 2160, fps: 30 })).toBeGreaterThan(
      bitrateFor({ ...base, width: 1920, height: 1080, fps: 30 })
    )
    expect(bitrateFor({ ...base, width: 1920, height: 1080, fps: 60 })).toBeGreaterThan(
      bitrateFor({ ...base, width: 1920, height: 1080, fps: 30 })
    )
  })

  it('limita el máximo a 50 Mbps', () => {
    expect(bitrateFor({ width: 3840, height: 2160, fps: 60, quality: 'high' })).toBe(50_000_000)
  })

  it('limita el mínimo a 1 Mbps', () => {
    expect(bitrateFor({ width: 320, height: 240, fps: 15, quality: 'low' })).toBe(1_000_000)
  })

  it('redondea a múltiplos de 100 kbps', () => {
    expect(bitrateFor({ width: 1280, height: 720, fps: 30, quality: 'medium' }) % 100_000).toBe(0)
  })

  it('expone los perfiles con CRF y bits por píxel', () => {
    expect(QUALITY_PROFILES.high.crf).toBe(18)
    expect(QUALITY_PROFILES.medium.bitsPerPixel).toBeGreaterThan(QUALITY_PROFILES.low.bitsPerPixel)
  })
})
