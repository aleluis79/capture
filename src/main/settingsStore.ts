import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import { mergeSettings, sanitizeSettings } from '@shared/settings'
import type { Settings } from '@shared/types'

export class SettingsStore {
  private current: Settings

  constructor(
    private readonly filePath: string,
    private readonly defaults: Settings
  ) {
    this.current = this.read()
  }

  get(): Settings {
    return { ...this.current }
  }

  update(patch: Partial<Settings>): Settings {
    this.current = mergeSettings(this.current, patch, this.defaults)
    this.write(this.current)
    return this.get()
  }

  reset(): Settings {
    this.current = { ...this.defaults }
    this.write(this.current)
    return this.get()
  }

  private read(): Settings {
    if (!existsSync(this.filePath)) {
      return { ...this.defaults }
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      return sanitizeSettings(parsed, this.defaults)
    } catch {
      this.backupCorrupt()
      return { ...this.defaults }
    }
  }

  private backupCorrupt(): void {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      copyFileSync(this.filePath, `${this.filePath}.corrupt-${stamp}.bak`)
    } catch {
      // Si la copia falla, seguimos con los valores por defecto.
    }
  }

  private write(settings: Settings): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.tmp`
    writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    renameSync(temporary, this.filePath)
  }
}
