# screen-recording Specification Delta

## ADDED Requirements

### Requirement: Ganancia de entrada configurable por fuente

La app DEBE permitir ajustar el volumen de entrada del audio del sistema y del micrófono en un rango de 0,5× a 4× antes de grabar.

#### Scenario: Ajustar el volumen del audio del sistema

- **WHEN** el usuario activa "Audio del sistema" y modifica su volumen a 2×
- **THEN** la app guarda el valor y lo aplica en la siguiente grabación

#### Scenario: Ajustar el volumen del micrófono

- **WHEN** el usuario activa "Micrófono" y modifica su volumen a 1,5×
- **THEN** la app guarda el valor y lo aplica en la siguiente grabación

#### Scenario: Valor de ganancia fuera de rango

- **WHEN** la ganancia configurada queda fuera del rango 0,5×–4×
- **THEN** la app la ajusta al límite más cercano y conserva el resto de ajustes

### Requirement: Ganancia aplicada a las fuentes de audio

La app DEBE aplicar la ganancia configurada a cada fuente de audio activa dentro del archivo intermedio, tanto en captura directa como en modo región.

#### Scenario: Audio del sistema amplificado

- **WHEN** el usuario activa "Audio del sistema" con una ganancia de 2× e inicia una grabación
- **THEN** la pista de audio incluida en el archivo intermedio corresponde a la señal del sistema amplificada al doble

#### Scenario: Micrófono amplificado

- **WHEN** el usuario activa "Micrófono" con una ganancia de 1,5× e inicia una grabación
- **THEN** la pista de audio incluida en el archivo intermedio corresponde a la señal del micrófono amplificada 1,5×

#### Scenario: Audio conservado en modo región

- **WHEN** el usuario graba una región rectangular con audio y ganancia configurada
- **THEN** el archivo intermedio contiene el vídeo recortado y la pista de audio con la ganancia aplicada

### Requirement: Medidor de nivel de audio en vivo

Durante la grabación, la app DEBE mostrar un medidor que refleje el nivel del audio que se está capturando, incluido el modo región.

#### Scenario: Medidor con señal

- **WHEN** el usuario graba con alguna fuente de audio activa y hay señal
- **THEN** la barra de grabación muestra un nivel proporcional a la señal capturada

#### Scenario: Medidor sin audio

- **WHEN** el usuario graba sin audio del sistema ni micrófono
- **THEN** el medidor no se muestra o permanece en cero

#### Scenario: Detener la grabación

- **WHEN** la grabación termina o se cancela
- **THEN** el medidor se detiene y vuelve a cero
