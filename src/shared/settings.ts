import type { QualityPreset, ResolutionPreset, Settings } from './types'

const RESOLUTIONS: ResolutionPreset[] = ['native', '2160p', '1440p', '1080p', '720p', 'custom']

const QUALITIES: QualityPreset[] = ['high', 'medium', 'low']

const MODIFIERS = new Set([
  'Control',
  'Ctrl',
  'Alt',
  'Shift',
  'Super',
  'Meta',
  'Command',
  'Cmd',
  'CommandOrControl'
])

const NAMED_KEYS = new Set([
  'Space',
  'Tab',
  'Enter',
  'Return',
  'Escape',
  'Esc',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Up',
  'Down',
  'Left',
  'Right',
  'PrintScreen',
  'Plus',
  'Minus',
  'Num0',
  'Num1',
  'Num2',
  'Num3',
  'Num4',
  'Num5',
  'Num6',
  'Num7',
  'Num8',
  'Num9'
])

const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/
const SINGLE_CHAR = /^[A-Za-z0-9]$/

export function isValidShortcut(value: string): boolean {
  if (!value || value.length > 64) {
    return false
  }

  const parts = value.split('+').filter(Boolean)
  if (parts.length < 2) {
    return false
  }

  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)

  if (!modifiers.every((modifier) => MODIFIERS.has(modifier))) {
    return false
  }

  return SINGLE_CHAR.test(key) || FUNCTION_KEY.test(key) || NAMED_KEYS.has(key)
}

export function createDefaultSettings(defaultOutputDir: string): Settings {
  return {
    resolution: '1080p',
    customWidth: 1920,
    customHeight: 1080,
    fps: 30,
    quality: 'medium',
    countdownSeconds: 3,
    shortcut: 'Control+Alt+R',
    outputDir: defaultOutputDir,
    keepSource: true
  }
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function sanitizeSettings(input: unknown, defaults: Settings): Settings {
  const candidate =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}

  const resolution = RESOLUTIONS.includes(candidate.resolution as ResolutionPreset)
    ? (candidate.resolution as ResolutionPreset)
    : defaults.resolution

  const quality = QUALITIES.includes(candidate.quality as QualityPreset)
    ? (candidate.quality as QualityPreset)
    : defaults.quality

  const outputDir =
    typeof candidate.outputDir === 'string' && candidate.outputDir.trim().length > 0
      ? candidate.outputDir
      : defaults.outputDir

  const shortcut =
    typeof candidate.shortcut === 'string' && isValidShortcut(candidate.shortcut)
      ? candidate.shortcut
      : defaults.shortcut

  return {
    resolution,
    customWidth: isIntegerInRange(candidate.customWidth, 2, 7680)
      ? candidate.customWidth
      : defaults.customWidth,
    customHeight: isIntegerInRange(candidate.customHeight, 2, 4320)
      ? candidate.customHeight
      : defaults.customHeight,
    fps: isIntegerInRange(candidate.fps, 1, 120) ? candidate.fps : defaults.fps,
    quality,
    countdownSeconds: isIntegerInRange(candidate.countdownSeconds, 0, 10)
      ? candidate.countdownSeconds
      : defaults.countdownSeconds,
    shortcut,
    outputDir,
    keepSource:
      typeof candidate.keepSource === 'boolean' ? candidate.keepSource : defaults.keepSource
  }
}

export function mergeSettings(
  current: Settings,
  patch: Partial<Settings>,
  defaults: Settings
): Settings {
  return sanitizeSettings({ ...current, ...patch }, defaults)
}
