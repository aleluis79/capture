# Tasks

## 1. Setup del proyecto

- [x] 1.1 Crear `package.json`, `tsconfig.*.json`, `electron.vite.config.ts`, `.gitignore` y estructura `src/{main,preload,renderer,shared}`; verificar con `npm run typecheck` sin errores.
- [x] 1.2 Instalar Electron 45, React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, `ffmpeg-static`, `electron-builder`, ESLint y Prettier; verificar que `npm install` termina y `npm test` ejecuta la suite vacía.
- [x] 1.3 Configurar scripts `dev`, `build`, `test`, `test:watch`, `typecheck`, `lint`, `build:linux`, `build:win` y Vitest con entorno `node` por defecto y `jsdom` para UI; verificar `npm run test` y `npm run build` en local.
- [x] 1.4 Registrar en `openspec/config.yaml` el contexto del proyecto (Linux Wayland + Windows, español, SDD/TDD) sin duplicar el contenido de los artefactos; verificar con `openspec validate add-screen-recorder`.

## 2. Dominio: regiones y dimensiones de salida

- [x] 2.1 Escribir tests de `normalizeRegion`, `toEvenDimensions` y `resolveOutputDimensions` (nativa, presets, personalizada, límites y región mínima); verificar que fallan antes de implementar.
- [x] 2.2 Implementar `src/shared/region.ts` con esas funciones; verificar que la suite de 2.1 pasa.
- [x] 2.3 Escribir tests de `computeCropRect` para regiones que exceden la fuente, coordenadas negativas y dimensiones impares; implementar hasta que pasen.

## 3. Dominio: calidad, argumentos de FFmpeg y progreso

- [x] 3.1 Escribir tests de `bitrateFor` y `crfForQuality` (monotonía, límites y perfiles Alta/Media/Baja); implementar `src/shared/quality.ts` hasta que pasen.
- [x] 3.2 Escribir tests de `buildExportArgs` (recorte opcional, filtro de escala/pad/fps, `yuv420p`, `-an`, `faststart`, salida `.part`); implementar `src/shared/export.ts` hasta que pasen.
- [x] 3.3 Escribir tests de `parseProgress`, `formatDuration`, `formatBytes` y `buildOutputFilename`; implementar hasta que pasen.
- [x] 3.4 Escribir tests de `validateTrim` (invertido, negativo, fuera de rango) e implementarlo; verificar casos límite en la suite.

## 4. Dominio: ajustes e historial

- [x] 4.1 Escribir tests de `mergeSettings` y `sanitizeSettings` con valores inválidos, claves desconocidas y archivo corrupto; implementar `src/shared/settings.ts` hasta que pasen.
- [x] 4.2 Escribir tests de `addHistoryEntry`, `removeHistoryEntry`, `sortEntries` y `totalSize`; implementar `src/shared/history.ts` hasta que pasen.
- [x] 4.3 Definir los tipos compartidos (`RecordingMode`, `Settings`, `HistoryEntry`, `ExportOptions`) y verificar que `npm run typecheck` los consume sin `any`.

## 5. Estado de grabación en el renderer

- [x] 5.1 Escribir tests de la máquina de estados `idle → countdown → recording → review → exporting → idle`, incluyendo cancelaciones y errores; verificar que fallan.
- [x] 5.2 Implementar `src/renderer/src/lib/recordingReducer.ts` hasta que los tests de 5.1 pasen, sin dependencias de Electron.
- [x] 5.3 Escribir tests de los selectores derivados (¿puede grabar?, ¿puede exportar?, etiqueta del botón) e implementarlos hasta que pasen.

## 6. Proceso principal: ventana, plataforma y fuentes

- [x] 6.1 Implementar `src/main/index.ts` con ventana segura (contextIsolation, sin nodeIntegration, sandbox), instancia única y protocolo `captura-media`; verificar arranque con `npm run dev`.
- [x] 6.2 Implementar `src/main/platform.ts` con detección Wayland/X11/Windows, `ozone-platform-hint`, `desktopName` y flags de PipeWire; verificar con tests unitarios de la detección y con la app en la sesión actual.
- [x] 6.3 Implementar `setDisplayMediaRequestHandler` con `useSystemPicker` y fuente pendiente, más `sources:list` (vacío en Wayland); verificar que cancelar el portal no deja estado pendiente.
- [x] 6.4 Implementar preload tipado y `src/shared/channels.ts`; verificar que el renderer solo ve la API expuesta y que `contextIsolation` está activo.

## 7. Proceso principal: sesiones y persistencia

- [x] 7.1 Escribir tests de `SessionStore` con directorios temporales (crear sesión, escribir fragmentos, finalizar, abortar, limpiar); implementar hasta que pasen.
- [x] 7.2 Implementar el control de flujo de `recorder:chunk` (acuse por fragmento, sin acumular en memoria) y verificar con una grabación simulada de 200 MB.
- [x] 7.3 Implementar extracción de miniatura con FFmpeg y tolerancia a fallo; verificar que una entrada se crea aun sin miniatura.
- [x] 7.4 Implementar `history.json` atómico (escritura temporal + rename), recuperación de huérfanos y `powerSaveBlocker`; verificar con tests de persistencia y reinicio simulado.
- [x] 7.5 Escribir e implementar tests de `settings.json` (lectura, escritura, corrupción con copia de seguridad y carpeta de destino no escribible).

## 8. Proceso principal: exportación

- [x] 8.1 Escribir tests de integración de exportación usando el FFmpeg de `ffmpeg-static` y un WebM de prueba generado por el propio FFmpeg; verificar dimensiones, FPS, duración y ausencia de audio con `ffprobe` (incluido en el fixture o leído con `-i`).
- [x] 8.2 Implementar el spawn de FFmpeg, progreso por `-progress pipe:1`, escritura `.part` y renombrado atómico; verificar con 8.1.
- [x] 8.3 Implementar cancelación multiplataforma (SIGTERM en Linux, `taskkill` en Windows) y limpieza del parcial; verificar con un test que cancela a mitad y comprueba que el original sigue intacto.
- [x] 8.4 Implementar el diálogo de guardado con nombre y carpeta por defecto, y los errores en español (FFmpeg ausente, espacio insuficiente); verificar manualmente cada mensaje.

## 9. Renderer: interfaz principal

- [x] 9.1 Implementar layout, tema oscuro y pestañas "Grabar"/"Historial" con textos en `src/renderer/src/i18n/es.ts`; verificar con un test de render y revisión visual.
- [x] 9.2 Implementar selección de modo y fuente (galería en Windows/X11, aviso de sistema en Wayland); verificar con tests de UI usando la API simulada.
- [x] 9.3 Implementar los controles de resolución, FPS, calidad, cuenta atrás y el aviso desactivado del cursor; verificar persistencia al reiniciar y validación de valores personalizados.
- [x] 9.4 Implementar la cuenta atrás cancelable con Escape y la ocultación/restauración de la ventana; verificar manualmente en GNOME Wayland y con tests del reducer.

## 10. Renderer: captura y región

- [x] 10.1 Implementar la adquisición de `getDisplayMedia`, selección de mimeType y `MediaRecorder` con bitrate; verificar una grabación manual de 30 s con memoria estable.
- [x] 10.2 Implementar el envío secuencial de fragmentos con acuse y el flush al detener; verificar que no se pierden fragmentos al parar ni al cerrar la fuente.
- [x] 10.3 Implementar selector de región con fotograma congelado, arrastre, límites y confirmación; verificar manualmente en Wayland y con tests de las funciones de geometría.
- [x] 10.4 Implementar el pipeline de canvas para región (recorte y escala en vivo) y verificar que el MP4 exportado contiene solo la región.
- [x] 10.5 Manejar `track.onended` y errores de permiso con mensajes en español; verificar cerrando la ventana grabada y cancelando el portal.

## 11. Renderer: revisión, recorte, historial y exportación

- [x] 11.1 Implementar la vista de revisión con reproductor y timeline de dos manejadores; verificar con tests de `validateTrim` y prueba manual de reproducción.
- [x] 11.2 Implementar el modal de exportación (resolución, FPS, calidad), progreso, cancelación y estados de error; verificar con tests de UI y una exportación real.
- [x] 11.3 Implementar la pestaña de historial con miniaturas, metadatos, reexportar, abrir carpeta, revelar archivo, eliminar con confirmación y limpiar temporales; verificar con tests de UI y una grabación real.
- [x] 11.4 Implementar el aviso de recuperación de grabaciones huérfanas al iniciar; verificar matando la app durante una grabación y relanzándola.

## 12. Atajos globales y preferencias

- [x] 12.1 Implementar registro, cambio y desregistro del atajo global, con aviso si falla; verificar en GNOME Wayland (con `.deb` instalado) y en Windows.
- [x] 12.2 Implementar el cambio de carpeta de destino y la validación de escritura; verificar con una carpeta de solo lectura y una ruta inexistente.
- [x] 12.3 Verificar que todos los textos visibles están en español y centralizados; ejecutar una revisión de cadenas y el test de i18n.

## 13. Empaquetado y documentación

- [x] 13.1 Configurar `electron-builder` con appId `com.alejandro.captura`, `extraResources` de FFmpeg, `.desktop`, iconos y targets deb/AppImage/NSIS; verificar `npm run build:linux`.
- [x] 13.2 Añadir workflow de CI con matriz Ubuntu/Windows que ejecute lint, typecheck, tests y empaquete artefactos; verificar que el workflow pasa en ambas plataformas.
- [x] 13.3 Escribir `README.md` con instalación, uso, rutas de datos, limitaciones de Wayland/cursor/atajos, licencia GPL de FFmpeg y matriz de pruebas manuales; verificar que los comandos documentados funcionan.
- [x] 13.4 Verificar el `.deb` en GNOME Wayland: captura de pantalla, ventana, región, atajos, exportación e historial; anotar resultados en el README.

## 14. Verificación integral

- [x] 14.1 Ejecutar `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` sin errores.
- [x] 14.2 Ejecutar el test de humo de Playwright Electron y comprobar que la ventana principal carga con la API de preload.
- [x] 14.3 Probar el artefacto de Windows (máquina o VM) con DPI 100/125/150 %, multi-monitor y grabación de ventana; documentar resultados.
- [x] 14.4 Confirmar que no hay pistas de audio ni peticiones de red en una grabación y exportación completas.

## Workflow follow-up

- Revisar los artefactos y archivar el cambio con `openspec archive add-screen-recorder` cuando la implementación esté verificada.
- Sincronizar las especificaciones principales y comprobar el resultado archivado.
