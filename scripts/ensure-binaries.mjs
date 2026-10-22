import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

function ensureElectron() {
  let packagePath
  try {
    packagePath = require.resolve('electron/package.json')
  } catch {
    return
  }

  const electronDir = dirname(packagePath)
  const versionFile = join(electronDir, 'dist', 'version')
  const pathFile = join(electronDir, 'path.txt')

  if (existsSync(versionFile) && existsSync(pathFile)) {
    return
  }

  console.log('Descargando el binario de Electron...')
  const result = spawnSync(process.execPath, [join(electronDir, 'install.js')], {
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    console.error('No se pudo descargar el binario de Electron.')
    process.exit(result.status ?? 1)
  }
}

function ensureFfmpeg() {
  try {
    const ffmpegPath = require('ffmpeg-static')
    if (typeof ffmpegPath === 'string' && existsSync(ffmpegPath)) {
      return
    }

    const ffmpegDir = dirname(require.resolve('ffmpeg-static/package.json'))
    spawnSync(process.execPath, [join(ffmpegDir, 'install.js')], { stdio: 'inherit' })
  } catch {
    // ffmpeg-static no está instalado (por ejemplo, en una instalación de producción).
  }
}

ensureElectron()
ensureFfmpeg()

console.log('Binarios de Electron y FFmpeg verificados.')
