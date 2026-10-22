# Spec Delta

## Purpose

Conserva los ajustes del usuario entre sesiones y expone la información de plataforma y las limitaciones necesarias para usar la aplicación con expectativas claras.

## ADDED Requirements

### Requirement: Valores por defecto

La app DEBE arrancar con valores por defecto sensatos cuando no existan ajustes guardados.

#### Scenario: Primer arranque

- **WHEN** el usuario abre la app por primera vez
- **THEN** la resolución de salida es 1080p, los FPS son 30, la calidad es Media y la cuenta atrás está activada con 3 s
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

### Requirement: Carpeta de destino configurable

La app DEBE permitir elegir la carpeta donde se guardan los MP4 y DEBE comprobar que se puede escribir antes de usarla.

#### Scenario: Cambiar carpeta de destino

- **WHEN** el usuario elige una carpeta válida y con permisos de escritura
- **THEN** el diálogo de guardado la propone por defecto en las siguientes exportaciones

#### Scenario: Carpeta no escribible

- **WHEN** la carpeta configurada ha desaparecido o no tiene permisos de escritura
- **THEN** la app avisa y propone la carpeta de vídeos del usuario como alternativa
- **AND** no pierde la grabación original

### Requirement: Atajo global configurable

La app DEBE permitir cambiar el atajo global y DEBE informar cuando el sistema no puede registrarlo.

#### Scenario: Cambiar el atajo

- **WHEN** el usuario define una combinación válida y libre
- **THEN** el nuevo atajo inicia y detiene la grabación
- **AND** el atajo anterior deja de estar registrado

#### Scenario: Combinación ya ocupada

- **WHEN** la combinación elegida ya está en uso por otra aplicación
- **THEN** la app mantiene el atajo anterior y muestra un aviso

### Requirement: Información de plataforma

La app DEBE detectar la plataforma y el servidor gráfico para mostrar instrucciones adecuadas sobre la selección de fuentes y el cursor.

#### Scenario: Sesión Wayland

- **WHEN** la app se ejecuta en una sesión Wayland
- **THEN** indica que la fuente se elige mediante el diálogo del sistema
- **AND** no intenta mostrar una galería de ventanas que el portal no permite enumerar

#### Scenario: Sesión Windows o X11

- **WHEN** la app se ejecuta en Windows o en una sesión X11
- **THEN** permite elegir la fuente desde la galería interna de la app

### Requirement: Idioma de la interfaz

La interfaz DEBE estar en español y DEBE mantener los textos centralizados para facilitar futuras traducciones.

#### Scenario: Textos en español

- **WHEN** el usuario utiliza cualquier pantalla de la app
- **THEN** todos los textos visibles, mensajes de error y confirmaciones están en español

### Requirement: Funcionamiento sin red

La app DEBE funcionar completamente sin conexión y DEBE limitar el acceso a red a su propio contenido local.

#### Scenario: Uso sin conexión

- **WHEN** el equipo no tiene conexión a internet
- **THEN** grabar, exportar y gestionar el historial siguen funcionando con normalidad

#### Scenario: Política de seguridad del renderer

- **WHEN** la ventana carga contenido
- **THEN** el renderer no tiene acceso directo a Node.js ni al sistema de archivos
- **AND** solo puede invocar las operaciones expuestas por la API de preload
