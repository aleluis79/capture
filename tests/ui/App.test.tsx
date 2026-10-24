import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CapturaApi } from '@shared/api'
import type { HistoryEntry, PlatformInfo, Settings } from '@shared/types'
import App from '@renderer/App'

const captureMock = vi.hoisted(() => ({
  acquireDisplayStream: vi.fn(),
  acquireMicStream: vi.fn(),
  composeCaptureStream: vi.fn((stream: MediaStream) => stream),
  createAudioPipeline: vi.fn(
    (): {
      track: MediaStreamTrack | null
      hasAudio: boolean
      getLevel: () => number
      stop: () => void
    } => ({
      track: null,
      hasAudio: false,
      getLevel: () => 0,
      stop: vi.fn()
    })
  ),
  createMediaRecorder: vi.fn(),
  createRegionPipeline: vi.fn(),
  getStreamVideoSize: vi.fn(),
  listAudioInputs: vi.fn().mockResolvedValue([]),
  stopStream: vi.fn()
}))

vi.mock('../../src/renderer/src/lib/capture', () => captureMock)

const settings: Settings = {
  resolution: '1080p',
  customWidth: 1920,
  customHeight: 1080,
  fps: 30,
  quality: 'medium',
  countdownSeconds: 0,
  shortcut: 'Control+Alt+R',
  outputDir: '/home/alejandro/Vídeos/Capturas',
  keepSource: true,
  systemAudio: false,
  micAudio: false,
  micDeviceId: 'default',
  systemAudioGain: 1,
  micGain: 1,
  normalizeAudio: true
}

const waylandPlatform: PlatformInfo = {
  platform: 'linux',
  sessionType: 'wayland',
  needsSystemPicker: true,
  cursorNotice: 'El cursor lo incluye el portal de pantalla del sistema.',
  canEnableSystemAudio: true,
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
    appendChunk: vi.fn().mockResolvedValue(undefined),
    finishRecording: vi.fn(),
    abortRecording: vi.fn().mockResolvedValue(undefined),
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

function createDisplayHarness(): { stream: MediaStream; track: Record<string, unknown> } {
  const track = {
    getSettings: () => ({ width: 1280, height: 720 }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    stop: vi.fn()
  }

  const stream = {
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
    getTracks: () => [track]
  } as unknown as MediaStream

  return { stream, track }
}

beforeEach(() => {
  window.api = createApi()
  captureMock.listAudioInputs.mockResolvedValue([])
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

  it('carga los micrófonos y los ofrece al activar la captura de voz', async () => {
    captureMock.listAudioInputs.mockResolvedValue([
      { deviceId: 'mic-1', label: 'Micrófono USB' },
      { deviceId: 'mic-2', label: 'Auriculares' }
    ])

    render(<App />)
    await screen.findByRole('heading', { name: 'Captura' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Micrófono' }))

    expect(window.api.updateSettings).toHaveBeenCalledWith({ micAudio: true })
    expect(await screen.findByRole('option', { name: 'Micrófono USB' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Auriculares' })).toBeInTheDocument()
  })

  it('pasa los ajustes de audio al iniciar la grabación', async () => {
    const harness = createDisplayHarness()
    const audioTrack = { kind: 'audio', stop: vi.fn() } as unknown as MediaStreamTrack

    const recorder = {
      state: 'inactive' as 'inactive' | 'recording',
      ondataavailable: null,
      onstop: null,
      onerror: null,
      start: vi.fn(() => {
        recorder.state = 'recording'
      }),
      stop: vi.fn()
    }

    captureMock.acquireDisplayStream.mockResolvedValue(harness.stream)
    captureMock.acquireMicStream.mockResolvedValue(harness.stream)
    captureMock.createAudioPipeline.mockReturnValue({
      track: audioTrack,
      hasAudio: true,
      getLevel: () => 0.5,
      stop: vi.fn()
    })
    captureMock.getStreamVideoSize.mockResolvedValue({ width: 1280, height: 720 })
    captureMock.createMediaRecorder.mockReturnValue(recorder)

    window.api = createApi({
      getSettings: vi.fn().mockResolvedValue({
        ...settings,
        systemAudio: true,
        micAudio: true,
        micDeviceId: 'mic-1',
        systemAudioGain: 2,
        micGain: 1.5
      }),
      getPlatformInfo: vi.fn().mockResolvedValue(x11Platform),
      listSources: vi.fn().mockResolvedValue([
        {
          id: 'screen:0:0',
          name: 'Pantalla 1',
          kind: 'screen',
          thumbnail: 'data:image/png;base64,AA==',
          displayId: '0'
        }
      ]),
      startRecording: vi.fn().mockResolvedValue({ sessionId: 'sesion-audio' }),
      finishRecording: vi.fn().mockResolvedValue(entry),
      hideWindow: vi.fn().mockResolvedValue(undefined),
      showWindow: vi.fn().mockResolvedValue(undefined)
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Captura' })
    await waitFor(() =>
      expect(window.api.setPendingSource).toHaveBeenCalledWith('screen:0:0')
    )

    const recordButtons = screen.getAllByRole('button', { name: /^Grabar$/ })
    fireEvent.click(recordButtons[recordButtons.length - 1])

    await waitFor(() => expect(captureMock.acquireMicStream).toHaveBeenCalledWith('mic-1'))
    expect(captureMock.acquireDisplayStream).toHaveBeenCalledWith(30, true)
    expect(captureMock.createAudioPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ systemAudioGain: 2, micGain: 1.5 })
    )
    await waitFor(() =>
      expect(window.api.startRecording).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'screen', fps: 30 })
      )
    )
    await waitFor(() =>
      expect(screen.getByRole('meter', { name: 'Nivel de audio' })).toHaveAttribute(
        'aria-valuenow',
        '50'
      )
    )
  })
})
