# Proposal: nivel de audio audible y medidor en la grabación

## Why

En las pruebas reales, el audio del sistema se graba a un nivel notablemente bajo: la captura por loopback hereda el volumen del sumidero y la app no aplica ganancia ni normalización. Sin una referencia visual, además, es difícil saber si el sonido se está captando antes de detener la grabación.

## What Changes

- Añadir **ganancia de entrada configurable** para el audio del sistema y para el micrófono (0,5×–4×, con 1× por defecto), aplicada en el pipeline de mezcla mediante `GainNode`.
- Añadir **normalización de sonoridad al exportar** (activada por defecto) con el filtro `loudnorm` de FFmpeg (`I=-16:TP=-1.5:LRA=11`) y un ajuste persistente para desactivarla.
- Añadir un **medidor de nivel en vivo** durante la grabación, calculado con `AnalyserNode` sobre la señal ya ganada, para confirmar visualmente que hay audio.
- Extender los ajustes persistentes con `systemAudioGain`, `micGain` y `normalizeAudio`, con validación y valores por defecto.
- Mostrar el medidor en la barra de grabación en español, sin añadir controles durante la captura.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `screen-recording`: añade ganancia de entrada por fuente y medidor de nivel en vivo durante la captura, incluyendo el modo región.
- `video-export`: añade la normalización de sonoridad opcional de la pista de audio en el MP4 exportado.
- `app-preferences`: añade los nuevos ajustes de ganancia y normalización, sus valores por defecto y su validación.

## Impact

- `src/shared/types.ts`, `src/shared/settings.ts`: campos `systemAudioGain`, `micGain` y `normalizeAudio`, con saneamiento de rango.
- `src/shared/export.ts`: filtro `loudnorm` condicionado a `normalizeAudio` e `includeAudio`.
- `src/main/exporter.ts`, `src/main/index.ts`: propagación de `normalizeAudio` desde los ajustes a FFmpeg.
- `src/renderer/src/lib/capture.ts`: `GainNode` por fuente y `AnalyserNode` con `getLevel()`.
- `src/renderer/src/hooks/useScreenRecorder.ts`: estado `audioLevel`, muestreo periódico y limpieza.
- `src/renderer/src/components/SettingsPanel.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/styles.css`, `src/renderer/src/i18n/es.ts`: controles de ganancia, casilla de normalización y medidor.
- Tests unitarios, de UI y de integración con FFmpeg (medición de `mean_volume`).
