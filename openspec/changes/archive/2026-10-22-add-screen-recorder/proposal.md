# Proposal: grabador de pantalla simple para Linux y Windows

## Why

Hoy no existe una herramienta ligera y sencilla que permita grabar la pantalla, una ventana o una región concreta en Linux (GNOME/Wayland) y Windows sin la complejidad de OBS. Este proyecto crea una aplicación de escritorio enfocada en un único flujo: elegir qué grabar, ajustar resolución y FPS, grabar sin audio y exportar un MP4 compatible con cualquier reproductor.

## What Changes

- Nueva aplicación de escritorio multiplataforma (Linux y Windows) construida con Electron, Vite, React y TypeScript.
- Selección de fuente: pantalla completa, ventana específica o región rectangular.
- Controles simples de salida: resolución (nativa, 2160p, 1440p, 1080p, 720p, personalizada), FPS (15/24/30/60/personalizado) y calidad.
- Cuenta atrás de 3 s, atajos globales y aviso de que el cursor lo incluye el compositor del sistema.
- Grabación intermedia sin audio en WebM dentro del directorio de datos de la app, con recuperación tras un cierre inesperado.
- Vista previa con recorte de inicio/fin y exportación a MP4 H.264 mediante FFmpeg embebido, con progreso y diálogo de guardado.
- Historial local de grabaciones con miniatura, metadatos, reexportación, apertura de carpeta y borrado.
- Ajustes persistentes en español y limpieza de archivos temporales.
- Empaquetado en `.deb`/AppImage para Linux y NSIS para Windows, con FFmpeg incluido.

Fuera de alcance de esta versión: audio de sistema o micrófono, pausa/reanudación durante la grabación, anotaciones, edición avanzada, subida a la nube, macOS y firma de código en Windows.

## Capabilities

### New Capabilities

- `screen-recording`: selección de fuente (pantalla, ventana, región), configuración de captura, cuenta atrás, atajos globales, estado de grabación y persistencia del WebM temporal.
- `video-export`: recorte de inicio/fin, resolución/FPS/calidad de salida, codificación MP4 H.264 con FFmpeg, progreso y guardado del archivo.
- `recording-library`: historial local de grabaciones, miniaturas, metadatos, reexportación, borrado y limpieza de temporales.
- `app-preferences`: valores por defecto, persistencia de ajustes, carpeta de destino e información de plataforma/limitaciones.

### Modified Capabilities

Ninguna: el proyecto parte sin especificaciones previas.

## Impact

- Crea un proyecto nuevo desde cero: `package.json`, configuración de `electron-vite`, `electron-builder`, TypeScript, Vitest y Playwright.
- Procesos afectados: main (portales de captura, sistema de archivos, FFmpeg, atajos), preload (IPC tipado) y renderer (UI, `getDisplayMedia`, `MediaRecorder`, canvas de recorte).
- Dependencias nuevas: Electron 45, React 19, Vite 8, `ffmpeg-static`, `electron-builder`, Vitest, Playwright.
- Requiere el portal `org.freedesktop.portal.ScreenCast` en Linux Wayland y `org.freedesktop.portal.GlobalShortcuts` para atajos globales en GNOME.
- Riesgo de distribución: `ffmpeg-static` incluye una compilación GPL con libx264 y el binario correcto debe generarse por plataforma en CI.
