import { describe, expect, it } from 'vitest'
import {
  createDefaultSettings,
  isValidShortcut,
  mergeSettings,
  sanitizeSettings
} from '@shared/settings'

const defaults = createDefaultSettings('/home/alejandro/Vídeos/Capturas')

describe('createDefaultSettings', () => {
  it('usa 1080p, 30 FPS, calidad media y 3 s de cuenta atrás con audio desactivado por defecto', () => {
    expect(defaults).toMatchObject({
      resolution: '1080p',
      fps: 30,
      quality: 'medium',
      countdownSeconds: 3,
      keepSource: true,
      systemAudio: false,
      micAudio: false,
      micDeviceId: 'default',
      systemAudioGain: 1,
      micGain: 1,
      normalizeAudio: true
    })
  })

  it('propone el atajo Ctrl+Alt+R y la carpeta indicada', () => {
    expect(defaults.shortcut).toBe('Control+Alt+R')
    expect(defaults.outputDir).toBe('/home/alejandro/Vídeos/Capturas')
  })
})

describe('isValidShortcut', () => {
  it.each(['Control+Alt+R', 'Ctrl+Shift+F12', 'Super+Alt+Space', 'CommandOrControl+Alt+R'])(
    'acepta %s',
    (shortcut) => {
      expect(isValidShortcut(shortcut)).toBe(true)
    }
  )

  it.each(['', 'R', 'Control+', 'Control+Alt+', 'Alt'])('rechaza %s', (shortcut) => {
    expect(isValidShortcut(shortcut)).toBe(false)
  })
})

describe('sanitizeSettings', () => {
  it('devuelve los valores por defecto para una entrada que no es un objeto', () => {
    expect(sanitizeSettings(null, defaults)).toEqual(defaults)
    expect(sanitizeSettings('texto', defaults)).toEqual(defaults)
    expect(sanitizeSettings([], defaults)).toEqual(defaults)
  })

  it('conserva valores válidos incluidos los ajustes de audio', () => {
    const custom = {
      ...defaults,
      resolution: '720p',
      fps: 60,
      quality: 'high',
      countdownSeconds: 1,
      outputDir: '/tmp/salida',
      keepSource: false,
      systemAudio: true,
      micAudio: true,
      micDeviceId: 'usb-mic-1',
      systemAudioGain: 2.5,
      micGain: 0.5,
      normalizeAudio: false
    }

    expect(sanitizeSettings(custom, defaults)).toEqual(custom)
  })

  it('sanea ganancias fuera de rango y normalización inválida', () => {
    const result = sanitizeSettings(
      {
        ...defaults,
        systemAudioGain: 0.1,
        micGain: 9,
        normalizeAudio: 'sí'
      },
      defaults
    )

    expect(result.systemAudioGain).toBe(1)
    expect(result.micGain).toBe(1)
    expect(result.normalizeAudio).toBe(true)
  })

  it('sanea ajustes de audio inválidos a los valores por defecto', () => {
    const result = sanitizeSettings(
      {
        ...defaults,
        systemAudio: 'yes',
        micAudio: 1,
        micDeviceId: '   '
      },
      defaults
    )

    expect(result.systemAudio).toBe(false)
    expect(result.micAudio).toBe(false)
    expect(result.micDeviceId).toBe('default')
  })

  it('ignora claves desconocidas', () => {
    const result = sanitizeSettings({ ...defaults, foo: 'bar' }, defaults)
    expect(result).not.toHaveProperty('foo')
  })

  it('reemplaza valores inválidos por los de por defecto', () => {
    const result = sanitizeSettings(
      {
        ...defaults,
        resolution: '4k',
        fps: 0,
        quality: 'ultra',
        countdownSeconds: 99,
        shortcut: 'R',
        outputDir: '',
        keepSource: 'sí'
      },
      defaults
    )

    expect(result).toEqual(defaults)
  })

  it('admite una resolución personalizada válida', () => {
    const result = sanitizeSettings(
      { ...defaults, resolution: 'custom', customWidth: 1000, customHeight: 600 },
      defaults
    )

    expect(result).toMatchObject({ resolution: 'custom', customWidth: 1000, customHeight: 600 })
  })

  it('limita los FPS al rango permitido', () => {
    expect(sanitizeSettings({ ...defaults, fps: 240 }, defaults).fps).toBe(defaults.fps)
    expect(sanitizeSettings({ ...defaults, fps: 120 }, defaults).fps).toBe(120)
    expect(sanitizeSettings({ ...defaults, fps: 1 }, defaults).fps).toBe(1)
  })

  it('recupera el archivo corrupto con los valores por defecto', () => {
    expect(sanitizeSettings({ roto: true }, defaults)).toEqual(defaults)
  })
})

describe('mergeSettings', () => {
  it('aplica solo los campos presentes', () => {
    expect(mergeSettings(defaults, { fps: 60 }, defaults)).toMatchObject({
      fps: 60,
      resolution: '1080p'
    })
  })

  it('no muta el objeto original', () => {
    const current = { ...defaults }
    mergeSettings(current, { fps: 60 }, defaults)
    expect(current.fps).toBe(30)
  })

  it('sanea los campos inválidos del parche', () => {
    expect(mergeSettings(defaults, { fps: -1 }, defaults).fps).toBe(defaults.fps)
  })
})
