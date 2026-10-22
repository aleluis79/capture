import { useEffect, useMemo, useRef, useState } from 'react'
import { isValidRegion, normalizeRegion, regionFromPoints } from '@shared/region'
import type { Point, Region, Size } from '@shared/types'
import { t } from '../i18n/es'

interface RegionSelectorProps {
  stream: MediaStream
  onConfirm: (region: Region) => void
  onCancel: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function RegionSelector({ stream, onConfirm, onCancel }: RegionSelectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<Size | null>(null)
  const [start, setStart] = useState<Point | null>(null)
  const [end, setEnd] = useState<Point | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.srcObject = stream
    video.muted = true

    const handleMetadata = (): void => {
      setNatural({ width: video.videoWidth, height: video.videoHeight })
      void video
        .play()
        .then(() => {
          video.requestVideoFrameCallback(() => {
            video.pause()
          })
        })
        .catch(() => undefined)
    }

    const handleError = (): void => {
      setError(t.errors.regionFrame)
    }

    if (video.readyState >= 1) {
      handleMetadata()
    } else {
      video.addEventListener('loadedmetadata', handleMetadata, { once: true })
    }
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata)
      video.removeEventListener('error', handleError)
      video.pause()
      video.srcObject = null
    }
  }, [stream])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const naturalPoint = (event: React.PointerEvent<HTMLDivElement>): Point | null => {
    const surface = surfaceRef.current
    if (!surface || !natural) {
      return null
    }
    const rect = surface.getBoundingClientRect()
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * natural.width, 0, natural.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * natural.height, 0, natural.height)
    }
  }

  const region = useMemo(() => {
    if (!natural || !start || !end) {
      return null
    }
    return normalizeRegion(regionFromPoints(start, end), natural)
  }, [natural, start, end])

  const valid = region !== null && isValidRegion(region)

  const boxStyle =
    region && natural
      ? {
          left: `${(region.x / natural.width) * 100}%`,
          top: `${(region.y / natural.height) * 100}%`,
          width: `${(region.width / natural.width) * 100}%`,
          height: `${(region.height / natural.height) * 100}%`
        }
      : undefined

  return (
    <div className="overlay region-overlay" role="dialog" aria-modal="true">
      <div className="region-dialog">
        <header className="dialog-header">
          <div>
            <h2>{t.capture.regionDialogTitle}</h2>
            <p className="muted">{t.capture.regionDialogHint}</p>
          </div>
        </header>

        {error ? (
          <div className="notice notice-error">{error}</div>
        ) : (
          <div
            ref={surfaceRef}
            className="region-surface"
            style={natural ? { aspectRatio: `${natural.width} / ${natural.height}` } : undefined}
            onPointerDown={(event) => {
              const point = naturalPoint(event)
              if (!point) {
                return
              }
              event.currentTarget.setPointerCapture(event.pointerId)
              setStart(point)
              setEnd(point)
              setDragging(true)
            }}
            onPointerMove={(event) => {
              if (!dragging) {
                return
              }
              const point = naturalPoint(event)
              if (point) {
                setEnd(point)
              }
            }}
            onPointerUp={(event) => {
              if (!dragging) {
                return
              }
              const point = naturalPoint(event)
              if (point) {
                setEnd(point)
              }
              setDragging(false)
            }}
            onPointerCancel={() => setDragging(false)}
          >
            <video ref={videoRef} muted playsInline />
            {region && <div className="region-box" style={boxStyle} />}
            {!natural && <div className="region-loading">{t.capture.regionPreparing}</div>}
          </div>
        )}

        <footer className="dialog-footer">
          <span className="region-size">
            {region ? `${region.width} × ${region.height} px` : t.capture.regionDragHint}
          </span>
          <div className="dialog-actions">
            <button type="button" className="btn ghost" onClick={onCancel}>
              {t.actions.cancel}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!valid}
              onClick={() => region && onConfirm(region)}
            >
              {t.capture.useRegion}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
