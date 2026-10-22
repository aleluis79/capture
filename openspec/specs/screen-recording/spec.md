# screen-recording Specification

## Purpose

Permite elegir una pantalla, una ventana o una región rectangular y grabar su contenido en un archivo intermedio, controlando el inicio, el final y la duración desde una interfaz simple.

## Requirements

### Requirement: Selección del tipo de fuente

La app DEBE permitir elegir entre pantalla completa, ventana específica y región rectangular antes de iniciar una grabación.

#### Scenario: Galería de fuentes en Windows

- **WHEN** el usuario elige "Pantalla" o "Ventana" en Windows
- **THEN** la app muestra una galería con miniaturas de las pantallas o ventanas disponibles
- **AND** el usuario puede seleccionar una fuente concreta

#### Scenario: Selector del sistema en Linux Wayland

- **WHEN** el usuario elige "Pantalla" o "Ventana" en una sesión Linux Wayland
- **THEN** la app indica que la fuente se elige en el diálogo del sistema
- **AND** al iniciar la grabación se abre el selector de pantalla compartida del escritorio
- **AND** la grabación usa la fuente elegida en ese diálogo

#### Scenario: Cancelación del selector

- **WHEN** el usuario cancela el diálogo del sistema o cierra la galería sin elegir fuente
- **THEN** no se inicia ninguna grabación
- **AND** la app permanece en estado inactivo mostrando un mensaje informativo

### Requirement: Selección de región rectangular

En modo región, la app DEBE permitir delimitar un rectángulo sobre un fotograma congelado de la pantalla elegida, sin requerir una ventana superpuesta al escritorio.

#### Scenario: Delimitar la región

- **WHEN** el usuario elige el modo "Región" y concede el permiso de captura
- **THEN** la app muestra un fotograma congelado de la fuente
- **AND** el usuario puede arrastrar para dibujar el rectángulo que se grabará
- **AND** la app muestra las dimensiones de la región en píxeles

#### Scenario: Región inválida

- **WHEN** el usuario intenta confirmar una región menor que 16 × 16 píxeles
- **THEN** la app impide continuar y explica el tamaño mínimo
- **AND** no se inicia la grabación

#### Scenario: Región fuera de los límites

- **WHEN** el rectángulo dibujado excede el área de la fuente
- **THEN** la app recorta el rectángulo a los límites de la fuente antes de grabar

### Requirement: Configuración de la captura

La app DEBE aplicar a la captura el FPS y el perfil de calidad seleccionados y DEBE mantener la resolución nativa de la fuente para evitar pérdida de calidad; la resolución final se aplica al exportar.

#### Scenario: Aplicar FPS a la captura

- **WHEN** el usuario selecciona 30 FPS e inicia una grabación
- **THEN** la pista de vídeo se configura con 30 FPS como valor objetivo
- **AND** el archivo exportado se normaliza a 30 FPS constantes

#### Scenario: Fuente con resolución impar

- **WHEN** la fuente tiene un ancho o alto impar
- **THEN** la app ajusta las dimensiones de salida al valor par más cercano sin deformar la imagen

### Requirement: Cuenta atrás cancelable

La app DEBE ofrecer una cuenta atrás de 3 segundos antes de comenzar a capturar y DEBE permitir cancelarla.

#### Scenario: Cuenta atrás completada

- **WHEN** el usuario pulsa "Grabar" con la cuenta atrás activada
- **THEN** la app muestra una cuenta atrás de 3 segundos y después comienza la grabación

#### Scenario: Cancelar durante la cuenta atrás

- **WHEN** el usuario pulsa "Cancelar" o la tecla Escape durante la cuenta atrás
- **THEN** la grabación no comienza y no se crea ningún archivo

### Requirement: Estado de grabación visible

Durante la grabación la app DEBE mostrar de forma permanente el tiempo transcurrido, un indicador de grabación activa y un control para detenerla.

#### Scenario: Inicio de la grabación

- **WHEN** comienza la captura
- **THEN** la interfaz muestra el indicador de grabación y el temporizador avanzando cada segundo

#### Scenario: Detener la grabación

- **WHEN** el usuario pulsa "Detener"
- **THEN** la captura finaliza, el archivo intermedio se cierra correctamente y se muestra la vista previa con el recorte disponible

### Requirement: Finalización automática por pérdida de fuente

Si la fuente capturada deja de estar disponible, la app DEBE finalizar la grabación de forma segura y conservar lo grabado.

#### Scenario: Ventana cerrada durante la grabación

- **WHEN** la ventana que se está grabando se cierra o el flujo de captura termina por el sistema
- **THEN** la app detiene la grabación automáticamente
- **AND** conserva el archivo intermedio y avisa de lo ocurrido

### Requirement: Sin captura de audio

Esta versión DEBE grabar únicamente vídeo y DEBE indicarlo en la interfaz.

#### Scenario: Grabación sin audio

- **WHEN** el usuario inicia una grabación
- **THEN** el archivo resultante no contiene pistas de audio
- **AND** la interfaz informa de que el audio no está disponible en esta versión

### Requirement: Cursor incluido por el sistema

La app DEBE informar de que el cursor forma parte de la imagen capturada por el compositor y no DEBE prometer un control que la plataforma no ofrece.

#### Scenario: Aviso sobre el cursor

- **WHEN** el usuario consulta las opciones de captura
- **THEN** la app muestra que el cursor se incluye automáticamente cuando el sistema lo permite
- **AND** el control aparece desactivado con una explicación

### Requirement: Atajos globales

La app DEBE permitir iniciar y detener la grabación con un atajo global configurable, incluso sin foco en la ventana.

#### Scenario: Atajo registrado correctamente

- **WHEN** el usuario pulsa el atajo global de grabación estando la app en segundo plano
- **THEN** la app inicia o detiene la grabación según su estado actual

#### Scenario: Atajo no disponible

- **WHEN** el sistema rechaza el registro del atajo (por ejemplo, por falta de identidad de portal en Wayland)
- **THEN** la app sigue funcionando y muestra un aviso con la causa y una alternativa

### Requirement: Persistencia y recuperación del archivo intermedio

La app DEBE escribir la grabación de forma incremental en disco y DEBE permitir recuperar grabaciones interrumpidas por un cierre inesperado.

#### Scenario: Grabación larga sin llenar la memoria

- **WHEN** la grabación supera varios minutos
- **THEN** los datos se escriben en disco de forma incremental
- **AND** el consumo de memoria de la app se mantiene estable

#### Scenario: Recuperar tras un cierre inesperado

- **WHEN** la app se inicia y encuentra un archivo intermedio sin finalizar
- **THEN** ofrece recuperarlo en el historial o descartarlo
- **AND** no elimina archivos sin consentimiento del usuario

### Requirement: Grabación sin ventana de la app en la imagen

La app DEBE minimizar el riesgo de que su propia ventana aparezca en la grabación cuando se graba una pantalla completa.

#### Scenario: Ocultar la app al grabar

- **WHEN** el usuario inicia una grabación de pantalla completa
- **THEN** la app se minimiza automáticamente tras la cuenta atrás
- **AND** se restaura al detener la grabación
