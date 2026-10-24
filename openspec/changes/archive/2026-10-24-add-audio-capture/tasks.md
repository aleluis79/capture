# Tasks: agregar captura de sonido (sistema y micrófono)

## 1. Dominio compartido: ajustes, tipos y argumentos de exportación (TDD)

- [x] 1.1 Añadir tests unitarios en `tests/unit/settings.test.ts` para los nuevos valores por defecto (`systemAudio: false`, `micAudio: false`, `micDeviceId: 'default'`) y su sanitización/mezcla en `sanitizeSettings` y `mergeSettings`, verificando que primero fallan y luego pasan tras actualizar `src/shared/types.ts` y `src/shared/settings.ts` con `pnpm test:unit -- tests/unit/settings.test.ts`.
- [x] 1.2 Añadir tests unitarios en `tests/unit/export.test.ts` para `buildExportArgs` cubriendo exportación con audio AAC (`-map 0:v:0 -map 0:a:0? -c:a aac -b:a 128k` por defecto o cuando `includeAudio: true`) y exportación silenciada (`-an` cuando `includeAudio: false`), verificando que pasan tras actualizar `src/shared/export.ts` con `pnpm test:unit -- tests/unit/export.test.ts`.
- [x] 1.3 Añadir soporte de metadato opcional `hasAudio?: boolean` en `HistoryEntry`, `RecorderFinishRequest` y `MediaProbe`, junto con tests en `tests/unit/history.test.ts` y `tests/unit/historyStore.test.ts`, verificando con `pnpm test:unit -- tests/unit/history.test.ts tests/unit/historyStore.test.ts`.

## 2. Proceso principal: plataforma, handler de pantalla y sonda FFmpeg (TDD)

- [x] 2.1 Actualizar `tests/unit/platform.test.ts` y `src/main/platform.ts` para que `buildPlatformInfo` active `canEnableSystemAudio: true` en sesiones `windows`, `x11` y `wayland` (`false` en `unknown`), verificando con `pnpm test:unit -- tests/unit/platform.test.ts`.
- [x] 2.2 Añadir tests en `tests/unit/ffmpeg.test.ts` y actualizar `probeMedia` en `src/main/ffmpeg.ts` para detectar la presencia de `Stream #...: Audio:` en la salida de FFmpeg (`hasAudio: boolean`), verificando con `pnpm test:unit -- tests/unit/ffmpeg.test.ts`.
- [x] 2.3 Actualizar `registerDisplayMediaHandler` y `IPC.recorderFinish` / `IPC.historyRecover` en `src/main/index.ts` para que cuando `request.audioRequested` sea `true` responda con `audio: 'loopback'` (con fallback a solo vídeo ante error) y registre `hasAudio` en la entrada del historial, verificando la compilación con `pnpm typecheck`.

## 3. Captura, selección de micrófono y mezcla de audio en el renderer (TDD)

- [x] 3.1 Crear tests para `acquireDisplayStream`, `acquireMicStream`, `listAudioInputs`, `createAudioPipeline` y `chooseMimeType` (con soporte de pistas de audio, mezcla por `AudioContext` cuando hay sistema + micrófono, fallback a micrófono predeterminado si el dispositivo desconectado lanza `NotFoundError`/`OverconstrainedError`, y adjunto de audio en `createRegionPipeline`), implementando las funciones en `src/renderer/src/lib/capture.ts` y verificando con `pnpm test:unit` / `pnpm test:ui`.
- [x] 3.2 Ampliar `tests/ui/useScreenRecorder.test.tsx` para cubrir grabación sin audio, solo audio del sistema, solo micrófono, ambos mezclados, modo región con audio, degradación cuando la fuente no entrega audio del sistema, error en español cuando se rechaza el permiso del micrófono y limpieza de pistas/`AudioContext` al cancelar o detener; actualizar `src/renderer/src/hooks/useScreenRecorder.ts` y verificar con `pnpm test:ui -- tests/ui/useScreenRecorder.test.tsx`.

## 4. Interfaz de usuario en español y conexión completa (TDD)

- [x] 4.1 Añadir los textos en español para controles de audio del sistema, micrófono, selector de dispositivo de entrada y errores de permiso de micrófono en `src/renderer/src/i18n/es.ts`, verificando con `pnpm typecheck`.
- [x] 4.2 Actualizar `tests/ui/components.test.tsx` y `src/renderer/src/components/SettingsPanel.tsx` para reemplazar el distintivo estático "Sin audio" por las casillas de **Audio del sistema** y **Micrófono**, más el desplegable de selección de micrófono cuando el micrófono está activo, verificando con `pnpm test:ui -- tests/ui/components.test.tsx`.
- [x] 4.3 Actualizar `tests/ui/App.test.tsx` y `src/renderer/src/App.tsx` para enumerar dispositivos de entrada de audio (`listAudioInputs`), pasar `systemAudio`, `micAudio` y `micDeviceId` a `recorder.start` en todos los modos (incluido `region`) y reflejar indicadores de audio en historial/revisión, verificando con `pnpm test:ui -- tests/ui/App.test.tsx`.

## 5. Verificación integral

- [x] 5.1 Ejecutar `pnpm typecheck`, `pnpm lint` y `pnpm test` para comprobar que todos los tests unitarios y de interfaz pasan sin errores ni regresiones.
- [x] 5.2 Validar los artefactos de OpenSpec con `openspec validate "add-audio-capture"`.
