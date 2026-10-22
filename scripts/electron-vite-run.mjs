import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const command = process.argv[2] ?? 'dev'
const env = { ...process.env }

if (process.platform === 'linux') {
  let disableSandbox = true

  try {
    const require = createRequire(import.meta.url)
    const electronDir = dirname(require.resolve('electron/package.json'))
    const sandboxPath = join(electronDir, 'dist', 'chrome-sandbox')

    if (existsSync(sandboxPath)) {
      const stat = statSync(sandboxPath)
      const correctlyConfigured = stat.uid === 0 && (stat.mode & 0o4000) !== 0
      disableSandbox = !correctlyConfigured
    }
  } catch {
    disableSandbox = true
  }

  if (disableSandbox) {
    env.NO_SANDBOX = '1'
    console.warn(
      'Aviso: chrome-sandbox no tiene setuid root; se inicia Electron con --no-sandbox (solo desarrollo).'
    )
  }
}

const child = spawn('electron-vite', [command], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})
