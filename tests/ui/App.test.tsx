import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CapturaApi } from '@shared/api'
import type { HistoryEntry, PlatformInfo, Settings } from '@shared/types'
import App from '@renderer/App'

const settings: Settings = {
  resolution: '1080p',
  customWidth: 1920,
  customHeight: 1080,
  fps: 30,
  quality: 'medium',
  countdownSeconds: 3,
  shortcut: 'Control+Alt+R',
  outputDir: '/home/alejandro/Vídeos/Capturas',
  keepSource: true
}

const waylandPlatform: PlatformInfo = {
  platform: 'linux',
  sessionType: 'wayland',
  needsSystemPicker: true,
  cursorNotice: 'El cursor lo incluye el portal de pantalla del sistema.',
  canEnableSystemAudio: false,
  appVersion: '0.1.0'
}

const x11Platform: PlatformInfo = {
  ...waylandPlatform,
  sessionType: 'x11',
  needsSystemPicker: false
}

const entry: HistoryEntry = {
  id: 'entrada-1',
  createdAt: '2026-10-22T17:45:00.000Z',
  durationMs: 5000,
  sizeBytes: 1_048_576,
  width: 1920,
  height: 1080,
  fps: 30,
  mode: 'screen',
  sourcePath: '/datos/entrada-1/source.webm',
  thumbPath: '/datos/entrada-1/thumb.jpg',
  exports: [],
  status: 'complete'
}

function createApi(overrides: Partial<CapturaApi> = {}): CapturaApi {
  const api: CapturaApi = {
    getPlatformInfo: vi.fn().mockResolvedValue(waylandPlatform),
    getSettings: vi.fn().mockResolvedValue(settings),
    updateSettings: vi.fn().mockImplementation(async (patch) => ({ ...settings, ...patch })),
    chooseOutputDir: vi.fn().mockResolvedValue(null),
    listSources: vi.fn().mockResolvedValue([]),
    setPendingSource: vi.fn().mockResolvedValue(undefined),
    startRecording: vi.fn(),
    appendChunk: vi.fn(),
    finishRecording: vi.fn(),
    abortRecording: vi.fn(),
    listHistory: vi.fn().mockResolvedValue([]),
    removeRecording: vi.fn().mockResolvedValue([]),
    openEntryFolder: vi.fn(),
    revealEntry: vi.fn(),
    cleanupSources: vi.fn(),
    listOrphans: vi.fn().mockResolvedValue([]),
    recoverOrphan: vi.fn(),
    discardOrphan: vi.fn(),
    chooseExportPath: vi.fn().mockResolvedValue(null),
    runExport: vi.fn(),
    cancelExport: vi.fn(),
    getShortcut: vi.fn().mockResolvedValue({
      accelerator: 'Control+Alt+R',
      registered: true,
      error: null
    }),
    setShortcut: vi.fn(),
    hideWindow: vi.fn(),
    showWindow: vi.fn(),
    revealPath: vi.fn(),
    mediaUrl: (id) => `captura-media://${id}`,
    thumbUrl: (id) => `captura-media://${id}/thumb`,
    onExportProgress: vi.fn().mockReturnValue(() => undefined),
    onShortcutToggle: vi.fn().mockReturnValue(() => undefined)
  }
  return { ...api, ...overrides }
}

beforeEach(() => {
  window.api = createApi()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('muestra la pantalla principal en Wayland con el aviso del selector del sistema', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Captura' })).toBeInTheDocument()
    expect(screen.getByText('La fuente se elige en el diálogo del sistema')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Grabar$/ }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1080p')).toBeInTheDocument()
  })

  it('cambia al modo región y pide seleccionar el área', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Captura' })

    fireEvent.click(screen.getByRole('tab', { name: /Región/ }))

    expect(screen.getByText('Selecciona el área que quieres grabar.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Seleccionar región' }).length).toBeGreaterThan(0)
  })

  it('muestra la galería de fuentes en X11 y permite elegir una ventana', async () => {
    window.api = createApi({
      getPlatformInfo: vi.fn().mockResolvedValue(x11Platform),
      listSources: vi.fn().mockResolvedValue([
        {
          id: 'screen:0:0',
          name: 'Pantalla 1',
          kind: 'screen',
          thumbnail: 'data:image/png;base64,AA==',
          displayId: '0'
        },
        {
          id: 'window:12:0',
          name: 'Editor de código',
          kind: 'window',
          thumbnail: 'data:image/png;base64,AA==',
          displayId: '0'
        }
      ])
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Captura' })

    expect(await screen.findByText('Pantalla 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Ventana/ }))
    expect(await screen.findByText('Editor de código')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla 1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Editor de código'))
    expect(window.api.setPendingSource).toHaveBeenCalledWith('window:12:0')
  })

  it('lista el historial y abre la revisión al reexportar', async () => {
    window.api = createApi({
      listHistory: vi.fn().mockResolvedValue([entry])
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Captura' })

    fireEvent.click(screen.getByRole('button', { name: 'Historial' }))

    expect(await screen.findByText('Reexportar')).toBeInTheDocument()
    expect(screen.getAllByText(/1,0 MB/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Reexportar'))
    expect(await screen.findByText('Revisa y exporta')).toBeInTheDocument()
  })
})
