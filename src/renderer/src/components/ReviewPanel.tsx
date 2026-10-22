import { useMemo, useRef, useState } from 'react'
import { formatBytes, formatDuration } from '@shared/format'
import { resolveOutputDimensions } from '@shared/region'
import { validateTrim } from '@shared/trim'
import type { HistoryEntry, QualityPreset, ResolutionPreset, Settings } from '@shared/types'
import { t } from '../i18n/es'

export interface ExportSelection {
  startMs: number
  endMs: number
  width: number
  height: number
  fps: number
  quality: QualityPreset
}

interface ReviewPanelProps {
  entry: HistoryEntry
  defaults: Settings
  exporting: boolean
  exportPercent: number | null
  onExport: (selection: ExportSelection) => void
  onCancelExport: () => void
  onNewRecording: () => void
  onDelete: () => void
  onReveal: (path: string) => void
}

const RESOLUTIONS: Array<{ value: ResolutionPreset; label: string }> = [
  { value: 'native', label: t.settings.native },
  { value: '2160p', label: '2160p' },
  { value: '1440p', label: '1440p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: 'custom', label: t.settings.custom }
]

const FPS_OPTIONS = [15, 24, 30, 60]

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function ReviewPanel({
  entry,
  defaults,
  exporting,
  exportPercent,
  onExport,
  onCancelExport,
  onNewRecording,
  onDelete,
  onReveal
}: ReviewPanelProps) {
  const [startMs, setStartMs] = useState(0)
  const [endMs, setEndMs] = useState(entry.durationMs)
  const [resolution, setResolution] = useState<ResolutionPreset>(defaults.resolution)
  const [customWidth, setCustomWidth] = useState(defaults.customWidth)
  const [customHeight, setCustomHeight] = useState(defaults.customHeight)
  const [fps, setFps] = useState(defaults.fps)
  const [quality, setQuality] = useState<QualityPreset>(defaults.quality)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const trim = validateTrim(startMs, endMs, entry.durationMs)

  const sourceSize =
    entry.width > 1 && entry.height > 1
      ? { width: entry.width, height: entry.height }
      : { width: 1920, height: 1080 }

  const outputSize = useMemo(
    () =>
      resolveOutputDimensions({
        preset: resolution,
        source: sourceSize,
        customWidth,
        customHeight
      }),
    [resolution, sourceSize.width, sourceSize.height, customWidth, customHeight]
  )

  const trimError = trim.valid ? null : t.review.trimError[trim.error]

  const latestExport = [...entry.exports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  return (
    <div className="review-layout">
      <section className="panel review-preview">
        <div className="panel-heading">
          <div>
            <h2>{t.review.title}</h2>
            <p className="muted">
              {formatDate(entry.createdAt)} · {formatDuration(entry.durationMs)} ·{' '}
              {formatBytes(entry.sizeBytes)}
            </p>
          </div>
          <button type="button" className="btn ghost small" onClick={onNewRecording}>
            {t.actions.newRecording}
          </button>
        </div>

        <video
          ref={videoRef}
          className="preview-video"
          src={window.api.mediaUrl(entry.id)}
          controls
        />

        <div className="trim-section">
          <div className="trim-heading">
            <h3>{t.review.trim}</h3>
            <span className="muted">
              {formatDuration(trim.valid ? trim.startMs : startMs)} —{' '}
              {formatDuration(trim.valid ? trim.endMs : endMs)}
            </span>
          </div>

          <label className="trim-row">
            <span>{t.review.start}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, entry.durationMs)}
              step={100}
              value={startMs}
              disabled={exporting}
              onChange={(event) => {
                const value = Number(event.target.value)
                setStartMs(Math.min(value, endMs - 100))
              }}
            />
            <button
              type="button"
              className="btn ghost tiny"
              disabled={exporting}
              onClick={() => {
                const current = Math.round((videoRef.current?.currentTime ?? 0) * 1000)
                setStartMs(Math.min(current, endMs - 100))
              }}
            >
              {t.actions.markStart}
            </button>
          </label>

          <label className="trim-row">
            <span>{t.review.end}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, entry.durationMs)}
              step={100}
              value={endMs}
              disabled={exporting}
              onChange={(event) => {
                const value = Number(event.target.value)
                setEndMs(Math.max(value, startMs + 100))
              }}
            />
            <button
              type="button"
              className="btn ghost tiny"
              disabled={exporting}
              onClick={() => {
                const current = Math.round((videoRef.current?.currentTime ?? 0) * 1000)
                setEndMs(Math.max(current, startMs + 100))
              }}
            >
              {t.actions.markEnd}
            </button>
          </label>

          {trimError && <p className="form-error">{trimError}</p>}
        </div>
      </section>

      <section className="panel review-export">
        <div className="panel-heading">
          <h2>{t.review.exportSettings}</h2>
        </div>

        <label className="field">
          <span>{t.settings.resolution}</span>
          <select
            value={resolution}
            disabled={exporting}
            onChange={(event) => setResolution(event.target.value as ResolutionPreset)}
          >
            {RESOLUTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {resolution === 'custom' && (
          <div className="custom-size-row">
            <label className="field compact">
              <span>{t.settings.width}</span>
              <input
                type="number"
                min={2}
                max={7680}
                value={customWidth}
                disabled={exporting}
                onChange={(event) => {
                  const value = event.target.valueAsNumber
                  if (Number.isFinite(value)) {
                    setCustomWidth(Math.max(2, Math.min(7680, Math.round(value))))
                  }
                }}
              />
            </label>
            <span className="times">×</span>
            <label className="field compact">
              <span>{t.settings.height}</span>
              <input
                type="number"
                min={2}
                max={4320}
                value={customHeight}
                disabled={exporting}
                onChange={(event) => {
                  const value = event.target.valueAsNumber
                  if (Number.isFinite(value)) {
                    setCustomHeight(Math.max(2, Math.min(4320, Math.round(value))))
                  }
                }}
              />
            </label>
          </div>
        )}

        <div className="field">
          <span>{t.settings.fps}</span>
          <div className="fps-row">
            <select
              value={FPS_OPTIONS.includes(fps) ? String(fps) : 'custom'}
              disabled={exporting}
              onChange={(event) => {
                if (event.target.value !== 'custom') {
                  setFps(Number(event.target.value))
                }
              }}
            >
              {FPS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} FPS
                </option>
              ))}
              <option value="custom">{t.settings.custom}</option>
            </select>
            <input
              type="number"
              min={1}
              max={120}
              value={fps}
              disabled={exporting}
              aria-label={t.review.exportFpsAria}
              onChange={(event) => {
                const value = event.target.valueAsNumber
                if (Number.isFinite(value)) {
                  setFps(Math.min(120, Math.max(1, Math.round(value))))
                }
              }}
            />
          </div>
        </div>

        <label className="field">
          <span>{t.settings.quality}</span>
          <select
            value={quality}
            disabled={exporting}
            onChange={(event) => setQuality(event.target.value as QualityPreset)}
          >
            <option value="high">{t.settings.qualityHigh}</option>
            <option value="medium">{t.settings.qualityMedium}</option>
            <option value="low">{t.settings.qualityLow}</option>
          </select>
        </label>

        <div className="output-summary">
          <span>{t.review.outputSize}</span>
          <strong>
            {outputSize.width} × {outputSize.height} · {fps} FPS
          </strong>
        </div>

        {exporting ? (
          <div className="export-progress">
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${exportPercent ?? 0}%` }} />
            </div>
            <div className="progress-meta">
              <span>{t.review.progress}</span>
              <span>{Math.round(exportPercent ?? 0)}%</span>
            </div>
            <button type="button" className="btn ghost" onClick={onCancelExport}>
              {t.actions.cancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn primary block"
            disabled={!trim.valid}
            onClick={() =>
              trim.valid &&
              onExport({
                startMs: trim.startMs,
                endMs: trim.endMs,
                width: outputSize.width,
                height: outputSize.height,
                fps,
                quality
              })
            }
          >
            {t.actions.export}
          </button>
        )}

        {latestExport && (
          <div className="latest-export">
            <span>{t.review.exports}</span>
            <code title={latestExport.path}>{latestExport.path}</code>
            <button
              type="button"
              className="btn ghost tiny"
              onClick={() => onReveal(latestExport.path)}
            >
              {t.actions.reveal}
            </button>
          </div>
        )}

        <div className="danger-zone">
          {confirmDelete ? (
            <div className="inline-confirm">
              <span>{t.review.deleteConfirm}</span>
              <button type="button" className="btn danger small" onClick={onDelete}>
                {t.actions.confirm}
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setConfirmDelete(false)}
              >
                {t.actions.no}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setConfirmDelete(true)}
            >
              {t.actions.deleteTemporary}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
