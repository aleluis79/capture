# Tasks: nivel de audio audible y medidor

## 1. Dominio compartido: ajustes y argumentos de exportación (TDD)

- [x] 1.1 Añadir tests en `tests/unit/settings.test.ts` para `systemAudioGain`, `micGain` y `normalizeAudio` (valores por defecto 1, 1 y `true`, rango 0,5–4 y saneamiento de tipos), e implementarlos en `src/shared/types.ts` y `src/shared/settings.ts`; verificar con `pnpm test tests/unit/settings.test.ts`.
- [x] 1.2 Añadir tests en `tests/unit/export.test.ts` para `buildExportArgs` con `normalizeAudio: true` (incluye `-af loudnorm=I=-16:TP=-1.5:LRA=11`), `normalizeAudio: false` (sin `-af`) y sin audio (sin filtro); implementar en `src/shared/export.ts` y verificar con `pnpm test tests/unit/export.test.ts`.
- [x] 1.3 Añadir el test de integración en `tests/unit/exporter.test.ts` que genere un WebM con audio muy bajo, exporte con normalización y compruebe con `mean_volume` que el MP4 sube respecto a la exportación sin normalizar; propagar `normalizeAudio` por `ExportRequest`, `Exporter.run` e `IPC.exportRun`, y verificar con `pnpm test tests/unit/exporter.test.ts`.

## 2. Pipeline de captura: ganancia y medidor (TDD)

- [x] 2.1 Ampliar `tests/ui/capture.test.tsx` para cubrir `GainNode` por fuente, el valor de ganancia aplicado, `getLevel()` calculado con `AnalyserNode` y el reinicio a 0 al detener; implementar en `src/renderer/src/lib/capture.ts` y verificar con `pnpm test tests/ui/capture.test.tsx`.
- [x] 2.2 Ampliar `tests/ui/useScreenRecorder.test.tsx` para comprobar que se pasan `systemAudioGain`/`micGain` al pipeline, que `audioLevel` se actualiza durante la grabación y vuelve a 0 al detener o cancelar; implementar el estado y el muestreo en `src/renderer/src/hooks/useScreenRecorder.ts` y verificar con `pnpm test tests/ui/useScreenRecorder.test.tsx`.

## 3. Interfaz: ganancia, normalización y medidor (TDD)

- [x] 3.1 Añadir textos en español para "Volumen del sistema", "Volumen del micrófono", "Normalizar volumen al exportar" y el medidor en `src/renderer/src/i18n/es.ts`; verificar con `pnpm typecheck`.
- [x] 3.2 Ampliar `tests/ui/components.test.tsx` y `src/renderer/src/components/SettingsPanel.tsx` con los deslizadores de ganancia por fuente, el valor en formato `×1,5` y la casilla de normalización; verificar con `pnpm test tests/ui/components.test.tsx`.
- [x] 3.3 Ampliar `tests/ui/App.test.tsx` y `src/renderer/src/App.tsx` para pasar ganancias y normalización a la captura y mostrar el medidor de nivel en la barra de grabación, con estilos en `src/renderer/src/styles.css`; verificar con `pnpm test tests/ui/App.test.tsx`.

## 4. Verificación integral

- [x] 4.1 Ejecutar `pnpm typecheck`, `pnpm lint` y `pnpm test` para comprobar que todos los tests pasan sin regresiones.
- [x] 4.2 Validar los artefactos con `openspec validate "improve-audio-levels"`.
