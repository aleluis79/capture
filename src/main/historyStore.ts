import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import {
  addExportToEntry,
  addHistoryEntry,
  cleanupCandidates,
  findEntry,
  removeHistoryEntry,
  sanitizeHistory,
  sortEntries,
  totalSize
} from '@shared/history'
import type { ExportedFile, HistoryEntry, OrphanRecording, RecordingMode } from '@shared/types'

export interface RecoveredMetadata {
  durationMs: number
  width: number
  height: number
  fps: number
  mode: RecordingMode
}

export interface CleanupResult {
  removedCount: number
  reclaimedBytes: number
}

export class HistoryStore {
  readonly recordingsDir: string
  private readonly indexPath: string
  private entries: HistoryEntry[]

  constructor(dataDir: string) {
    this.recordingsDir = join(dataDir, 'recordings')
    this.indexPath = join(dataDir, 'history.json')
    this.entries = this.read()
  }

  list(): HistoryEntry[] {
    return sortEntries(this.entries)
  }

  find(id: string): HistoryEntry | null {
    return findEntry(this.entries, id)
  }

  add(entry: HistoryEntry): void {
    this.entries = addHistoryEntry(this.entries, entry)
    this.save()
  }

  remove(id: string): void {
    this.entries = removeHistoryEntry(this.entries, id)
    this.save()
    rmSync(join(this.recordingsDir, id), { recursive: true, force: true })
  }

  addExport(id: string, exported: ExportedFile): void {
    this.entries = addExportToEntry(this.entries, id, exported)
    this.save()
  }

  entryDir(id: string): string {
    return join(this.recordingsDir, id)
  }

  orphans(): OrphanRecording[] {
    if (!existsSync(this.recordingsDir)) {
      return []
    }

    const known = new Set(this.entries.map((entry) => entry.id))
    const orphans: OrphanRecording[] = []

    for (const dirent of readdirSync(this.recordingsDir, { withFileTypes: true })) {
      if (!dirent.isDirectory() || known.has(dirent.name)) {
        continue
      }

      const dir = join(this.recordingsDir, dirent.name)
      const sourcePath = join(dir, 'source.webm')

      if (!existsSync(sourcePath) || existsSync(join(dir, '.in-progress'))) {
        continue
      }

      const stat = statSync(sourcePath)
      orphans.push({
        id: dirent.name,
        sourcePath,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString()
      })
    }

    return orphans.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  recoverOrphan(id: string, metadata: RecoveredMetadata): HistoryEntry {
    const dir = this.entryDir(id)
    const sourcePath = join(dir, 'source.webm')
    const stat = statSync(sourcePath)
    const thumbPath = join(dir, 'thumb.jpg')

    const entry: HistoryEntry = {
      id,
      createdAt: stat.birthtime.toISOString(),
      durationMs: metadata.durationMs,
      sizeBytes: stat.size,
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      mode: metadata.mode,
      sourcePath,
      thumbPath: existsSync(thumbPath) ? thumbPath : null,
      exports: [],
      status: 'recovered'
    }

    this.add(entry)
    return entry
  }

  discardOrphan(id: string): void {
    if (this.find(id)) {
      return
    }
    rmSync(this.entryDir(id), { recursive: true, force: true })
  }

  cleanupSources(): CleanupResult {
    let removedCount = 0
    let reclaimedBytes = 0

    for (const entry of cleanupCandidates(this.entries)) {
      if (!existsSync(entry.sourcePath)) {
        continue
      }

      const size = statSync(entry.sourcePath).size
      rmSync(entry.sourcePath, { force: true })
      removedCount += 1
      reclaimedBytes += size
      entry.sizeBytes = 0
    }

    if (removedCount > 0) {
      this.save()
    }

    return { removedCount, reclaimedBytes }
  }

  totalSize(): number {
    return totalSize(this.entries)
  }

  private read(): HistoryEntry[] {
    if (!existsSync(this.indexPath)) {
      return []
    }

    try {
      const raw = readFileSync(this.indexPath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      return sanitizeHistory(parsed)
    } catch {
      this.backupCorrupt()
      return []
    }
  }

  private backupCorrupt(): void {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      copyFileSync(this.indexPath, `${this.indexPath}.corrupt-${stamp}.bak`)
    } catch {
      // Sin copia de seguridad seguimos con un historial vacío.
    }
  }

  private save(): void {
    mkdirSync(join(this.recordingsDir, '..'), { recursive: true })
    const temporary = `${this.indexPath}.tmp`
    writeFileSync(temporary, `${JSON.stringify(this.entries, null, 2)}\n`, 'utf8')
    renameSync(temporary, this.indexPath)
  }
}
