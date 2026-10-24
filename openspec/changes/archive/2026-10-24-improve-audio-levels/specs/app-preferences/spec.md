# app-preferences Specification Delta

## MODIFIED Requirements

### Requirement: Valores por defecto

La app DEBE arrancar con valores por defecto sensatos cuando no existan ajustes guardados.

#### Scenario: Primer arranque

- **WHEN** el usuario abre la app por primera vez
- **THEN** la resolución de salida es 1080p, los FPS son 30, la calidad es Media y la cuenta atrás está activada con 3 s
- **AND** el audio del sistema y el micrófono están desactivados con el dispositivo de micrófono en `default`
- **AND** la ganancia del sistema y del micrófono es 1× y la normalización al exportar está activada
- **AND** el atajo global propuesto es Ctrl+Alt+R
- **AND** la carpeta de destino es la carpeta de vídeos del usuario con subcarpeta `Capturas`

### Requirement: Persistencia y validación de ajustes

La app DEBE guardar los ajustes en disco y DEBE ignorar valores desconocidos o inválidos al cargarlos, volviendo al valor por defecto correspondiente.

#### Scenario: Ajustes persistentes

- **WHEN** el usuario cambia la resolución a 720p y reinicia la app
- **THEN** la resolución seleccionada sigue siendo 720p

#### Scenario: Archivo de ajustes corrupto

- **WHEN** el archivo de ajustes no se puede leer o contiene valores inválidos
- **THEN** la app arranca con los valores por defecto
- **AND** conserva una copia del archivo corrupto para diagnóstico

#### Scenario: Ganancia persistente y validada

- **WHEN** el usuario ajusta la ganancia del sistema a 2,5× y reinicia la app
- **THEN** la ganancia sigue siendo 2,5×
- **AND** un valor de ganancia no numérico o fuera de 0,5×–4× vuelve al valor por defecto
