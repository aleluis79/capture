import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CapturaApi } from '@shared/api'
import type { HistoryEntry, Settings } from '@shared/types'
import { CountdownOverlay } from '@renderer/components/CountdownOverlay'
import { HistoryPanel } from '@renderer/components/HistoryPanel'
import { OrphanBanner } from '@renderer/components/OrphanBanner'
import { ReviewPanel } from '@renderer/components/ReviewPanel'
import type { ExportSelection } from '@renderer/components/ReviewPanel'
import { SettingsPanel } from '@renderer/components/SettingsPanel'

const settings: Settings = {
  resolution: '1080p',
  customWidth: 1920,
  customHeight: 1080,
  fps: 30,
  quality: 'medium',
  countdownSeconds: 3,
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

beforeEach(() => {
  window.api = {
    mediaUrl: (id: string) => `captura-media://${id}`,
    thumbUrl: (id: string) => `captura-media://${id}/thumb`
  } as unknown as CapturaApi
})

describe('CountdownOverlay', () => {
  it('muestra la cuenta atrás y permite cancelar', () => {
    const onCancel = vi.fn()
    render(<CountdownOverlay remaining={3} onCancel={onCancel} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

describe('ReviewPanel', () => {
  it('exporta el intervalo completo con la resolución y FPS por defecto', () => {
    const onExport = vi.fn<(selection: ExportSelection) => void>()
    render(
      <ReviewPanel
        entry={entry}
        defaults={settings}
        exporting={false}
        exportPercent={null}
        onExport={onExport}
        onCancelExport={vi.fn()}
        onNewRecording={vi.fn()}
        onDelete={vi.fn()}
        onReveal={vi.fn()}
      />
    )

    expect(screen.getByText('1920 × 1080 · 30 FPS')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar MP4' }))

    expect(onExport).toHaveBeenCalledWith({
      startMs: 0,
      endMs: 5000,
      width: 1920,
      height: 1080,
      fps: 30,
      quality: 'medium'
    })
  })

  it('muestra el progreso y permite cancelar durante la exportación', () => {
    const onCancelExport = vi.fn()
    render(
      <ReviewPanel
        entry={entry}
        defaults={settings}
        exporting
        exportPercent={42.5}
        onExport={vi.fn()}
        onCancelExport={onCancelExport}
        onNewRecording={vi.fn()}
        onDelete={vi.fn()}
        onReveal={vi.fn()}
      />
    )

    expect(screen.getByText('43%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelExport).toHaveBeenCalledOnce()
  })

  it('indica cuando la grabación incluye audio', () => {
    render(
      <ReviewPanel
        entry={{ ...entry, hasAudio: true }}
        defaults={settings}
        exporting={false}
        exportPercent={null}
        onExport={vi.fn()}
        onCancelExport={vi.fn()}
        onNewRecording={vi.fn()}
        onDelete={vi.fn()}
        onReveal={vi.fn()}
      />
    )

    expect(screen.getByText(/Con audio/)).toBeInTheDocument()
  })
})

describe('HistoryPanel', () => {
  it('muestra los metadatos y pide confirmación antes de eliminar', () => {
    const onDelete = vi.fn()
    render(
      <HistoryPanel
        entries={[entry]}
        cleanupBusy={false}
        onReexport={vi.fn()}
        onOpenFolder={vi.fn()}
        onRevealEntry={vi.fn()}
        onDelete={onDelete}
        onCleanup={vi.fn()}
      />
    )

    expect(screen.getByText(/0:05/)).toBeInTheDocument()
    expect(screen.getByText(/1920 × 1080/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Eliminar'))
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Sí, eliminar'))
    expect(onDelete).toHaveBeenCalledWith('entrada-1')
  })

  it('muestra el estado vacío', () => {
    render(
      <HistoryPanel
        entries={[]}
        cleanupBusy={false}
        onReexport={vi.fn()}
        onOpenFolder={vi.fn()}
        onRevealEntry={vi.fn()}
        onDelete={vi.fn()}
        onCleanup={vi.fn()}
      />
    )

    expect(screen.getByText('Todavía no has grabado nada.')).toBeInTheDocument()
  })

  it('marca las grabaciones que incluyen audio', () => {
    render(
      <HistoryPanel
        entries={[{ ...entry, hasAudio: true }]}
        cleanupBusy={false}
        onReexport={vi.fn()}
        onOpenFolder={vi.fn()}
        onRevealEntry={vi.fn()}
        onDelete={vi.fn()}
        onCleanup={vi.fn()}
      />
    )

    expect(screen.getByText('Con audio')).toBeInTheDocument()
  })
})

describe('SettingsPanel', () => {
  it('muestra las casillas de audio del sistema y micrófono', () => {
    render(
      <SettingsPanel
        settings={settings}
        cursorNotice="Aviso de cursor"
        audioInputs={[]}
        canEnableSystemAudio
        onChange={vi.fn()}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Audio del sistema' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Micrófono' })).not.toBeChecked()
    expect(screen.queryByLabelText('Dispositivo de entrada')).not.toBeInTheDocument()
  })

  it('activa el audio del sistema y el micrófono de forma independiente', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SettingsPanel
        settings={settings}
        cursorNotice="Aviso de cursor"
        audioInputs={[]}
        canEnableSystemAudio
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Audio del sistema' }))
    expect(onChange).toHaveBeenCalledWith({ systemAudio: true })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Micrófono' }))
    expect(onChange).toHaveBeenCalledWith({ micAudio: true })

    rerender(
      <SettingsPanel
        settings={{ ...settings, micAudio: true }}
        cursorNotice="Aviso de cursor"
        audioInputs={[
          { deviceId: 'mic-1', label: 'Micrófono USB' },
          { deviceId: 'mic-2', label: 'Auriculares' }
        ]}
        canEnableSystemAudio
        onChange={onChange}
      />
    )

    const select = screen.getByLabelText('Dispositivo de entrada')
    expect(select).toHaveValue('default')
    expect(screen.getByRole('option', { name: 'Predeterminado del sistema' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Micrófono USB' })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'mic-1' } })
    expect(onChange).toHaveBeenCalledWith({ micDeviceId: 'mic-1' })
  })

  it('desactiva el audio del sistema cuando la plataforma no lo soporta', () => {
    render(
      <SettingsPanel
        settings={{ ...settings, systemAudio: true }}
        cursorNotice="Aviso de cursor"
        audioInputs={[]}
        canEnableSystemAudio={false}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Audio del sistema' })).toBeDisabled()
  })

  it('ajusta la ganancia de cada fuente y la normalización', () => {
    const onChange = vi.fn()
    render(
      <SettingsPanel
        settings={{
          ...settings,
          systemAudio: true,
          micAudio: true,
          systemAudioGain: 2,
          micGain: 1.5,
          normalizeAudio: true
        }}
        cursorNotice="Aviso de cursor"
        audioInputs={[]}
        canEnableSystemAudio
        onChange={onChange}
      />
    )

    expect(screen.getByText('×2')).toBeInTheDocument()
    expect(screen.getByText('×1,5')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Volumen del sistema'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith({ systemAudioGain: 3 })

    fireEvent.change(screen.getByLabelText('Volumen del micrófono'), { target: { value: '0.7' } })
    expect(onChange).toHaveBeenCalledWith({ micGain: 0.7 })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Normalizar volumen al exportar' }))
    expect(onChange).toHaveBeenCalledWith({ normalizeAudio: false })
  })
})

describe('OrphanBanner', () => {
  it('permite recuperar o descartar una grabación interrumpida', () => {
    const onRecover = vi.fn()
    const onDiscard = vi.fn()

    render(
      <OrphanBanner
        orphans={[
          {
            id: 'huerfana-1',
            sourcePath: '/datos/recordings/huerfana-1/source.webm',
            sizeBytes: 2048,
            createdAt: '2026-10-22T17:45:00.000Z'
          }
        ]}
        busy={false}
        onRecover={onRecover}
        onDiscard={onDiscard}
      />
    )

    expect(screen.getByText('Grabaciones interrumpidas')).toBeInTheDocument()
    expect(screen.getByText(/2,0 KB/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Recuperar' }))
    expect(onRecover).toHaveBeenCalledWith('huerfana-1')

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onDiscard).toHaveBeenCalledWith('huerfana-1')
  })
})
