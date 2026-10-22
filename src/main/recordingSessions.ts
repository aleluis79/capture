import { randomUUID } from 'node:crypto'
import { mkdir, open, rm, stat, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { join } from 'node:path'

interface Session {
  id: string
  dir: string
  path: string
  handle: FileHandle
  queue: Promise<void>
}

export interface StartSessionResult {
  sessionId: string
  path: string
}

export interface FinishSessionResult {
  sessionId: string
  dir: string
  sourcePath: string
  sizeBytes: number
}

async function writeAll(handle: FileHandle, data: Uint8Array): Promise<void> {
  let offset = 0
  while (offset < data.length) {
    const { bytesWritten } = await handle.write(data, offset, data.length - offset, null)
    if (bytesWritten === 0) {
      throw new Error('No se pudo escribir el fragmento de grabación')
    }
    offset += bytesWritten
  }
}

export class RecordingSessions {
  private readonly sessions = new Map<string, Session>()

  constructor(private readonly rootDir: string) {}

  async start(): Promise<StartSessionResult> {
    const sessionId = randomUUID()
    const dir = join(this.rootDir, sessionId)
    await mkdir(dir, { recursive: true })

    const path = join(dir, 'source.webm')
    const handle = await open(path, 'w')
    await writeFile(join(dir, '.in-progress'), new Date().toISOString(), 'utf8')

    this.sessions.set(sessionId, {
      id: sessionId,
      dir,
      path,
      handle,
      queue: Promise.resolve()
    })

    return { sessionId, path }
  }

  async append(sessionId: string, chunk: Uint8Array): Promise<void> {
    const session = this.requireSession(sessionId)
    const data = Buffer.from(chunk)

    session.queue = session.queue.then(() => writeAll(session.handle, data))
    return session.queue
  }

  async finish(sessionId: string): Promise<FinishSessionResult> {
    const session = this.requireSession(sessionId)

    try {
      await session.queue
    } finally {
      await session.handle.close()
      await rm(join(session.dir, '.in-progress'), { force: true })
      this.sessions.delete(sessionId)
    }

    const info = await stat(session.path)
    return {
      sessionId,
      dir: session.dir,
      sourcePath: session.path,
      sizeBytes: info.size
    }
  }

  async abort(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)

    try {
      await session.queue.catch(() => undefined)
    } finally {
      await session.handle.close().catch(() => undefined)
      this.sessions.delete(sessionId)
      await rm(session.dir, { recursive: true, force: true })
    }
  }

  async abortAll(): Promise<void> {
    const ids = [...this.sessions.keys()]
    await Promise.all(ids.map((id) => this.abort(id)))
  }

  activeCount(): number {
    return this.sessions.size
  }

  private requireSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`La sesión de grabación ${sessionId} no existe`)
    }
    return session
  }
}
