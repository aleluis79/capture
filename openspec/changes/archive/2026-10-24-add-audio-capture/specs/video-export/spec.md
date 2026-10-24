# video-export Specification Delta

## MODIFIED Requirements

### Requirement: Exportación a MP4 H.264 compatible

La app DEBE exportar un MP4 con códec de vídeo H.264, formato de píxel 4:2:0, audio AAC cuando la grabación incluya sonido y el índice al inicio para permitir la reproducción progresiva.

#### Scenario: Archivo reproducible

- **WHEN** finaliza una exportación
- **THEN** el archivo se reproduce en VLC, navegadores y reproductores del sistema
- **AND** el contenedor es MP4 con pista de vídeo H.264 y, cuando la grabación no incluye sonido, sin pista de audio

#### Scenario: Archivo reproducible con audio

- **WHEN** finaliza la exportación de una grabación con pista de audio
- **THEN** el contenedor MP4 incluye la pista de vídeo H.264 y la pista de audio AAC sincronizada con el recorte

#### Scenario: Nombre de archivo por defecto

- **WHEN** el usuario abre el diálogo de guardado
- **THEN** se propone un nombre con el patrón `captura-AAAA-MM-DD_HH-mm-ss.mp4`
- **AND** la carpeta propuesta es la carpeta de destino configurada
