import type { PlatformInfo, SessionType } from '@shared/types'

interface SwitchTarget {
  commandLine: {
    appendSwitch(name: string, value?: string): void
  }
}

export function detectSessionType(
  platform: string,
  env: Record<string, string | undefined>
): SessionType {
  if (platform === 'win32') {
    return 'windows'
  }

  if (env['XDG_SESSION_TYPE'] === 'wayland' || Boolean(env['WAYLAND_DISPLAY'])) {
    return 'wayland'
  }

  if (env['XDG_SESSION_TYPE'] === 'x11' || Boolean(env['DISPLAY'])) {
    return 'x11'
  }

  return 'unknown'
}

export function needsSystemPicker(sessionType: SessionType): boolean {
  return sessionType === 'wayland'
}

export function platformSwitches(sessionType: SessionType): Array<[string, string]> {
  if (sessionType !== 'wayland') {
    return []
  }

  return [
    ['ozone-platform-hint', 'auto'],
    ['enable-features', 'WebRTCPipeWireCapturer']
  ]
}

export function applyPlatformSwitches(target: SwitchTarget, sessionType: SessionType): void {
  for (const [name, value] of platformSwitches(sessionType)) {
    target.commandLine.appendSwitch(name, value)
  }
}

export function cursorNotice(sessionType: SessionType): string {
  switch (sessionType) {
    case 'wayland':
      return 'El cursor lo incluye el portal de pantalla del sistema; no se puede desactivar desde la app.'
    case 'windows':
      return 'El cursor se incluye automáticamente en la grabación según la configuración de Windows.'
    case 'x11':
      return 'El cursor se incluye automáticamente en la captura del servidor gráfico.'
    default:
      return 'El cursor se incluye automáticamente cuando la plataforma lo permite.'
  }
}

export function buildPlatformInfo(
  platform: string,
  sessionType: SessionType,
  appVersion: string
): PlatformInfo {
  return {
    platform,
    sessionType,
    needsSystemPicker: needsSystemPicker(sessionType),
    cursorNotice: cursorNotice(sessionType),
    canEnableSystemAudio: false,
    appVersion
  }
}
