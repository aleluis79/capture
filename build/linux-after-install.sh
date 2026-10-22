#!/bin/sh
# El sandbox de Chromium necesita que chrome-sandbox sea setuid root.
# electron-builder no lo ajusta automáticamente al empaquetar.
if [ -f /opt/Captura/chrome-sandbox ]; then
  chown root:root /opt/Captura/chrome-sandbox 2>/dev/null || true
  chmod 4755 /opt/Captura/chrome-sandbox 2>/dev/null || true
fi
