import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RecordingSessions } from '@main/recordingSessions'

let rootDir: string
let sessions: RecordingSessions

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), 'captura-sessions-'))
  sessions = new RecordingSessions(rootDir)
})

afterEach(async () => {
  await sessions.abortAll()
  rmSync(rootDir, { recursive: true, force: true })
})

describe('RecordingSessions', () => {
  it('crea una sesión con su archivo intermedio y marca de progreso', async () => {
    const { sessionId, path } = await sessions.start()

    expect(existsSync(path)).toBe(true)
    expect(existsSync(join(rootDir, sessionId, '.in-progress'))).toBe(true)
  })

  it('genera identificadores distintos', async () => {
    const first = await sessions.start()
    const second = await sessions.start()
    expect(first.sessionId).not.toBe(second.sessionId)
  })

  it('escribe los fragmentos en orden y finaliza la sesión', async () => {
    const { sessionId, path } = await sessions.start()
    await sessions.append(sessionId, Buffer.from('hola '))
    await sessions.append(sessionId, Buffer.from('mundo'))

    const result = await sessions.finish(sessionId)

    expect(result.sourcePath).toBe(path)
    expect(readFileSync(path, 'utf8')).toBe('hola mundo')
    expect(result.sizeBytes).toBe(10)
    expect(existsSync(join(rootDir, sessionId, '.in-progress'))).toBe(false)
  })

  it('mantiene el orden con escrituras concurrentes', async () => {
    const { sessionId, path } = await sessions.start()
    const chunks = Array.from({ length: 50 }, (_, index) => Buffer.from(`chunk-${index};`))

    await Promise.all(chunks.map((chunk) => sessions.append(sessionId, chunk)))
    await sessions.finish(sessionId)

    expect(readFileSync(path, 'utf8')).toBe(chunks.map((chunk) => chunk.toString()).join(''))
  })

  it('aborta y elimina el directorio', async () => {
    const { sessionId } = await sessions.start()
    await sessions.append(sessionId, Buffer.from('datos'))

    await sessions.abort(sessionId)

    expect(existsSync(join(rootDir, sessionId))).toBe(false)
  })

  it('rechaza operaciones sobre sesiones inexistentes', async () => {
    await expect(sessions.append('no-existe', Buffer.from('x'))).rejects.toThrow()
    await expect(sessions.finish('no-existe')).rejects.toThrow()
  })

  it('escribe 200 MB sin perder datos ni acumularlos en memoria', async () => {
    const { sessionId, path } = await sessions.start()
    const chunk = Buffer.alloc(1024 * 1024, 0x61)

    for (let index = 0; index < 200; index += 1) {
      await sessions.append(sessionId, chunk)
    }

    const result = await sessions.finish(sessionId)
    expect(result.sizeBytes).toBe(200 * 1024 * 1024)
    expect(readFileSync(path).length).toBe(200 * 1024 * 1024)
  })
})
