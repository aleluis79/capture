import { describe, expect, it } from 'vitest'
import {
  applyPlatformSwitches,
  buildPlatformInfo,
  cursorNotice,
  detectSessionType,
  needsSystemPicker,
  platformSwitches
} from '@main/platform'

describe('detectSessionType', () => {
  it('detecta Windows por plataforma', () => {
    expect(detectSessionType('win32', {})).toBe('windows')
  })

  it('detecta Wayland por XDG_SESSION_TYPE', () => {
    expect(detectSessionType('linux', { XDG_SESSION_TYPE: 'wayland' })).toBe('wayland')
  })

  it('detecta Wayland por WAYLAND_DISPLAY', () => {
    expect(detectSessionType('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe('wayland')
  })

  it('detecta X11 por XDG_SESSION_TYPE', () => {
    expect(detectSessionType('linux', { XDG_SESSION_TYPE: 'x11' })).toBe('x11')
  })

  it('detecta X11 por DISPLAY', () => {
    expect(detectSessionType('linux', { DISPLAY: ':0' })).toBe('x11')
  })

  it('devuelve unknown sin información', () => {
    expect(detectSessionType('linux', {})).toBe('unknown')
  })
})

describe('needsSystemPicker', () => {
  it('solo es necesario en Wayland', () => {
    expect(needsSystemPicker('wayland')).toBe(true)
    expect(needsSystemPicker('x11')).toBe(false)
    expect(needsSystemPicker('windows')).toBe(false)
  })
})

describe('platformSwitches', () => {
  it('activa PipeWire y el hint de Ozone en Wayland', () => {
    const switches = platformSwitches('wayland')
    expect(switches).toContainEqual(['ozone-platform-hint', 'auto'])
    expect(switches).toContainEqual(['enable-features', 'WebRTCPipeWireCapturer'])
  })

  it('no añade switches fuera de Wayland', () => {
    expect(platformSwitches('windows')).toEqual([])
    expect(platformSwitches('x11')).toEqual([])
  })
})

describe('applyPlatformSwitches', () => {
  it('aplica los switches al objeto de la app', () => {
    const calls: Array<[string, string | undefined]> = []
    const target = {
      commandLine: {
        appendSwitch(name: string, value?: string) {
          calls.push([name, value])
        }
      }
    }

    applyPlatformSwitches(target, 'wayland')
    expect(calls).toEqual([
      ['ozone-platform-hint', 'auto'],
      ['enable-features', 'WebRTCPipeWireCapturer']
    ])
  })
})

describe('cursorNotice', () => {
  it('explica que el cursor lo incluye el sistema', () => {
    expect(cursorNotice('wayland')).toContain('portal')
    expect(cursorNotice('windows')).toContain('automáticamente')
  })
})

describe('buildPlatformInfo', () => {
  it('marca la necesidad del selector del sistema en Wayland y habilita audio del sistema', () => {
    const info = buildPlatformInfo('linux', 'wayland', '0.1.0')
    expect(info).toMatchObject({
      platform: 'linux',
      sessionType: 'wayland',
      needsSystemPicker: true,
      canEnableSystemAudio: true,
      appVersion: '0.1.0'
    })
  })

  it('no exige selector del sistema en Windows y habilita audio del sistema', () => {
    const info = buildPlatformInfo('win32', 'windows', '0.1.0')
    expect(info.needsSystemPicker).toBe(false)
    expect(info.canEnableSystemAudio).toBe(true)
  })

  it('habilita audio del sistema en X11 y lo desactiva en unknown', () => {
    expect(buildPlatformInfo('linux', 'x11', '0.1.0').canEnableSystemAudio).toBe(true)
    expect(buildPlatformInfo('linux', 'unknown', '0.1.0').canEnableSystemAudio).toBe(false)
  })
})
