import { describe, expect, it } from 'vitest'
import {
  addHistoryEntry,
  addExportToEntry,
  cleanupCandidates,
  findEntry,
  removeHistoryEntry,
  sanitizeHistory,
  sortEntries,
  totalSize
} from '@shared/history'
import type { HistoryEntry } from '@shared/types'

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'id-1',
    createdAt: '2026-10-22T17:45:00.000Z',
    durationMs: 30_000,
    sizeBytes: 1_000_000,
    width: 1920,
    height: 1080,
    fps: 30,
    mode: 'screen',
    sourcePath: '/datos/recordings/id-1/source.webm',
    thumbPath: '/datos/recordings/id-1/thumb.jpg',
    exports: [],
    status: 'complete',
    ...overrides
  }
}

describe('addHistoryEntry', () => {
  it('añade la entrada al principio sin mutar el historial', () => {
    const entries = [makeEntry({ id: 'viejo' })]
    const result = addHistoryEntry(entries, makeEntry({ id: 'nuevo' }))

    expect(result.map((entry) => entry.id)).toEqual(['nuevo', 'viejo'])
    expect(entries).toHaveLength(1)
  })

  it('reemplaza una entrada existente con el mismo id', () => {
    const entries = [makeEntry({ id: 'a', fps: 30 }), makeEntry({ id: 'b' })]
    const result = addHistoryEntry(entries, makeEntry({ id: 'a', fps: 60 }))

    expect(result).toHaveLength(2)
    expect(result.find((entry) => entry.id === 'a')?.fps).toBe(60)
  })
})

describe('removeHistoryEntry', () => {
  it('elimina solo la entrada indicada', () => {
    const result = removeHistoryEntry([makeEntry({ id: 'a' }), makeEntry({ id: 'b' })], 'a')
    expect(result.map((entry) => entry.id)).toEqual(['b'])
  })
})

describe('sortEntries', () => {
  it('ordena de la más reciente a la más antigua', () => {
    const older = makeEntry({ id: 'older', createdAt: '2026-10-20T10:00:00.000Z' })
    const newer = makeEntry({ id: 'newer', createdAt: '2026-10-22T10:00:00.000Z' })
    const middle = makeEntry({ id: 'middle', createdAt: '2026-10-21T10:00:00.000Z' })

    expect(sortEntries([older, newer, middle]).map((entry) => entry.id)).toEqual([
      'newer',
      'middle',
      'older'
    ])
  })

  it('no muta el array original', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]
    sortEntries(entries)
    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b'])
  })
})

describe('totalSize', () => {
  it('suma el tamaño de las grabaciones', () => {
    expect(
      totalSize([makeEntry({ sizeBytes: 1000 }), makeEntry({ id: 'b', sizeBytes: 2500 })])
    ).toBe(3500)
  })

  it('devuelve 0 para un historial vacío', () => {
    expect(totalSize([])).toBe(0)
  })
})

describe('addExportToEntry', () => {
  it('añade una exportación a la entrada indicada', () => {
    const result = addExportToEntry([makeEntry({ id: 'a' })], 'a', {
      path: '/videos/a.mp4',
      createdAt: '2026-10-22T18:00:00.000Z',
      width: 1920,
      height: 1080,
      fps: 30
    })

    expect(result[0].exports).toHaveLength(1)
    expect(result[0].exports[0].path).toBe('/videos/a.mp4')
  })

  it('no modifica entradas distintas', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]
    addExportToEntry(entries, 'a', {
      path: '/videos/a.mp4',
      createdAt: '2026-10-22T18:00:00.000Z',
      width: 1920,
      height: 1080,
      fps: 30
    })

    expect(entries[1].exports).toHaveLength(0)
  })
})

describe('findEntry', () => {
  it('encuentra por id y devuelve null si no existe', () => {
    const entries = [makeEntry({ id: 'a' })]
    expect(findEntry(entries, 'a')?.id).toBe('a')
    expect(findEntry(entries, 'z')).toBeNull()
  })
})

describe('cleanupCandidates', () => {
  it('solo incluye entradas que ya tienen una exportación', () => {
    const exported = makeEntry({
      id: 'exportada',
      exports: [
        {
          path: '/videos/a.mp4',
          createdAt: '2026-10-22T18:00:00.000Z',
          width: 1920,
          height: 1080,
          fps: 30
        }
      ]
    })
    const pending = makeEntry({ id: 'pendiente' })

    expect(cleanupCandidates([exported, pending]).map((entry) => entry.id)).toEqual(['exportada'])
  })
})

describe('sanitizeHistory', () => {
  it('devuelve un historial vacío para datos inválidos', () => {
    expect(sanitizeHistory(null)).toEqual([])
    expect(sanitizeHistory({})).toEqual([])
    expect(sanitizeHistory('texto')).toEqual([])
  })

  it('filtra entradas con campos obligatorios inválidos', () => {
    const valid = makeEntry({ id: 'valida' })
    const result = sanitizeHistory([valid, { id: 'rota' }, null, { ...valid, id: 42 }])

    expect(result.map((entry) => entry.id)).toEqual(['valida'])
  })

  it('ordena el resultado de la más reciente a la más antigua', () => {
    const older = makeEntry({ id: 'older', createdAt: '2026-10-20T10:00:00.000Z' })
    const newer = makeEntry({ id: 'newer', createdAt: '2026-10-22T10:00:00.000Z' })

    expect(sanitizeHistory([older, newer]).map((entry) => entry.id)).toEqual(['newer', 'older'])
  })

  it('sanea exportaciones inválidas dentro de una entrada válida', () => {
    const result = sanitizeHistory([
      makeEntry({ exports: [{ path: 42 } as never, { path: '/ok.mp4', createdAt: 'x' } as never] })
    ])

    expect(result[0].exports).toEqual([])
  })

  it('normaliza hasAudio a booleano en entradas del historial', () => {
    const result = sanitizeHistory([
      makeEntry({ id: 'con-audio', hasAudio: true }),
      makeEntry({ id: 'sin-audio' }),
      makeEntry({ id: 'invalido', hasAudio: 'si' as never })
    ])

    expect(result.find((entry) => entry.id === 'con-audio')?.hasAudio).toBe(true)
    expect(result.find((entry) => entry.id === 'sin-audio')?.hasAudio).toBe(false)
    expect(result.find((entry) => entry.id === 'invalido')?.hasAudio).toBe(false)
  })
})
