import { describe, expect, it } from 'vitest'
import { MIN_TRIM_MS, validateTrim } from '@shared/trim'

describe('validateTrim', () => {
  it('acepta un intervalo válido', () => {
    expect(validateTrim(2_000, 10_000, 30_000)).toEqual({
      valid: true,
      startMs: 2_000,
      endMs: 10_000
    })
  })

  it('ajusta un inicio negativo a cero', () => {
    expect(validateTrim(-500, 10_000, 30_000)).toEqual({
      valid: true,
      startMs: 0,
      endMs: 10_000
    })
  })

  it('ajusta un fin posterior a la duración', () => {
    expect(validateTrim(2_000, 40_000, 30_000)).toEqual({
      valid: true,
      startMs: 2_000,
      endMs: 30_000
    })
  })

  it('rechaza un intervalo invertido', () => {
    expect(validateTrim(10_000, 5_000, 30_000)).toEqual({
      valid: false,
      error: 'invalid-order'
    })
  })

  it('rechaza un intervalo vacío', () => {
    expect(validateTrim(5_000, 5_000, 30_000)).toEqual({
      valid: false,
      error: 'invalid-order'
    })
  })

  it('rechaza un intervalo demasiado corto', () => {
    expect(validateTrim(1_000, 1_000 + MIN_TRIM_MS - 1, 30_000)).toEqual({
      valid: false,
      error: 'too-short'
    })
  })

  it('rechaza una grabación sin duración', () => {
    expect(validateTrim(0, 0, 0)).toEqual({ valid: false, error: 'empty-recording' })
  })

  it('trata valores no numéricos como extremos', () => {
    expect(validateTrim(Number.NaN, Number.NaN, 30_000)).toEqual({
      valid: true,
      startMs: 0,
      endMs: 30_000
    })
  })

  it('acepta el intervalo completo', () => {
    expect(validateTrim(0, 30_000, 30_000)).toEqual({
      valid: true,
      startMs: 0,
      endMs: 30_000
    })
  })
})
