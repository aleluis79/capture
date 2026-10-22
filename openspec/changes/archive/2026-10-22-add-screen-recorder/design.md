# Design

## Context

Proyecto nuevo, sin código previo. El equipo de desarrollo trabaja en Ubuntu 26.04 con GNOME 50 sobre Wayland, y la app también debe funcionar en Windows 10/11. La sesión Wayland condiciona la captura: Chromium solo accede al escritorio a través del portal `org.freedesktop.portal.ScreenCast` y no permite enumerar ventanas por su cuenta. Ver `proposal.md` para el motivo y `specs/` para el comportamiento exigido.

Restricciones relevantes:

- Electron 45 es la versión estable actual; incluye captura PipeWire y atajos globales vía portal en Linux.
- FFmpeg no está instalado en el sistema del desarrollador: debe empaquetarse con la app.
- El usuario confirmó: Electron + Vite + React/TS, MP4 H.264, español, cuenta atrás, atajos globales, cursor, historial y recorte previo a exportar.

## Goals / Non-Goals

**Goals:**

- Un único flujo comprensible: elegir fuente → ajustar salida → grabar → recortar → exportar.
- Que la resolución y los FPS del MP4 sean siempre exactamente los elegidos.
- Que la app sea robusta ante cancelaciones del portal, cierres de ventana y fallos de FFmpeg.
- Que la lógica de decisión (recorte, tamaños, argumentos de FFmpeg, ajustes) sea testeable sin Electron ni GUI.

**Non-Goals:**

- Audio, pausa/reanudación, edición multipista, anotaciones o streaming.
- Captura nativa fuera de Chromium (no se escribe un consumidor PipeWire propio).
- Firma de código, autoactualización y telemetría.
- Soporte de macOS en esta iteración.

## Decisions

### 1. Captura en el renderer, exportación en el main

El renderer obtiene el `MediaStream` con `getDisplayMedia` y lo codifica con `MediaRecorder`; el main recibe los fragmentos, los escribe en disco y lanza FFmpeg.

- **Por qué:** `getDisplayMedia` solo existe en el renderer y `ffmpeg` solo se puede ejecutar desde el main. Mantener los datos de vídeo en el renderer evita mover frames completos por IPC; solo se envían fragmentos ya comprimidos (~1–5 MB/s).
- **Alternativa descartada:** capturar con un addon nativo (ffmpeg/x11grab/WGC). Añade compilación nativa y no resuelve Wayland sin implementar PipeWire.

### 2. WebM intermedio y transcodificación obligatoria a MP4

Se graba `video/webm;codecs=vp9` (fallback VP8) y se exporta siempre con libx264.

- **Por qué:** `MediaRecorder` con MP4/H.264 existe en Chromium pero ha tenido problemas de archivos truncados y metadatos de duración. WebM es el camino estable. Como ya necesitamos recortar y escalar, la transcodificación no añade un paso extra.
- **Alternativa descartada:** grabar MP4 directo y remuxar. Menos CPU, pero frágil y no cubre el escalado ni el recorte.

### 3. Resolución nativa durante la grabación; resolución y FPS exactos al exportar

La captura se hace a la resolución nativa de la fuente. Se aplica el FPS como constraint de la pista, pero el tamaño y el FPS definitivos se imponen en FFmpeg.

- **Por qué:** Chromium ignora con frecuencia los constraints de ancho/alto en captura de escritorio; si se confía en ellos, el MP4 puede no cumplir lo elegido. Además, escalar en vivo cuesta CPU y calidad. En modo región sí se usa canvas porque el recorte es obligatorio.
- **Alternativa descartada:** pipeline de canvas para todos los modos. Duplica el coste de CPU y añade latencia sin beneficio visible.

### 4. Selección de región con fotograma congelado dentro de la app

Al elegir "Región" se solicita una captura de pantalla, se congela un frame y el usuario dibuja el rectángulo sobre la ventana de la app. La región se guarda en píxeles nativos del frame.

- **Por qué:** Wayland no permite posicionar una ventana transparente a pantalla completa sobre el escritorio, y Windows tiene múltiples monitores y escalados. Un selector interno funciona igual en ambos.
- **Alternativa descartada:** overlay a pantalla completa. Se rompe en Wayland y complica el manejo de DPI y multi-monitor.
- **Detalle:** se reutiliza el mismo `MediaStream` para el selector y la grabación, de forma que el portal solo pide permiso una vez. El stream se mantiene vivo con la pista deshabilitada mientras el usuario elige.

### 5. FFmpeg incluido con `ffmpeg-static`

El binario se resuelve en desarrollo desde `ffmpeg-static` (dependencia de desarrollo, externalizada del bundle) y en producción desde `process.resourcesPath/ffmpeg/ffmpeg(.exe)`. `electron-builder` lo copia con `extraResources`.

- **Por qué:** no depender de una instalación del sistema y funcionar sin conexión.
- **Alternativa descartada:** exigir FFmpeg en el PATH. Mala experiencia en Windows y en Linux.
- **Nota de licencia:** la compilación de `ffmpeg-static` es GPL e incluye libx264; la distribución de la app debe asumir esa licencia.

### 6. Ajustes e historial en JSON propio

`settings.json` e `history.json` viven en `app.getPath('userData')`. Cada grabación ocupa un directorio `recordings/<id>/` con `source.webm` y `thumb.jpg`.

- **Por qué:** evitar dependencias ESM en el main y mantener el formato legible/reparable. Los archivos de vídeo nunca se guardan en JSON.
- **Alternativa descartada:** `electron-store` (fricción ESM) o SQLite (sobredimensionado).
- **Forma de los datos:**
  ```ts
  type RecordingMode = 'screen' | 'window' | 'region'
  type HistoryEntry = {
    id: string; createdAt: string; durationMs: number; sizeBytes: number
    width: number; height: number; fps: number; mode: RecordingMode
    sourcePath: string; thumbPath: string | null
    exports: { path: string; createdAt: string; width: number; height: number; fps: number }[]
    status: 'complete' | 'recovered'
  }
  ```

### 7. IPC tipado y mínimo

`preload` expone un objeto congelado con métodos concretos; el renderer no tiene `ipcRenderer` directo, ni Node, ni acceso al filesystem. Canales:

| Canal | Dirección | Uso |
|---|---|---|
| `sources:list` | invoke | miniaturas (solo Windows/X11) |
| `sources:set-pending` | invoke | fuente elegida para el handler |
| `platform:info` | invoke | Wayland/X11, cursor, versión |
| `settings:get` / `settings:set` | invoke | ajustes |
| `recorder:start` | invoke | crea sesión y archivo |
| `recorder:chunk` | invoke | escribe un fragmento (con acuse de recibo para control de flujo) |
| `recorder:finish` / `recorder:abort` | invoke | cierra o descarta |
| `history:list` / `history:remove` / `history:reveal` / `history:cleanup` | invoke | historial |
| `export:pick-output` | invoke | diálogo de guardado |
| `export:run` / `export:cancel` | invoke | FFmpeg |
| `export:progress` | send (main → renderer) | porcentaje |
| `shortcut:toggle` | send (main → renderer) | atajo global |
| `media:url` | función | URL `captura-media://<id>` para el reproductor |

El esquema `captura-media` se registra como privilegiado y sirve únicamente archivos dentro de `recordings/`, validando el id contra el historial.

### 8. Flujo de grabación

1. El usuario elige modo y fuente. En Linux Wayland se delega en `setDisplayMediaRequestHandler(..., { useSystemPicker: true })`; en Windows/X11 se usa la galería y `sources:set-pending`.
2. Cuenta atrás de 3 s (cancelable con Escape).
3. Se minimiza la ventana si el modo es pantalla completa.
4. `MediaRecorder` emite fragmentos; se encolan y se envían de uno en uno con `await window.api.recorderChunk(...)`.
5. Al detener: flush de la cola, `recorder:finish` con duración y metadatos → el main extrae miniatura con FFmpeg, escribe la entrada y devuelve el id.
6. Se restaura la ventana y se abre la vista de revisión/exportación.

El `powerSaveBlocker` se activa en el main al empezar y se desactiva al terminar. Si la pista termina sola (`track.onended`), el renderer ejecuta el mismo camino de finalización y notifica al usuario.

### 9. Exportación

Argumentos construidos por una función pura y testeada:

```
-nostdin -hide_banner -loglevel error -progress pipe:1 -nostats
-i INPUT [-ss START] [-t DURATION]
-vf scale=W:H:force_original_aspect_ratio=decrease:flags=lanczos,
    pad=W:H:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,
    fps=FPS,format=yuv420p
-c:v libx264 -preset veryfast -crf CRF
-movflags +faststart -an -y OUTPUT.part.mp4
```

- La salida se escribe como `.part.mp4` y se renombra solo si el proceso sale con código 0.
- El progreso se calcula con `out_time_us` dividido por la duración del intervalo exportado.
- Cancelar envía `SIGTERM` (Windows: `taskkill /pid`) y elimina el parcial.
- `-ss` se aplica a la salida (después de `-i`) porque los WebM de `MediaRecorder` no incluyen índice de búsqueda; así el corte es fiable aunque decodifique desde el principio. El fin se expresa con `-t` en duración.

### 10. Wayland y atajos globales

- Se fuerza `ozone-platform-hint=auto` y se habilita `WebRTCPipeWireCapturer` cuando la sesión es Wayland, para que la captura use PipeWire y no XWayland.
- En Wayland no se intenta enumerar fuentes: `desktopCapturer.getSources` devuelve una sola fuente y el selector real es el del sistema. La UI lo explica.
- `app.setDesktopName('captura.desktop')` y `desktopName` en `package.json`, con `syncDesktopName` de electron-builder; el paquete `.deb` instala `/usr/share/applications/captura.desktop`. GNOME 50 exige una identidad de portal válida y muestra un diálogo de consentimiento la primera vez. Si el registro falla (por ejemplo en AppImage), se avisa y se ofrece usar el botón de la interfaz.
- En Windows, `globalShortcut` funciona sin requisitos extra; AppImage puede no tener identidad resoluble, lo que se documenta como limitación.

### 11. TDD por capas

Se implementa con tests primero en los módulos puros y luego en la lógica de estado/UI:

1. **Dominio (Vitest):** regiones y dimensiones, bitrate/CRF, argumentos de FFmpeg, ajustes, historial, progreso y formato.
2. **Estado (Vitest):** máquina de estados de grabación (`idle → countdown → recording → review → exporting`) y validación del recorte.
3. **UI (Vitest + Testing Library):** render de estados clave con una API simulada; no se prueba la captura real.
4. **Humo (Playwright Electron):** arranque de la app empaquetada en modo desarrollo y comprobación de la ventana principal, sin portal.

La captura real, el portal y FFmpeg se validan manualmente con una matriz documentada (Wayland GNOME, X11, Windows 10/11 con DPI 100/125/150 %, multi-monitor).

## Risks / Trade-offs

- **Wayland no permite enumerar ventanas** → Se delega en el selector del sistema y se muestra un mensaje claro; no se promete una galería que no existe.
- **`MediaRecorder` produce VFR y el FPS puede no ser exacto en la captura** → FFmpeg normaliza con `fps=FPS` y genera CFR en el MP4.
- **Coste de CPU al recodificar 4K/60** → `preset veryfast`, CRF moderado y perfiles de calidad; la grabación intermedia no escala. Si el equipo no da abasto, se documenta bajar resolución/FPS.
- **Identidad de portal y atajos en AppImage** → `.deb` como paquete Linux principal; AppImage y ejecución sin empaquetar muestran un aviso si el registro falla.
- **El cursor no se puede ocultar desde la API web** → Se informa de que el compositor lo incluye y el control queda desactivado; no se simula un cursor falso para evitar duplicados.
- **`ffmpeg-static` descarga el binario de la plataforma de instalación** → La compilación para Windows debe hacerse en un runner Windows (matriz de CI); no se compila Windows desde Linux.
- **Espacio en disco por conservar los WebM** → Se muestra el espacio total, se permite reexportar y existe "Limpiar temporales".
- **Cierre inesperado con WebM abierto** → Al arrancar se detectan `source.webm` sin entrada y se ofrece recuperarlos; no se borran automáticamente.

## Migration Plan

No hay datos previos. La app se instala limpia; los ajustes y el historial se crean en el primer arranque. Para desinstalar, el usuario puede borrar el directorio de datos de la app; se documenta su ruta en el README.

## Open Questions

Ninguna que afecte al alcance acordado. La selección de calidad por CRF y los presets concretos pueden ajustarse durante las pruebas sin cambiar las especificaciones.
