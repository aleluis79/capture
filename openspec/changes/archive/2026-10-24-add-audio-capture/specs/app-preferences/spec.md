# app-preferences Specification Delta

## MODIFIED Requirements

### Requirement: Valores por defecto

La app DEBE arrancar con valores por defecto sensatos cuando no existan ajustes guardados.

#### Scenario: Primer arranque

- **WHEN** el usuario abre la app por primera vez
- **THEN** la resolución de salida es 1080p, los FPS son 30, la calidad es Media y la cuenta atrás está activada con 3 s
- **AND** el audio del sistema y el micrófono están desactivados con el dispositivo de micrófono en `default`
- **AND** el atajo global propuesto es Ctrl+Alt+R
- **AND** la carpeta de destino es la carpeta de vídeos del usuario con subcarpeta `Capturas`

### Requirement: Información de plataforma

La app DEBE detectar la plataforma y el servidor gráfico para mostrar instrucciones adecuadas sobre la selección de fuentes, el soporte de audio del sistema y el cursor.

#### Scenario: Sesión Wayland

- **WHEN** la app se ejecuta en una sesión Wayland
- **THEN** indica que la fuente se elige mediante el diálogo del sistema
- **AND** no intenta mostrar una galería de ventanas que el portal no permite enumerar
- **AND** informa si la captura de audio del sistema está disponible en la plataforma actual

#### Scenario: Sesión Windows o X11

- **WHEN** la app se ejecuta en Windows o en una sesión X11
- **THEN** permite elegir la fuente desde la galería interna de la app
- **AND** habilita la opción de audio del sistema cuando el entorno la soporta
