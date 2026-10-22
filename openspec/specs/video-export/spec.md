# video-export Specification

## Purpose

Convierte la grabación intermedia en un archivo MP4 H.264 con la resolución, los FPS, la calidad y el recorte elegidos por el usuario, mostrando el progreso y permitiendo cancelar.

## Requirements

### Requirement: Recorte de inicio y fin

La app DEBE permitir marcar un punto de inicio y un punto de fin dentro de la grabación y DEBE exportar únicamente ese intervalo.

#### Scenario: Recorte válido

- **WHEN** el usuario sitúa el inicio en 2 s y el fin en 10 s de una grabación de 30 s
- **THEN** el MP4 resultante dura 8 s y comienza en el contenido del segundo 2

#### Scenario: Recorte inválido

- **WHEN** el inicio es mayor o igual que el fin
- **THEN** la app impide exportar y muestra un mensaje de validación

#### Scenario: Extremos fuera de rango

- **WHEN** el usuario introduce un inicio negativo o un fin posterior a la duración
- **THEN** la app ajusta los valores a los límites de la grabación

### Requirement: Resolución de salida configurable

La app DEBE ofrecer resolución nativa, 2160p, 1440p, 1080p, 720p y una resolución personalizada, y DEBE generar un archivo con exactamente la resolución elegida.

#### Scenario: Resolución predefinida

- **WHEN** el usuario elige 1080p y exporta
- **THEN** el MP4 tiene 1920 × 1080 píxeles

#### Scenario: Resolución personalizada

- **WHEN** el usuario introduce 1000 × 600 como resolución personalizada
- **THEN** el MP4 tiene dimensiones pares (1000 × 600) y mantiene la proporción con barras negras si es necesario

#### Scenario: Resolución nativa con dimensión impar

- **WHEN** la grabación mide 1365 × 767 y el usuario elige resolución nativa
- **THEN** la salida usa 1364 × 766 para cumplir el formato 4:2:0

### Requirement: FPS de salida constante

La app DEBE ofrecer 15, 24, 30, 60 y un valor personalizado de FPS, y DEBE producir vídeo con tasa de fotogramas constante.

#### Scenario: Salida a 60 FPS

- **WHEN** el usuario elige 60 FPS y exporta una grabación de 10 s
- **THEN** el MP4 declara 60 FPS y contiene 600 fotogramas

#### Scenario: FPS personalizado inválido

- **WHEN** el usuario introduce un valor de FPS menor que 1 o mayor que 120
- **THEN** la app lo rechaza y mantiene el último valor válido

### Requirement: Calidad de codificación

La app DEBE ofrecer perfiles de calidad Alta, Media y Baja que se traduzcan en valores de compresión distintos y predecibles.

#### Scenario: Perfil de calidad aplicado

- **WHEN** el usuario elige calidad Alta en lugar de Baja para la misma grabación
- **THEN** el archivo resultante tiene mayor tamaño y mejor fidelidad visual

### Requirement: Exportación a MP4 H.264 compatible

La app DEBE exportar un MP4 con códec H.264, formato de píxel 4:2:0, sin audio y con el índice al inicio para permitir la reproducción progresiva.

#### Scenario: Archivo reproducible

- **WHEN** finaliza una exportación
- **THEN** el archivo se reproduce en VLC, navegadores y reproductores del sistema
- **AND** el contenedor es MP4 con pista de vídeo H.264 y sin pista de audio

#### Scenario: Nombre de archivo por defecto

- **WHEN** el usuario abre el diálogo de guardado
- **THEN** se propone un nombre con el patrón `captura-AAAA-MM-DD_HH-mm-ss.mp4`
- **AND** la carpeta propuesta es la carpeta de destino configurada

### Requirement: Escritura atómica del archivo exportado

La app DEBE escribir la exportación en un archivo temporal y DEBE renombrarlo al finalizar correctamente, para no dejar MP4 incompletos.

#### Scenario: Exportación completada

- **WHEN** FFmpeg termina con código de salida 0
- **THEN** el archivo temporal se renombra al nombre definitivo
- **AND** no queda ningún archivo `.part` en la carpeta

#### Scenario: Exportación fallida

- **WHEN** FFmpeg termina con error o se queda sin espacio
- **THEN** la app elimina el archivo parcial, conserva la grabación original e informa del error

### Requirement: Progreso y cancelación

La app DEBE mostrar el progreso de la exportación y DEBE permitir cancelarla sin corromper la grabación original.

#### Scenario: Progreso visible

- **WHEN** una exportación está en curso
- **THEN** la app muestra un porcentaje actualizado y el tiempo restante estimado

#### Scenario: Cancelar exportación

- **WHEN** el usuario cancela una exportación en curso
- **THEN** el proceso FFmpeg se detiene, se elimina el archivo parcial y la grabación original permanece intacta

### Requirement: Errores de exportación comprensibles

La app DEBE traducir los fallos de exportación a mensajes en español con una acción sugerida.

#### Scenario: FFmpeg no disponible

- **WHEN** no se encuentra el binario de FFmpeg
- **THEN** la app muestra un error que indica que falta el componente de exportación
- **AND** sugiere reinstalar la aplicación

#### Scenario: Espacio insuficiente

- **WHEN** el sistema informa de falta de espacio durante la exportación
- **THEN** la app lo indica, limpia el archivo parcial y conserva la grabación original
