# screen-recording Specification Delta

## ADDED Requirements

### Requirement: Captura opcional de audio del sistema y micrófono

La app DEBE permitir activar o desactivar de forma independiente la captura de audio del sistema y la captura de micrófono antes de iniciar una grabación.

#### Scenario: Grabación sin fuentes de audio activas

- **WHEN** el usuario inicia una grabación con el audio del sistema y el micrófono desactivados
- **THEN** la captura se realiza únicamente con pista de vídeo y sin solicitar permisos de micrófono

#### Scenario: Grabación con audio del sistema

- **WHEN** el usuario activa "Audio del sistema" e inicia una grabación
- **THEN** la app solicita la pista de audio del escritorio junto con el vídeo e incluye esa pista en la grabación intermedia

#### Scenario: Audio del sistema no entregado por la fuente

- **WHEN** el usuario activa "Audio del sistema" pero el sistema operativo o el portal no entregan pista de audio
- **THEN** la grabación continúa con el vídeo (y el micrófono si estaba activo) sin abortar la sesión

#### Scenario: Grabación con micrófono

- **WHEN** el usuario activa "Micrófono" e inicia una grabación
- **THEN** la app solicita acceso al micrófono seleccionado e incluye su audio en la grabación intermedia

#### Scenario: Permiso de micrófono denegado

- **WHEN** el usuario activa "Micrófono" pero el sistema rechaza el acceso al dispositivo de entrada
- **THEN** no se inicia la grabación y la app muestra un mensaje en español indicando el problema con el micrófono

### Requirement: Selección de dispositivo de micrófono

Cuando la captura de micrófono está activada, la app DEBE permitir elegir entre el micrófono predeterminado del sistema y cualquiera de los dispositivos de entrada de audio disponibles.

#### Scenario: Listar micrófonos disponibles

- **WHEN** el usuario activa la opción "Micrófono" en los ajustes de captura
- **THEN** la interfaz muestra un selector con "Predeterminado del sistema" y los micrófonos detectados en el equipo

#### Scenario: Dispositivo seleccionado desconectado

- **WHEN** el micrófono previamente guardado ya no está conectado al iniciar una grabación
- **THEN** la app recurre al micrófono predeterminado del sistema

### Requirement: Mezcla y preservación de audio en la captura

La app DEBE combinar las fuentes de audio activas en una única pista de audio y DEBE conservarla en todos los modos de captura, incluido el modo región.

#### Scenario: Mezcla simultánea de sistema y micrófono

- **WHEN** el usuario inicia una grabación con "Audio del sistema" y "Micrófono" activados a la vez
- **THEN** ambas señales se mezclan en una única pista de audio dentro del archivo intermedio

#### Scenario: Audio conservado en modo región

- **WHEN** el usuario graba una región rectangular con alguna fuente de audio activada
- **THEN** el archivo intermedio contiene el vídeo recortado junto con la pista de audio capturada

## REMOVED Requirements

### Requirement: Sin captura de audio

**Reason**: La aplicación ahora soporta captura opcional de audio del sistema y de micrófono.
**Migration**: Usar los controles de "Audio del sistema" y "Micrófono" en el panel de captura; dejarlos desactivados mantiene el comportamiento sin sonido.
