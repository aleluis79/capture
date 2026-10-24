# Design: captura y exportación de sonido

## Context

"Captura" actualmente obtiene el vídeo en el renderer mediante `navigator.mediaDevices.getDisplayMedia({ audio: false, video: ... })`, lo codifica en un archivo intermedio `source.webm` con `MediaRecorder` y finalmente invoca FFmpeg en el proceso principal con `-an`. Ver `proposal.md` para la motivación y `specs/` para el contrato de comportamiento.

Restricciones técnicas relevantes:
- En modo región, el vídeo pasa por un `<canvas>` (`canvas.captureStream(fps)`), el cual solo genera una pista de vídeo; cualquier pista de audio debe adjuntarse explícitamente al `MediaStream` resultante.
- `MediaRecorder` en Chromium soporta una única pista de audio por contenedor WebM; si el usuario activa simultáneamente el audio del sistema y el micrófono, ambas señales deben mezclarse antes de entregarse al grabador.
- En Electron (`setDisplayMediaRequestHandler`), cuando el renderer solicita `audio: true`, el proceso principal puede responder con `{ video: source, audio: 'loopback' }` en plataformas compatibles (Windows y Linux con PipeWire/PulseAudio loopback), mientras que en sesiones Wayland con selector del sistema o fuentes de ventana es posible que el flujo devuelto no incluya pista de audio aunque se haya solicitado.

## Goals / Non-Goals

**Goals:**
- Permitir activar de forma independiente **Audio del sistema** y **Micrófono** (con selector de dispositivo de entrada).
- Mezclar limpiamente ambas fuentes en una sola pista cuando las dos estén activas, liberando el `AudioContext` y las pistas originales al detener o cancelar.
- Preservar el audio en los tres modos de grabación (`screen`, `window`, `region`).
- Exportar MP4 con vídeo H.264 y audio AAC (`128 kbps`, estéreo/48 kHz) cuando la grabación tenga audio, sin fallar si el archivo de entrada carece de pista de sonido.
- Mantener la arquitectura testeable bajo TDD (funciones puras para argumentos de FFmpeg y ajustes; mocks limpios de Web Audio y MediaDevices en UI).

**Non-Goals:**
- Mezclador multipista con controles de ganancia independientes o filtros DSP (puerta de ruido, compresor).
- Pistas de audio separadas en el archivo MP4 final.
- Captura de audio exclusiva por aplicación aislada (se captura el loopback del sistema).

## Decisions

### 1. Adquisición separada de audio del sistema y micrófono

- **Audio del sistema**: se solicita pasando `audio: systemAudio` en `getDisplayMedia`. En el proceso principal, `setDisplayMediaRequestHandler` comprueba `request.audioRequested`: si es `true`, adjunta `audio: 'loopback'` junto con la fuente de vídeo seleccionada. Si la plataforma o el portal no devuelven pista de audio (o si `callback({ video, audio: 'loopback' })` falla), se reintenta/continúa solo con vídeo para no bloquear la grabación.
- **Micrófono**: se adquiere mediante `navigator.mediaDevices.getUserMedia({ audio: micConstraint, video: false })`, donde `micConstraint` usa `{ deviceId: { ideal: micDeviceId } }` si se eligió un dispositivo concreto distinto de `'default'`, o `true` (con `echoCancellation`, `noiseSuppression` y `autoGainControl` activados) en caso contrario. Si `getUserMedia` falla con un dispositivo específico que fue desconectado (`OverconstrainedError` / `NotFoundError`), se reintenta con `audio: true` (predeterminado del sistema). Si el usuario deniega el permiso (`NotAllowedError`), se aborta el inicio y se informa en español.
- **Alternativa descartada**: capturar el micrófono desde FFmpeg en el proceso principal. Descartado porque rompería la sincronización con el reloj del `MediaRecorder` del renderer y complicaría la vista previa antes de exportar.

### 2. Mezcla en el renderer con Web Audio API (`AudioContext`)

- Si solo hay una fuente de audio activa (solo sistema con pista disponible, o solo micrófono), su `MediaStreamTrack` se usa directamente sin instanciar `AudioContext` para ahorrar CPU y latencia.
- Si hay pistas tanto de sistema como de micrófono, se crea un `AudioMixer` basado en `AudioContext` y `MediaStreamAudioDestinationNode`:
  - Cada `MediaStream` con pistas de audio se conecta mediante `ctx.createMediaStreamSource(stream) -> destination`.
  - La pista resultante `destination.stream.getAudioTracks()[0]` se incorpora al `MediaStream` final que consume `MediaRecorder`.
  - El objeto `AudioPipeline` expone un método `stop()` que detiene las pistas de entrada de micrófono/sistema y cierra el `AudioContext` (`void ctx.close().catch(() => undefined)`).
- **Alternativa descartada**: grabar dos WebM distintos y mezclarlos con `amix` en FFmpeg al exportar. Descartado porque impediría escuchar la mezcla en el reproductor de vista previa (`ReviewPanel`) antes de exportar.

### 3. Integración con el modo región y `MediaRecorder`

- En modo `screen` o `window`, el `MediaStream` final se construye combinando la pista de vídeo de `displayStream` y la pista de audio producida por el pipeline de audio.
- En modo `region`, `chooseRegion()` adquiere primero el fotograma para seleccionar el área; al confirmar e iniciar la grabación, el pipeline de región (`canvas.captureStream(fps)`) aporta la pista de vídeo recortada y se le añade (`stream.addTrack(audioTrack)`) la pista del pipeline de audio.
- En `chooseMimeType()`, cuando el `MediaStream` contiene pistas de audio (`stream.getAudioTracks().length > 0`), se priorizan los candidatos con códec de audio explícito: `'video/webm;codecs=vp9,opus'`, `'video/webm;codecs=vp8,opus'`, `'video/webm'`.

### 4. Exportación con FFmpeg y mapeo opcional de audio

- En `buildExportArgs(input)`:
  - Se añade una opción `includeAudio?: boolean` (por defecto `true` cuando no se especifica lo contrario).
  - Si `includeAudio` es `false`, se mantiene `-an`.
  - Si `includeAudio` es `true`, se reemplaza `-an` por:
    ```
    -map 0:v:0 -map 0:a:0? -c:a aac -b:a 128k
    ```
    El sufijo `?` en `-map 0:a:0?` es clave: hace que FFmpeg incluya y codifique la pista de audio en AAC si el WebM de entrada tiene audio, y que ignore silenciosamente el mapeo (sin fallar) si el WebM de entrada solo tiene vídeo.
  - Cuando se recortan inicio (`-ss`) y duración (`-t`), FFmpeg aplica el corte tanto a la pista de vídeo como a la de audio manteniendo la sincronía.

### 5. Modelo de datos y ajustes

- `Settings` se amplía con:
  - `systemAudio: boolean` (por defecto `false`)
  - `micAudio: boolean` (por defecto `false`)
  - `micDeviceId: string` (por defecto `'default'`)
- `HistoryEntry` y `RecorderFinishRequest` incorporan `hasAudio?: boolean` (calculado según si el stream grabado contenía pistas de audio y detectado por `probeMedia` al recuperar huérfanos).
- `PlatformInfo.canEnableSystemAudio` pasa a `true` en Windows y en Linux (`x11` y `wayland`, donde PipeWire/PulseAudio o el portal pueden proveer loopback).

## Risks / Trade-offs

- **El portal de Wayland o la captura de una ventana individual no entregan pista de audio del sistema** → `acquireDisplayStream` y el mezclador comprueban `displayStream.getAudioTracks().length`. Si es `0`, la grabación sigue adelante sin fallar y, si el micrófono estaba activo, graba el micrófono normalmente.
- **Fugas de recursos de `AudioContext` o del micrófono abierto al cancelar la cuenta atrás** → Toda adquisición de audio se registra en un `AudioPipeline` cuyo `stop()` se invoca en `cleanupStreams()`, cubriendo cancelación de cuenta atrás, detención normal, errores del codificador y desmontaje del componente.
- **Dispositivo de micrófono guardado ya no existe en otra sesión** → `sanitizeSettings` conserva el `micDeviceId` string, pero al enumerar dispositivos en la UI o al invocar `acquireMicStream` se hace fallback automático a `'default'` si el dispositivo no aparece o lanza `NotFoundError` / `OverconstrainedError`.

## Migration Plan

- `sanitizeSettings` asignará `systemAudio: false`, `micAudio: false` y `micDeviceId: 'default'` cuando cargue un `settings.json` existente de versiones anteriores que no contenga esos campos.
- Las entradas antiguas en `history.json` sin `hasAudio` se tratan como `hasAudio: false` (y gracias a `-map 0:a:0?` pueden reexportarse sin error).
