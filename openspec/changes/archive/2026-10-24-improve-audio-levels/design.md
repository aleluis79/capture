# Design: nivel de audio audible y medidor

## Context

La captura ya incorpora audio del sistema (loopback) y micrófono, y los mezcla en una sola pista cuando ambos están activos. Ver `proposal.md` para la motivación y `specs/` para el contrato. El síntoma reportado es que el audio del sistema queda muy bajo: el loopback hereda el volumen del sumidero y el pipeline actual no aplica ganancia ni normalización, además de no ofrecer ninguna referencia visual del nivel captado.

Restricciones:
- `MediaRecorder` recibe una única pista de audio; la ganancia y la medición deben ocurrir antes del destino.
- En modo región el vídeo viene de `canvas.captureStream()` y el audio se adjunta como pista adicional, por lo que el medidor debe funcionar igual en los tres modos.
- La app funciona sin red y sin dependencias nuevas.

## Goals / Non-Goals

**Goals:**
- Que el audio del sistema y del micrófono se puedan amplificar de forma independiente (0,5×–4×).
- Que el MP4 exportado tenga un nivel audible y consistente mediante normalización opcional.
- Que el usuario vea durante la grabación si hay señal y a qué nivel.
- Mantener la lógica pura testeada y no romper grabaciones sin audio ni grabaciones antiguas.

**Non-Goals:**
- Compresión multibanda, limitador profesional o reducción de ruido.
- Medición LUFS en vivo (el medidor es RMS relativo, suficiente como referencia).
- Ganancia por aplicación o cancelación de eco avanzada.

## Decisions

### 1. Ganancia en el renderer con `GainNode` por fuente

`createAudioPipeline` acepta `systemAudioGain` y `micGain`. Por cada fuente presente crea `MediaStreamAudioSourceNode -> GainNode` y conecta la salida al `MediaStreamAudioDestinationNode`. La pista del destino es la que consume `MediaRecorder`.

- **Por qué:** amplificar antes de codificar evita recodificar dos veces y mantiene el archivo intermedio ya audible para la vista previa.
- **Cambio respecto al diseño anterior:** antes, con una sola fuente se usaba el track directo. Ahora se crea `AudioContext` siempre que haya audio, porque hace falta para aplicar ganancia y para medir. El coste es despreciable frente a la codificación de vídeo.
- **Alternativa descartada:** subir el volumen solo en FFmpeg al exportar. No permite equilibrar sistema y micrófono, no mejora la vista previa y no cubre al usuario que solo quiere escuchar el WebM.

### 2. Medidor con `AnalyserNode` y estado React separado

Se conecta un `AnalyserNode` en paralelo a la salida de cada `GainNode` (o a la suma). `getLevel()` calcula el RMS de `getFloatTimeDomainData` y lo normaliza a 0–1. `useScreenRecorder` muestrea cada 100 ms con `setInterval`, publica `audioLevel` y lo reinicia a 0 al parar, cancelar o limpiar.

- **Por qué un estado separado:** el nivel cambia 10 veces por segundo y no forma parte de la máquina de estados de grabación; mantenerlo fuera del reducer evita re-renders y tests innecesarios del reducer.
- **Por qué RMS:** es barato y responde bien a voz y música; un pico instantáneo sería más nervioso.
- **Alternativa descartada:** `requestAnimationFrame` con barras animadas. Más coste y sin beneficio perceptible para una referencia de nivel.

### 3. Normalización con `loudnorm` en la exportación

`buildExportArgs` recibe `normalizeAudio`. Si hay audio y está activado, añade `-af loudnorm=I=-16:TP=-1.5:LRA=11`; si está desactivado o no hay audio, no añade filtro de audio. `IPC.exportRun` lee `settingsStore.get().normalizeAudio` y lo propaga a `ExportRequest`.

- **Por qué `loudnorm`:** es el estándar EBU R128, deja el audio a −16 LUFS con pico limitado a −1,5 dBTP, suficiente para que el sonido del sistema se oiga sin saturar.
- **Por qué de un solo paso:** las grabaciones son archivos completos, no streams; no hace falta el modo de dos pasadas.
- **Alternativa descartada:** `dynaudnorm`, que sube también el ruido de fondo de forma más agresiva y produce un nivel menos predecible entre grabaciones.
- **Alternativa descartada:** normalizar en el renderer antes de grabar. No es fiable para señales desconocidas y no mejora las grabaciones ya existentes al reexportar.

### 4. Ajustes y validación

`Settings` incorpora `systemAudioGain` y `micGain` (número entre 0,5 y 4, por defecto 1) y `normalizeAudio` (booleano, por defecto `true`). `sanitizeSettings` valida el rango y el tipo; los ajustes antiguos reciben los valores por defecto. La UI muestra dos deslizadores (solo cuando la fuente correspondiente está activa), una casilla de normalización y el valor actual en formato `×1,5`.

## Risks / Trade-offs

- **Mezclar dos fuentes con ganancia alta puede saturar (clipping)** → El rango se limita a 4× y la normalización final usa `TP=-1.5`; la UI muestra el medidor para que el usuario detecte saturación. No se añade compresor para no alterar la señal de forma invisible.
- **`loudnorm` puede realzar ruido de fondo en grabaciones muy silenciosas** → Es un ajuste desactivable; el medidor y la ganancia permiten subir la señal de origen en lugar de depender solo del filtro.
- **El medidor añade un `AnalyserNode` y un intervalo** → Un nodo y 10 muestras por segundo son despreciables; el intervalo se limpia en todas las rutas de finalización y desmontaje.
- **Grabaciones antiguas sin los nuevos ajustes** → `sanitizeSettings` aplica los valores por defecto y `normalizeAudio` afecta solo a nuevas exportaciones.

## Migration Plan

- Los `settings.json` existentes se sanean al arrancar: ganancias a 1× y normalización activada.
- No hay migración de datos de historial: `normalizeAudio` se evalúa al exportar, no se persiste por entrada.
