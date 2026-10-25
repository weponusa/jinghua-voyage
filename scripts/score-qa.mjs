// Real-browser score verification: click the actual preview button and record the master output.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const url = process.env.URL ?? 'http://127.0.0.1:3003/?test=1'
const out = process.env.SHOTS_DIR ?? fileURLToPath(new URL('../shots/score-qa/', import.meta.url))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => m.type() === 'error' && errors.push(m.text()))

try {
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  await page.click('[data-action="settings"]')
  await page.click('[data-action="music-test"]')
  await page.waitForFunction(() => {
    const s = window.__game.voyage.audio.scoreStatus
    return s.playing && s.instruments === 11
  }, null, { timeout: 45_000 })
  await page.evaluate(() => {
    const audio = window.__game.voyage.audio
    const destination = audio.ctx.createMediaStreamDestination()
    const analyser = audio.ctx.createAnalyser()
    analyser.fftSize = 2048
    audio.master.connect(destination)
    audio.master.connect(analyser)
    window.recordScore = async milliseconds => {
      const chunks = []
      const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' })
      recorder.ondataavailable = event => event.data.size && chunks.push(event.data)
      const samples = new Float32Array(analyser.fftSize)
      let peak = 0
      let sum = 0
      let count = 0
      const meter = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples)
        for (const value of samples) {
          peak = Math.max(peak, Math.abs(value))
          sum += value * value
          count += 1
        }
      }, 80)
      recorder.start()
      await new Promise(resolve => setTimeout(resolve, milliseconds))
      const blob = await new Promise(resolve => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }))
        recorder.stop()
      })
      clearInterval(meter)
      return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), size: blob.size, peak, rms: Math.sqrt(sum / Math.max(count, 1)) }
    }
  })

  const reports = {}
  for (const scene of ['hub', 'heichi', 'penglai']) {
    await page.evaluate(scene => window.__game.voyage.audio.setScene(scene), scene)
    await page.waitForTimeout(700)
    const clip = await page.evaluate(() => window.recordScore(6500))
    writeFileSync(`${out}/${scene}-theme.webm`, Buffer.from(clip.bytes))
    reports[scene] = { size: clip.size, peak: Number(clip.peak.toFixed(5)), rms: Number(clip.rms.toFixed(5)) }
    if (clip.size < 20_000 || clip.peak < 0.001 || clip.rms < 0.0001) errors.push(`${scene}: invalid orchestral recording ${JSON.stringify(reports[scene])}`)
  }
  await page.evaluate(() => window.__game.voyage.audio.setMusicMood('dialog'))
  const dialog = await page.evaluate(() => window.__game.voyage.audio.scoreStatus.mood)
  if (dialog !== 'dialog') errors.push('dialogue orchestration did not enter its reduced arrangement')
  await page.evaluate(() => window.__game.voyage.audio.setMusicMood('triumph'))
  const triumph = await page.evaluate(() => window.__game.voyage.audio.scoreStatus.mood)
  if (triumph !== 'triumph') errors.push('triumph orchestration did not activate')
  writeFileSync(`${out}/score-report.json`, JSON.stringify({ instruments: 11, reports, dialog, triumph }, null, 2))
  console.log(JSON.stringify(reports, null, 2))
} finally {
  await browser.close()
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('score-qa: OK (real preview click, 11 sampled instruments, three recorded variations, dialogue and triumph states)')
