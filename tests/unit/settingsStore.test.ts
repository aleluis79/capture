import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SettingsStore } from '@main/settingsStore'
import { createDefaultSettings } from '@shared/settings'

let dir: string
let filePath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'captura-settings-'))
  filePath = join(dir, 'settings.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeStore(defaultOutputDir = join(dir, 'Capturas')): SettingsStore {
  return new SettingsStore(filePath, createDefaultSettings(defaultOutputDir))
}

describe('SettingsStore', () => {
  it('devuelve los valores por defecto si no existe el archivo', () => {
    expect(makeStore().get().fps).toBe(30)
  })

  it('persiste los cambios entre instancias', () => {
    makeStore().update({ fps: 60, quality: 'high' })

    const reloaded = makeStore().get()
    expect(reloaded.fps).toBe(60)
    expect(reloaded.quality).toBe('high')
  })

  it('sanea los valores inválidos antes de guardarlos', () => {
    const store = makeStore()
    store.update({ fps: 999, resolution: 'custom', customWidth: 1000, customHeight: 600 })

    expect(store.get().fps).toBe(30)
    expect(store.get()).toMatchObject({
      resolution: 'custom',
      customWidth: 1000,
      customHeight: 600
    })
  })

  it('recupera los valores por defecto de un archivo corrupto y guarda una copia', () => {
    writeFileSync(filePath, '{esto no es json', 'utf8')

    const store = makeStore()
    expect(store.get().fps).toBe(30)

    const backups = readdirSync(dir).filter((name) => name.includes('.corrupt-'))
    expect(backups).toHaveLength(1)
  })

  it('no deja archivos temporales tras guardar', () => {
    makeStore().update({ fps: 24 })

    const leftovers = readdirSync(dir).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })

  it('mantiene el resto de valores al actualizar un campo', () => {
    const store = makeStore()
    const before = store.get()
    store.update({ countdownSeconds: 0 })

    expect(store.get()).toMatchObject({
      resolution: before.resolution,
      quality: before.quality,
      outputDir: before.outputDir
    })
  })
})
