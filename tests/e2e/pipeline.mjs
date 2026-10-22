import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'
import ffmpegStatic from 'ffmpeg-static'

const ffmpegPath = ffmpegStatic
const dataDir = mkdtempSync(join(tmpdir(), 'captura-pipeline-data-'))
const outputDir = mkdtempSync(join(tmpdir(), 'captura-pipeline-out-'))
let app

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const orphanId = 'huerfana-e2e'
mkdirSync(join(dataDir, 'recordings', orphanId), { recursive: true })
const orphanFixture = spawnSync(
  ffmpegPath,
  [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=320x240:rate=30',
    '-t',
    '2',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '500k',
    '-pix_fmt',
    'yuv420p',
    join(dataDir, 'recordings', orphanId, 'source.webm')
  ],
  { encoding: 'utf8' }
)
if (orphanFixture.status !== 0) {
  throw new Error(`No se pudo crear el fixture huérfano: ${orphanFixture.stderr}`)
}

function probe(filePath) {
  const result = spawnSync(ffmpegPath, ['-hide_banner', '-i', filePath], { encoding: 'utf8' })
  const output = result.stderr
  const duration = /Duration:\s(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output)
  const videoLine = output
    .split('\n')
    .find((line) => line.includes('Stream #') && line.includes('Video:'))
  const dimensions = videoLine ? /,\s(\d{2,5})x(\d{2,5})(?:[\s,]|$)/.exec(videoLine) : null
  const fps = videoLine ? /(\d+(?:\.\d+)?)\s*fps/.exec(videoLine) : null

  return {
    durationMs: duration
      ? (Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])) * 1000
      : 0,
    width: dimensions ? Number(dimensions[1]) : 0,
    height: dimensions ? Number(dimensions[2]) : 0,
    fps: fps ? Number(fps[1]) : 0,
    hasAudio: output.includes('Audio:'),
    isH264: /Video:\s*h264/i.test(output)
  }
}

try {
  const executablePath = process.env.CAPTURA_EXECUTABLE
  app = await electron.launch({
    executablePath,
    args: executablePath ? ['--no-sandbox'] : ['--no-sandbox', 'out/main/index.js'],
    env: {
      ...process.env,
      CAPTURA_DATA_DIR: dataDir,
      CAPTURA_DISABLE_GLOBAL_SHORTCUTS: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      NODE_ENV: 'test'
    },
    timeout: 30_000
  })

  const window = await app.firstWindow({ timeout: 30_000 })
  await window.waitForLoadState('domcontentloaded')

  const externalRequests = []
  window.on('request', (request) => {
    if (/^https?:/i.test(request.url())) {
      externalRequests.push(request.url())
    }
  })

  const entry = await window.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Sin contexto 2D')
    }

    let hue = 0
    const painter = window.setInterval(() => {
      hue = (hue + 13) % 360
      context.fillStyle = `hsl(${hue} 70% 45%)`
      context.fillRect(0, 0, canvas.width, canvas.height)
    }, 33)

    const stream = canvas.captureStream(30)
    const session = await window.api.startRecording({
      mode: 'screen',
      fps: 30,
      quality: 'medium',
      region: null,
      sourceWidth: 640,
      sourceHeight: 360
    })

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2_000_000
    })
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve
    })

    recorder.start(250)
    await new Promise((resolve) => setTimeout(resolve, 1800))
    recorder.stop()
    await stopped
    window.clearInterval(painter)
    stream.getTracks().forEach((track) => track.stop())

    for (const chunk of chunks) {
      await window.api.appendChunk(session.sessionId, await chunk.arrayBuffer())
    }

    return window.api.finishRecording({
      sessionId: session.sessionId,
      durationMs: 1800,
      width: 640,
      height: 360,
      fps: 30,
      mode: 'screen'
    })
  })

  assert(entry.status === 'complete', 'La entrada no se marcó como completa')
  assert(existsSync(entry.sourcePath), 'No se creó el WebM intermedio')
  assert(statSync(entry.sourcePath).size > 1000, 'El WebM intermedio está vacío')
  assert(entry.thumbPath && existsSync(entry.thumbPath), 'No se generó la miniatura')

  const history = await window.evaluate(() => window.api.listHistory())
  assert(
    history.some((item) => item.id === entry.id),
    'La entrada no aparece en el historial'
  )

  const outputPath = join(outputDir, 'smoke-export.mp4')
  const outcome = await window.evaluate(
    async ({ entryId, outputPath: target }) => {
      const exportId =
        typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `export-${Date.now()}`
      return window.api.runExport({
        exportId,
        entryId,
        outputPath: target,
        options: {
          startMs: 100,
          endMs: 1200,
          width: 320,
          height: 240,
          fps: 24,
          quality: 'high'
        }
      })
    },
    { entryId: entry.id, outputPath }
  )

  assert(outcome.ok, `La exportación falló: ${JSON.stringify(outcome)}`)
  assert(existsSync(outputPath), 'No se creó el MP4')

  const info = probe(outputPath)
  assert(info.width === 320, `Ancho inesperado: ${info.width}`)
  assert(info.height === 240, `Alto inesperado: ${info.height}`)
  assert(info.fps === 24, `FPS inesperados: ${info.fps}`)
  assert(info.isH264, 'El códec no es H.264')
  assert(!info.hasAudio, 'El MP4 contiene audio')
  assert(info.durationMs > 700 && info.durationMs < 1500, `Duración inesperada: ${info.durationMs}`)

  const sourceSize = statSync(entry.sourcePath).size
  const outputSize = statSync(outputPath).size

  const invalidShortcut = await window.evaluate(() => window.api.setShortcut('R'))
  assert(
    !invalidShortcut.registered && Boolean(invalidShortcut.error),
    'La validación de atajos no rechazó una combinación inválida'
  )

  const readOnlyDir = join(outputDir, 'solo-lectura')
  mkdirSync(readOnlyDir, { recursive: true })
  chmodSync(readOnlyDir, 0o500)
  const folderResult = await window.evaluate(async (dir) => {
    try {
      await window.api.updateSettings({ outputDir: dir })
      return { ok: true, message: '' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }, readOnlyDir)
  assert(!folderResult.ok, 'La app aceptó una carpeta sin permisos de escritura')
  chmodSync(readOnlyDir, 0o700)

  const writableDir = join(outputDir, 'grabaciones')
  const writableSettings = await window.evaluate(
    (dir) => window.api.updateSettings({ outputDir: dir }),
    writableDir
  )
  assert(
    writableSettings.outputDir === writableDir,
    'La app no guardó una carpeta de grabaciones válida'
  )

  const updated = await window.evaluate(() => window.api.listHistory())
  const stored = updated.find((item) => item.id === entry.id)
  assert(stored?.exports.length === 1, 'La exportación no se registró en el historial')

  const orphans = await window.evaluate(() => window.api.listOrphans())
  assert(
    orphans.some((orphan) => orphan.id === orphanId),
    'No se detectó la grabación huérfana de prueba'
  )

  const recovered = await window.evaluate((id) => window.api.recoverOrphan(id), orphanId)
  assert(recovered.status === 'recovered', 'La grabación huérfana no se marcó como recuperada')
  assert(recovered.durationMs > 1500, `Duración recuperada inesperada: ${recovered.durationMs}`)
  assert(
    recovered.thumbPath && existsSync(recovered.thumbPath),
    'La grabación recuperada no tiene miniatura'
  )
  await window.evaluate((id) => window.api.removeRecording(id), orphanId)

  await window.evaluate((entryId) => window.api.removeRecording(entryId), entry.id)

  assert(
    externalRequests.length === 0,
    `La aplicación hizo peticiones de red inesperadas: ${externalRequests.join(', ')}`
  )

  console.log(
    `PIPELINE_OK source=${sourceSize} export=${outputSize} ` +
      `duration=${info.durationMs} size=${info.width}x${info.height} fps=${info.fps}`
  )
} finally {
  if (app) {
    await app.close()
  }
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(outputDir, { recursive: true, force: true })
}
