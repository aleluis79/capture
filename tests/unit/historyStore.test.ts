import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryStore } from '@main/historyStore'
import type { HistoryEntry } from '@shared/types'

let dataDir: string
let store: HistoryStore

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  const id = overrides.id ?? 'id-1'
  return {
    id,
    createdAt: '2026-10-22T17:45:00.000Z',
    durationMs: 30_000,
    sizeBytes: 1_000_000,
    width: 1920,
    height: 1080,
    fps: 30,
    mode: 'screen',
    sourcePath: join(dataDir, 'recordings', id, 'source.webm'),
    thumbPath: join(dataDir, 'recordings', id, 'thumb.jpg'),
    exports: [],
    status: 'complete',
    ...overrides
  }
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'captura-history-'))
  store = new HistoryStore(dataDir)
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

describe('HistoryStore', () => {
  it('empieza vacío si no existe el archivo', () => {
    expect(store.list()).toEqual([])
  })

  it('persiste una entrada y la ordena por fecha', () => {
    store.add(makeEntry({ id: 'vieja', createdAt: '2026-10-20T10:00:00.000Z' }))
    store.add(makeEntry({ id: 'nueva', createdAt: '2026-10-22T10:00:00.000Z' }))

    const reloaded = new HistoryStore(dataDir)
    expect(reloaded.list().map((entry) => entry.id)).toEqual(['nueva', 'vieja'])
  })

  it('encuentra una entrada por id', () => {
    store.add(makeEntry({ id: 'abc' }))
    expect(store.find('abc')?.id).toBe('abc')
    expect(store.find('otra')).toBeNull()
  })

  it('elimina la entrada y su directorio de grabación', () => {
    const entry = makeEntry({ id: 'abc' })
    mkdirSync(join(dataDir, 'recordings', 'abc'), { recursive: true })
    writeFileSync(entry.sourcePath, 'datos')
    store.add(entry)

    store.remove('abc')

    expect(store.list()).toEqual([])
    expect(existsSync(join(dataDir, 'recordings', 'abc'))).toBe(false)
  })

  it('añade exportaciones a una entrada y las persiste', () => {
    store.add(makeEntry({ id: 'abc' }))
    store.addExport('abc', {
      path: '/videos/abc.mp4',
      createdAt: '2026-10-22T18:00:00.000Z',
      width: 1920,
      height: 1080,
      fps: 30
    })

    expect(new HistoryStore(dataDir).find('abc')?.exports).toHaveLength(1)
  })

  it('recupera un índice corrupto con una copia de seguridad', () => {
    writeFileSync(join(dataDir, 'history.json'), '{roto', 'utf8')

    const reloaded = new HistoryStore(dataDir)
    expect(reloaded.list()).toEqual([])

    const backups = readdirSync(dataDir).filter((name) => name.includes('.corrupt-'))
    expect(backups).toHaveLength(1)
  })

  it('detecta grabaciones huérfanas y omite las activas y las registradas', () => {
    store.add(makeEntry({ id: 'registrada' }))

    const orphanDir = join(dataDir, 'recordings', 'huerfana')
    mkdirSync(orphanDir, { recursive: true })
    writeFileSync(join(orphanDir, 'source.webm'), Buffer.alloc(2048))

    const activeDir = join(dataDir, 'recordings', 'activa')
    mkdirSync(activeDir, { recursive: true })
    writeFileSync(join(activeDir, 'source.webm'), Buffer.alloc(512))
    writeFileSync(join(activeDir, '.in-progress'), '')

    const orphans = store.orphans()
    expect(orphans.map((orphan) => orphan.id)).toEqual(['huerfana'])
    expect(orphans[0].sizeBytes).toBe(2048)
  })

  it('descarta una grabación huérfana', () => {
    const orphanDir = join(dataDir, 'recordings', 'huerfana')
    mkdirSync(orphanDir, { recursive: true })
    writeFileSync(join(orphanDir, 'source.webm'), 'datos')

    store.discardOrphan('huerfana')
    expect(existsSync(orphanDir)).toBe(false)
  })

  it('recupera una huérfana como entrada del historial con su estado de audio', () => {
    const orphanDir = join(dataDir, 'recordings', 'huerfana')
    mkdirSync(orphanDir, { recursive: true })
    writeFileSync(join(orphanDir, 'source.webm'), 'datos')

    const entry = store.recoverOrphan('huerfana', {
      durationMs: 5000,
      width: 1280,
      height: 720,
      fps: 30,
      mode: 'screen',
      hasAudio: true
    })

    expect(entry.status).toBe('recovered')
    expect(entry.hasAudio).toBe(true)
    expect(store.find('huerfana')?.durationMs).toBe(5000)
    expect(store.find('huerfana')?.hasAudio).toBe(true)
  })

  it('limpia solo los archivos intermedios ya exportados', () => {
    const exported = makeEntry({
      id: 'exportada',
      exports: [
        {
          path: '/videos/exportada.mp4',
          createdAt: '2026-10-22T18:00:00.000Z',
          width: 1920,
          height: 1080,
          fps: 30
        }
      ]
    })
    const pending = makeEntry({ id: 'pendiente' })

    for (const entry of [exported, pending]) {
      mkdirSync(join(dataDir, 'recordings', entry.id), { recursive: true })
      writeFileSync(entry.sourcePath, Buffer.alloc(1024))
      writeFileSync(entry.thumbPath!, 'thumb')
    }
    store.add(exported)
    store.add(pending)

    const result = store.cleanupSources()

    expect(result.removedCount).toBe(1)
    expect(result.reclaimedBytes).toBe(1024)
    expect(existsSync(exported.sourcePath)).toBe(false)
    expect(existsSync(exported.thumbPath!)).toBe(true)
    expect(existsSync(pending.sourcePath)).toBe(true)
  })

  it('no deja archivos temporales al guardar', () => {
    store.add(makeEntry({ id: 'a' }))
    const leftovers = readdirSync(dataDir).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })

  it('guarda el índice como JSON legible', () => {
    store.add(makeEntry({ id: 'a' }))
    const raw = readFileSync(join(dataDir, 'history.json'), 'utf8')
    expect(JSON.parse(raw)).toHaveLength(1)
  })
})
