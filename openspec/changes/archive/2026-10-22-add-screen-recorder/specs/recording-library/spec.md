# Spec Delta

## Purpose

Mantiene un historial local de las grabaciones con sus metadatos y miniaturas, y ofrece acciones para reproducirlas, reexportarlas, localizarlas en disco o eliminarlas.

## ADDED Requirements

### Requirement: Registro de grabaciones finalizadas

La app DEBE registrar cada grabación finalizada con identificador, fecha, duración, tamaño, resolución, FPS y una miniatura.

#### Scenario: Nueva grabación en el historial

- **WHEN** el usuario detiene una grabación y el archivo intermedio se cierra correctamente
- **THEN** aparece una entrada nueva en el historial con su miniatura y metadatos
- **AND** la entrada persiste después de reiniciar la aplicación

#### Scenario: Miniatura no disponible

- **WHEN** no se puede extraer una miniatura del archivo intermedio
- **THEN** la entrada se registra igualmente con una imagen de marcador de posición

### Requirement: Listado ordenado y filtrable

La app DEBE mostrar las grabaciones de la más reciente a la más antigua y DEBE indicar claramente el tamaño total ocupado.

#### Scenario: Orden del historial

- **WHEN** el usuario abre la pestaña de historial con varias grabaciones
- **THEN** la más reciente aparece primero
- **AND** se muestra el espacio total ocupado por las grabaciones y los temporales

### Requirement: Vista previa y reproducción

La app DEBE permitir reproducir una grabación del historial dentro de la aplicación antes de exportarla.

#### Scenario: Reproducir una entrada

- **WHEN** el usuario selecciona una grabación del historial
- **THEN** la app la carga en el reproductor interno y permite reproducirla, pausarla y buscar en la línea de tiempo

### Requirement: Localizar la grabación en el sistema de archivos

La app DEBE permitir abrir la carpeta que contiene una grabación y, cuando exista un archivo exportado, revelarlo en el explorador del sistema.

#### Scenario: Abrir carpeta

- **WHEN** el usuario pulsa "Abrir carpeta" en una entrada
- **THEN** se abre el explorador de archivos en el directorio de esa grabación

#### Scenario: Revelar archivo exportado

- **WHEN** la entrada ya tiene un MP4 exportado y el usuario pulsa "Mostrar archivo"
- **THEN** el explorador selecciona ese archivo concreto

### Requirement: Reexportación desde el historial

La app DEBE permitir exportar de nuevo una grabación existente con otros ajustes de recorte, resolución, FPS o calidad.

#### Scenario: Reexportar con otros ajustes

- **WHEN** el usuario elige "Reexportar" en una entrada del historial
- **THEN** se abre la vista de exportación con la grabación cargada y sus ajustes actuales
- **AND** la exportación crea un archivo nuevo sin modificar el anterior

### Requirement: Eliminación de grabaciones

La app DEBE permitir eliminar una entrada del historial junto con sus archivos, solicitando confirmación previa.

#### Scenario: Confirmar eliminación

- **WHEN** el usuario pulsa "Eliminar" y confirma el diálogo
- **THEN** se borran el archivo intermedio, las miniaturas y la entrada del historial
- **AND** el espacio total mostrado se actualiza

#### Scenario: Cancelar eliminación

- **WHEN** el usuario cierra el diálogo de confirmación sin aceptar
- **THEN** la entrada y sus archivos permanecen intactos

### Requirement: Limpieza de archivos temporales

La app DEBE ofrecer una acción explícita para eliminar los archivos intermedios que ya no sean necesarios, conservando los MP4 exportados.

#### Scenario: Limpiar temporales

- **WHEN** el usuario pulsa "Limpiar temporales" y confirma
- **THEN** se eliminan los WebM intermedios de las entradas ya exportadas
- **AND** el historial conserva las entradas y sus MP4
- **AND** las entradas sin exportar no se eliminan

### Requirement: Recuperación de grabaciones interrumpidas

La app DEBE detectar archivos intermedios huérfanos al iniciar y DEBE ofrecer recuperarlos o descartarlos.

#### Scenario: Recuperar archivo huérfano

- **WHEN** la app encuentra un archivo intermedio de una sesión anterior sin entrada en el historial
- **THEN** muestra un aviso con la opción de recuperarlo como entrada del historial o descartarlo

#### Scenario: Descartar archivo huérfano

- **WHEN** el usuario elige descartar un archivo huérfano
- **THEN** el archivo se elimina y el aviso desaparece
