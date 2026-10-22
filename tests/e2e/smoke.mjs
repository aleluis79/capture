import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const userDataDir = await mkdtemp(join(tmpdir(), 'captura-smoke-'))

let app
try {
  const executablePath = process.env.CAPTURA_EXECUTABLE
  app = await electron.launch({
    executablePath,
    args: executablePath ? ['--no-sandbox'] : ['--no-sandbox', 'out/main/index.js'],
    env: {
      ...process.env,
      CAPTURA_DISABLE_GLOBAL_SHORTCUTS: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      NODE_ENV: 'test'
    },
    timeout: 30_000
  })

  const window = await app.firstWindow({ timeout: 30_000 })
  await window.waitForLoadState('domcontentloaded')

  const heading = await window.locator('h1').first().textContent({ timeout: 15_000 })
  if (heading?.trim() !== 'Captura') {
    throw new Error(`Título inesperado en la ventana: ${heading}`)
  }

  const hasApi = await window.evaluate(() => {
    return typeof window.api?.getPlatformInfo === 'function'
  })
  if (!hasApi) {
    throw new Error('La API de preload no está expuesta en el renderer')
  }

  const platform = await window.evaluate(async () => {
    return window.api.getPlatformInfo()
  })
  if (!platform || typeof platform.sessionType !== 'string') {
    throw new Error('La API de plataforma no devolvió información válida')
  }

  const settingsLoaded = await window.evaluate(async () => {
    const settings = await window.api.getSettings()
    return Boolean(settings && Number.isFinite(settings.fps))
  })
  if (!settingsLoaded) {
    throw new Error('La API de ajustes no devolvió valores válidos')
  }

  console.log(`SMOKE_OK session=${platform.sessionType} heading=${heading}`)
} finally {
  if (app) {
    await app.close()
  }
  await rm(userDataDir, { recursive: true, force: true })
}
