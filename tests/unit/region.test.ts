import { describe, expect, it } from 'vitest'
import {
  MIN_REGION_SIZE,
  computeCropRect,
  isValidRegion,
  normalizeRegion,
  regionFromPoints,
  resolveOutputDimensions,
  toEvenDimensions
} from '@shared/region'

describe('normalizeRegion', () => {
  it('recorta una región que empieza fuera de los límites conservando el borde derecho', () => {
    expect(
      normalizeRegion({ x: -10, y: -5, width: 100, height: 50 }, { width: 1920, height: 1080 })
    ).toEqual({ x: 0, y: 0, width: 90, height: 45 })
  })

  it('recorta una región que excede el borde inferior derecho', () => {
    expect(
      normalizeRegion({ x: 1900, y: 1070, width: 100, height: 100 }, { width: 1920, height: 1080 })
    ).toEqual({ x: 1900, y: 1070, width: 20, height: 10 })
  })

  it('redondea coordenadas y dimensiones fraccionarias', () => {
    expect(
      normalizeRegion(
        { x: 10.6, y: 20.2, width: 100.7, height: 50.2 },
        { width: 1920, height: 1080 }
      )
    ).toEqual({ x: 11, y: 20, width: 101, height: 50 })
  })

  it('deja intacta una región que cabe en los límites', () => {
    const region = { x: 100, y: 100, width: 640, height: 480 }
    expect(normalizeRegion(region, { width: 1920, height: 1080 })).toEqual(region)
  })

  it('devuelve tamaño cero cuando la región está completamente fuera', () => {
    expect(
      normalizeRegion({ x: 2000, y: 0, width: 10, height: 10 }, { width: 1920, height: 1080 })
    ).toEqual({ x: 1920, y: 0, width: 0, height: 10 })
  })
})

describe('toEvenDimensions', () => {
  it('reduce dimensiones impares al par inferior', () => {
    expect(toEvenDimensions({ width: 1365, height: 767 })).toEqual({ width: 1364, height: 766 })
  })

  it('mantiene dimensiones pares', () => {
    expect(toEvenDimensions({ width: 1920, height: 1080 })).toEqual({ width: 1920, height: 1080 })
  })

  it('nunca devuelve una dimensión menor que 2', () => {
    expect(toEvenDimensions({ width: 1, height: 1 })).toEqual({ width: 2, height: 2 })
    expect(toEvenDimensions({ width: 0, height: 3 })).toEqual({ width: 2, height: 2 })
  })
})

describe('isValidRegion', () => {
  it('acepta exactamente el tamaño mínimo', () => {
    expect(isValidRegion({ x: 0, y: 0, width: MIN_REGION_SIZE, height: MIN_REGION_SIZE })).toBe(
      true
    )
  })

  it('rechaza regiones menores que el mínimo', () => {
    expect(isValidRegion({ x: 0, y: 0, width: MIN_REGION_SIZE - 1, height: 50 })).toBe(false)
  })

  it('rechaza dimensiones no positivas', () => {
    expect(isValidRegion({ x: 0, y: 0, width: 0, height: 0 })).toBe(false)
  })
})

describe('regionFromPoints', () => {
  it('normaliza un arrastre de abajo-derecha a arriba-izquierda', () => {
    expect(regionFromPoints({ x: 300, y: 200 }, { x: 100, y: 50 })).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150
    })
  })

  it('calcula un arrastre normal', () => {
    expect(regionFromPoints({ x: 10, y: 20 }, { x: 60, y: 100 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 80
    })
  })
})

describe('resolveOutputDimensions', () => {
  const source = { width: 2880, height: 1800 }

  it.each([
    ['2160p', { width: 3840, height: 2160 }],
    ['1440p', { width: 2560, height: 1440 }],
    ['1080p', { width: 1920, height: 1080 }],
    ['720p', { width: 1280, height: 720 }]
  ] as const)('resuelve el preset %s', (preset, expected) => {
    expect(resolveOutputDimensions({ preset, source })).toEqual(expected)
  })

  it('usa la fuente nativa y la hace par', () => {
    expect(
      resolveOutputDimensions({ preset: 'native', source: { width: 1365, height: 767 } })
    ).toEqual({ width: 1364, height: 766 })
  })

  it('usa la resolución personalizada y la hace par', () => {
    expect(
      resolveOutputDimensions({
        preset: 'custom',
        source,
        customWidth: 1000,
        customHeight: 601
      })
    ).toEqual({ width: 1000, height: 600 })
  })

  it('cae a la fuente si la resolución personalizada es inválida', () => {
    expect(
      resolveOutputDimensions({
        preset: 'custom',
        source: { width: 1280, height: 720 },
        customWidth: 0,
        customHeight: -10
      })
    ).toEqual({ width: 1280, height: 720 })
  })
})

describe('computeCropRect', () => {
  it('recorta y hace pares las dimensiones', () => {
    expect(
      computeCropRect({ x: 10, y: 10, width: 101, height: 51 }, { width: 1920, height: 1080 })
    ).toEqual({ x: 10, y: 10, width: 100, height: 50 })
  })

  it('recorta una región que excede la fuente', () => {
    expect(
      computeCropRect({ x: 1800, y: 1000, width: 400, height: 400 }, { width: 1920, height: 1080 })
    ).toEqual({ x: 1800, y: 1000, width: 120, height: 80 })
  })

  it('recorta coordenadas negativas conservando el borde', () => {
    expect(
      computeCropRect({ x: -20, y: -10, width: 200, height: 150 }, { width: 1920, height: 1080 })
    ).toEqual({ x: 0, y: 0, width: 180, height: 140 })
  })

  it('devuelve null si la región resultante es menor que el mínimo', () => {
    expect(
      computeCropRect({ x: 0, y: 0, width: 10, height: 10 }, { width: 1920, height: 1080 })
    ).toBeNull()
  })

  it('devuelve null si la fuente es menor que el mínimo', () => {
    expect(
      computeCropRect({ x: 0, y: 0, width: 10, height: 10 }, { width: 10, height: 10 })
    ).toBeNull()
  })
})
