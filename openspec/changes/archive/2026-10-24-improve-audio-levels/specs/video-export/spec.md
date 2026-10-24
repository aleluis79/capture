# video-export Specification Delta

## ADDED Requirements

### Requirement: Normalización de sonoridad del audio exportado

La app DEBE ofrecer una normalización de sonoridad activada por defecto que ajuste el nivel del audio del MP4 a un nivel audible y consistente, y DEBE permitir desactivarla.

#### Scenario: Exportación con normalización activa

- **WHEN** el usuario exporta una grabación con audio y la normalización está activada
- **THEN** FFmpeg aplica `loudnorm` y el nivel medio del MP4 resultante es mayor que el de la misma exportación sin normalizar

#### Scenario: Exportación con normalización desactivada

- **WHEN** el usuario desactiva "Normalizar volumen al exportar"
- **THEN** el MP4 conserva el nivel de audio original sin aplicar `loudnorm`

#### Scenario: Grabación sin audio

- **WHEN** la grabación no contiene pista de audio
- **THEN** la exportación no aplica filtros de audio y el MP4 sigue sin pista de sonido
