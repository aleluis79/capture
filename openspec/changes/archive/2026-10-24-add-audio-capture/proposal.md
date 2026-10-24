# Proposal: agregar captura de sonido (sistema y micrófono)

## Why

Actualmente "Captura" graba únicamente imagen (`audio: false` en la adquisición y `-an` al exportar), lo que impide grabar tutoriales, demostraciones con voz o vídeos con sonido del escritorio. Incorporar captura opcional de audio del sistema y de micrófono (individualmente o mezclados) completa el flujo principal de grabación manteniendo la simplicidad de la interfaz.

## What Changes

- Controles independientes en el panel de ajustes de captura para activar **Audio del sistema** y **Micrófono**, más un selector de dispositivo de entrada de micrófono ("Predeterminado del sistema" y dispositivos detectados).
- Adquisición de audio del sistema mediante `getDisplayMedia` / `setDisplayMediaRequestHandler` (con `audio: 'loopback'` cuando la plataforma lo soporta o delegación al portal en Wayland) y degradación elegante si la fuente no entrega pista de audio.
- Adquisición de micrófono mediante `getUserMedia` con el dispositivo seleccionado y cancelación/limpieza segura de las pistas al detener o abortar.
- Mezcla de fuentes de audio mediante `AudioContext` + `MediaStreamAudioDestinationNode` cuando se activan simultáneamente audio del sistema y micrófono, e incorporación de la pista de audio resultante tanto en captura directa (pantalla/ventana) como en el pipeline de recorte por `canvas` (modo región) y en `MediaRecorder` (`video/webm;codecs=vp9,opus` / `vp8,opus`).
- Codificación de audio AAC (`-c:a aac -b:a 128k` con mapeo opcional `-map 0:a:0?`) en FFmpeg durante la exportación a MP4 H.264 cuando no se silencia la salida, manteniendo compatibilidad con grabaciones sin pista de audio.
- Persistencia de las preferencias de audio (`systemAudio`, `micAudio`, `micDeviceId`) en `settings.json` y metadato `hasAudio` en las entradas del historial.

## Capabilities

### New Capabilities

Ninguna: la captura, las preferencias y la exportación de sonido extienden las capacidades existentes del grabador.

### Modified Capabilities

- `screen-recording`: reemplaza la restricción de "Sin captura de audio" por la captura opcional de audio del sistema y micrófono, selección de dispositivo de entrada, mezcla en una pista única y preservación del audio en todos los modos (incluido modo región).
- `video-export`: actualiza la exportación MP4 H.264 para codificar la pista de audio en AAC cuando la grabación contiene sonido y respetar el recorte temporal tanto en vídeo como en audio.
- `app-preferences`: amplía los ajustes por defecto, su validación/persistencia y la información de capacidades de plataforma (`canEnableSystemAudio`) para recordar la configuración de sonido entre sesiones.

## Impact

- `src/shared/types.ts`, `src/shared/settings.ts`, `src/shared/export.ts`, `src/shared/history.ts`: nuevos campos de ajustes de audio (`systemAudio`, `micAudio`, `micDeviceId`), metadato `hasAudio` e inclusión de argumentos de audio AAC en `buildExportArgs`.
- `src/main/platform.ts`, `src/main/index.ts`, `src/main/ffmpeg.ts`: habilitación de `canEnableSystemAudio`, soporte de `audio: 'loopback'` en `setDisplayMediaRequestHandler` cuando se solicita audio del sistema y detección de pista de audio en `probeMedia`.
- `src/renderer/src/lib/capture.ts`, `src/renderer/src/hooks/useScreenRecorder.ts`: adquisición de micrófono, solicitud opcional de audio del sistema, mezclador Web Audio (`AudioContext`), adjunto de pista de audio al stream de región y selección de MIME con Opus.
- `src/renderer/src/components/SettingsPanel.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/i18n/es.ts`: controles de audio del sistema, micrófono y selector de dispositivo en español.
- Suite de tests en `tests/unit/` y `tests/ui/` siguiendo TDD con Vitest y Testing Library.
