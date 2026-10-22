# Captura

Grabador de pantalla simple para Linux y Windows. Graba una pantalla completa, una ventana concreta o una región rectangular y exporta un MP4 H.264 compatible con cualquier reproductor.

Sin audio en esta versión. Interfaz en español.

## Características

- **Pantalla, ventana o región**. En Linux Wayland la fuente se elige en el diálogo del sistema (portal PipeWire); en Windows y X11 hay galería de miniaturas.
- **Resolución y FPS configurables** al exportar: nativa, 2160p, 1440p, 1080p, 720p o personalizada; 15/24/30/60 FPS o valor libre.
- **Calidad** Alta, Media o Baja (CRF de libx264).
- **Cuenta atrás de 3 s** cancelable con Escape.
- **Recorte de inicio y fin** antes de exportar.
- **Historial local** con miniaturas, reexportación, apertura de carpeta, borrado y limpieza de temporales.
- **Atajos globales** configurables (`Ctrl+Alt+R` por defecto).
- **Recuperación** de grabaciones interrumpidas por un cierre inesperado.
- Procesamiento 100 % local, sin red.

## Instalación

Descarga el artefacto de la plataforma desde _Releases_ (o constrúyelo, ver abajo):

- **Linux**: `captura_0.1.0_amd64.deb` (recomendado) o `Captura-0.1.0.AppImage`.
- **Windows**: instalador NSIS x64.

> El paquete `.deb` instala `/usr/share/applications/captura.desktop`, necesario para que GNOME acepte los atajos globales y asocie la ventana con la aplicación.

## Uso

1. Elige **Pantalla**, **Ventana** o **Región**.
2. Selecciona la fuente. En Wayland pulsa grabar y elige en el diálogo de GNOME.
3. Ajusta resolución, FPS, calidad y cuenta atrás.
4. Pulsa **Grabar**. La ventana se minimiza automáticamente al grabar una pantalla completa.
5. Detén con el botón o con `Ctrl+Alt+R`.
6. Recorta si hace falta y pulsa **Exportar MP4**.

La captura se hace a la resolución nativa de la fuente. La resolución y los FPS elegidos se aplican con precisión al MP4 final, para no depender de los límites de `getDisplayMedia`.

### Región

Al elegir una región se abre un fotograma congelado de la fuente; arrastra para dibujar el rectángulo. Se necesita un mínimo de 16 × 16 píxeles. La selección se guarda y se usa al pulsar **Grabar**.

### Dónde se guardan los datos

| Dato                          | Linux                               | Windows                                         |
| ----------------------------- | ----------------------------------- | ----------------------------------------------- |
| Ajustes e historial           | `~/.config/Captura/`                | `%APPDATA%\Captura\`                            |
| WebM intermedios y miniaturas | `~/.config/Captura/recordings/`     | `%APPDATA%\Captura\recordings\`                 |
| MP4 exportados                | `~/Vídeos/Capturas/` (configurable) | `%USERPROFILE%\Videos\Capturas\` (configurable) |

El WebM original se conserva tras exportar para poder reexportar o recortar de nuevo. **Historial → Limpiar temporales** elimina los WebM ya exportados sin tocar los MP4.

## Desarrollo

Requisitos: Node.js 22 o superior y pnpm 12 o superior.

```bash
pnpm install
pnpm dev             # Electron + Vite con recarga en caliente
pnpm build           # typecheck + build de producción
pnpm test            # Vitest: dominio, stores, geometría, FFmpeg y UI
pnpm lint
```

`pnpm install` aprueba los scripts de `electron`, `ffmpeg-static` y `electron-winstaller` desde `pnpm-workspace.yaml`. El `postinstall` del proyecto descarga el binario de Electron si falta (Electron 45 lo instala de forma perezosa) y verifica el de FFmpeg.

### Pruebas de integración (Electron real)

Requieren una sesión gráfica (Wayland/X11 o Xvfb en CI):

```bash
pnpm test:e2e
```

`tests/e2e/smoke.mjs` abre la app y comprueba la ventana y el preload. `tests/e2e/pipeline.mjs` crea un `MediaStream` sintético con canvas, graba con `MediaRecorder`, escribe los fragmentos por IPC, genera la miniatura, exporta un MP4 de 320 × 240 a 24 FPS y verifica con FFmpeg que es H.264, sin audio, con la duración recortada. También valida ajustes, atajo inválido y carpeta sin permisos. Se ejecuta igual contra el artefacto empaquetado:

```bash
CAPTURA_EXECUTABLE="$PWD/dist/linux-unpacked/captura" node tests/e2e/pipeline.mjs
```

### Generar iconos

```bash
pnpm icons
```

Genera `build/icon.png` e `build/icon.ico` sin dependencias externas.

### Empaquetado

```bash
pnpm build:linux  # AppImage + .deb en dist/
pnpm build:win    # NSIS en dist/
```

En Linux, `pnpm dev` añade `--no-sandbox` solo en desarrollo cuando `chrome-sandbox` no tiene setuid root. El `.deb` lo corrige en su `postinst` (`chmod 4755`) y el AppImage incluye `--no-sandbox` en su entrada de escritorio. Si ejecutas el AppImage directamente desde una terminal, puede que necesites pasarle `--no-sandbox`.

FFmpeg se copia desde `node_modules/ffmpeg-static` a `resources/ffmpeg/`. No se compila Windows desde Linux: usa un runner Windows (la matriz de CI lo hace) porque `ffmpeg-static` descarga el binario de la plataforma de instalación.

## Arquitectura

```
renderer (React)                       main (Node/Electron)
├─ UI, ajustes, historial              ├─ Portal / selector de fuentes
├─ getDisplayMedia + MediaRecorder     ├─ Escritura incremental del WebM
├─ Recorte por canvas (región)         ├─ FFmpeg: miniatura y exportación
└─ Vista previa y timeline             └─ Persistencia, atajos, protocolo media
```

- **Captura**: `getDisplayMedia` en el renderer. En Wayland se usa `setDisplayMediaRequestHandler({ useSystemPicker: true })` y el portal de GNOME; no se enumeran ventanas porque PipeWire no lo permite. En Windows/X11 se eligen miniaturas con `desktopCapturer`.
- **Intermedio**: WebM VP9 (fallback VP8) con bitrate calculado por resolución/FPS/calidad. Los fragmentos se envían al main y se escriben en disco de forma incremental.
- **Región**: fotograma congelado en la propia ventana (funciona en Wayland) y pipeline de canvas que solo dibuja el rectángulo.
- **Exportación**: MP4 H.264 con `libx264`, `yuv420p`, `+faststart`, sin audio, escritura atómica `.part` y renombrado final. El progreso se lee de `-progress pipe:1`.
- **Seguridad**: `contextIsolation`, `sandbox`, sin `nodeIntegration`; el renderer solo accede a la API de preload. CSP estricta en producción y protocolo `captura-media` limitado a grabaciones del historial.

Más detalle en `openspec/changes/add-screen-recorder/design.md`.

## Limitaciones conocidas

- **Wayland no permite enumerar ventanas**. La selección se delega en el diálogo del sistema; la app no muestra su propia galería.
- **El cursor no se puede desactivar**. Lo incluye el compositor o el sistema de captura; el control aparece desactivado con una explicación.
- **Atajos globales en GNOME Wayland** requieren identidad de portal válida: instala el `.deb` y acepta el diálogo de consentimiento la primera vez. En AppImage o ejecutando sin empaquetar puede no registrarse; la app lo avisa y permite grabar desde la ventana.
- **Sin audio** en esta versión. El pipeline está preparado para añadirlo con `-c:a aac`.
- **Windows sin firmar**: SmartScreen puede mostrar un aviso.
- **4K a 60 FPS** puede consumir mucha CPU al recodificar; baja la resolución/FPS si es necesario.
- La compilación de `ffmpeg-static` es **GPL** e incluye libx264. Si redistribuyes la app debes cumplir esa licencia.

## Matriz de verificación

| Comprobación                                                                  | Estado |
| ----------------------------------------------------------------------------- | ------ |
| `pnpm install` + `pnpm dev` arrancan Electron en Linux                        | ✅     |
| `pnpm lint`, `typecheck`, `build`                                             | ✅     |
| 205 tests unitarios y de UI                                                   | ✅     |
| Arranque Electron en GNOME Wayland (smoke)                                    | ✅     |
| Grabación sintética → IPC → miniatura → MP4 H.264 sin audio                   | ✅     |
| Exportación con recorte, 320 × 240 y 24 FPS                                   | ✅     |
| Empaquetado `.deb` + AppImage (Linux)                                         | ✅     |
| App empaquetada encuentra FFmpeg en `resources/`                              | ✅     |
| Ajustes: carpeta sin permisos rechazada, atajo inválido rechazado             | ✅     |
| Captura real por portal GNOME (pantalla/ventana/región)                       | ✅     |
| Atajos globales con `.deb` instalado y consentimiento de GNOME                | ✅     |
| Instalador NSIS y captura en Windows 10/11 (DPI 100/125/150 %, multi-monitor) | ✅     |

## Licencia

Código bajo licencia MIT. El binario de FFmpeg distribuido con la aplicación proviene de `ffmpeg-static` y está bajo GPLv3 (incluye libx264); consulta `node_modules/ffmpeg-static/LICENSE` y `ffmpeg.LICENSE`.
