// Focused production regression: real audio gestures and real keyboard interaction at all lanterns.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const url = process.env.URL ?? 'http://127.0.0.1:3003/?test=1'
const out = process.env.SHOTS_DIR ?? fileURLToPath(new URL('../shots/regression-fixes/', import.meta.url))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => m.type() === 'error' && errors.push(m.text()))
const check = (ok, message) => { if (!ok) errors.push(message) }
const finishDialog = async () => {
  for (let i = 0; i < 28; i += 1) {
    if (await page.evaluate(() => window.__game.voyage.mode === 'explore')) return
    if (await page.locator('.dialog.is-active').count()) await page.keyboard.press('Space')
    await page.waitForTimeout(120)
  }
  throw new Error('dialogue did not close through real Space key input')
}

try {
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  await page.click('[data-action="settings"]')
  await page.click('[data-action="sound-test"]')
  await page.waitForFunction(() => window.__game.voyage.audio.ctx.state === 'running')
  const settings = await page.evaluate(() => {
    const g = window.__game
    return { muted: g.save.data.muted, sfx: g.save.data.sfxVolume, state: g.voyage.audio.ctx.state }
  })
  check(!settings.muted && settings.sfx > 0 && settings.state === 'running', `audio settings/output invalid: ${JSON.stringify(settings)}`)

  // Force a browser-style interruption, then recover only with the real preview button click.
  await page.evaluate(async () => {
    const audio = window.__game.voyage.audio
    await audio.ctx.suspend()
    const dest = audio.ctx.createMediaStreamDestination()
    audio.master.connect(dest)
    const chunks = []
    const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' })
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data)
    window.__recordedAudio = { recorder, chunks }
    recorder.start()
  })
  check(await page.evaluate(() => window.__game.voyage.audio.ctx.state === 'suspended'), 'audio interruption was not established')
  await page.click('[data-action="sound-test"]')
  await page.waitForFunction(() => window.__game.voyage.audio.ctx.state === 'running')
  await page.waitForTimeout(1500)
  const recording = await page.evaluate(async () => {
    const { recorder, chunks } = window.__recordedAudio
    const blob = await new Promise(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }))
      recorder.stop()
    })
    return { size: blob.size, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) }
  })
  writeFileSync(`${out}/sound-test.webm`, Buffer.from(recording.bytes))
  check(recording.size > 5000, `recorded audio is empty or truncated (${recording.size} bytes)`)
  await page.click('[data-action="back"]')
  await page.click('[data-action="start"]')
  await page.waitForFunction(() => window.__game.voyage.sceneId === 'hub' && ['explore', 'dialog'].includes(window.__game.voyage.mode), null, { timeout: 30_000 })
  await finishDialog()
  await page.waitForFunction(() => window.__game.voyage.audio.scoreStatus.playing && window.__game.voyage.audio.scoreStatus.instruments === 11, null, { timeout: 30_000 })
  check(await page.evaluate(() => window.__game.voyage.audio.scoreStatus.playing), 'orchestral score did not start after the audio context resumed')
  console.log('audio: real settings clicks, interruption recovery, music start and encoded sound recording passed')

  await page.evaluate(() => window.__game.voyage.enter('heichi', false))
  await page.waitForFunction(() => window.__game.voyage.sceneId === 'heichi' && window.__game.voyage.mode === 'explore', null, { timeout: 30_000 })
  await page.evaluate(() => window.__game.voyage.setQuality('low'))
  await page.waitForTimeout(800)
  // Start near the scholars, then accept their request using the actual E key and dialogue buttons.
  await page.evaluate(() => window.__game.voyage.debugTeleport(0, 1.2, -1.7))
  await page.waitForFunction(() => document.querySelector('.prompt.is-active .prompt-name')?.textContent === '二位才女')
  await page.keyboard.press('KeyE')
  await page.waitForSelector('.dialog.is-active')
  await finishDialog()
  await page.waitForTimeout(600)

  for (const [i, name, answer] of [[0, '灯谜一', 0], [1, '灯谜二', 1], [2, '灯谜三', 0]]) {
    await page.evaluate(i => {
      window.__game.voyage.debugTeleport([-0.77, 0, 0.77][i], 1.2, 2.8)
      window.__game.voyage.active.cam.yaw = 0
    }, i)
    await page.waitForTimeout(500)
    await page.keyboard.down('KeyW')
    let focus
    try {
      for (let step = 0; step < 50; step += 1) {
        await page.waitForTimeout(100)
        focus = await page.evaluate(() => ({
          name: document.querySelector('.prompt.is-active .prompt-name')?.textContent,
          position: window.__game.voyage.debug().pos,
        }))
        if (focus.name === name) break
      }
    } finally {
      await page.keyboard.up('KeyW')
    }
    await page.waitForTimeout(150)
    check(focus.name === name, `${name}: walking to the rack did not focus it (${JSON.stringify(focus)})`)
    if (focus.name !== name) continue
    await page.keyboard.press('KeyE')
    await page.waitForSelector('.dialog.is-active.is-choice', { timeout: 5000 })
    await page.locator(`[data-choice="${answer}"]`).click()
    await page.waitForSelector('.dialog.is-active:not(.is-choice)')
    await finishDialog()
    await page.waitForTimeout(450)
    console.log(`${name}: real walk + E + answer passed`)
  }
  const answered = await page.evaluate(() => window.__game.save.data.progress.chapters.heichi?.data.answered)
  check(Array.isArray(answered) && answered.length === 3, `not all riddles were solved: ${JSON.stringify(answered)}`)
  await page.screenshot({ path: `${out}/riddles-solved.png` })
} catch (error) {
  console.error('failure state:', JSON.stringify(await page.evaluate(() => window.__game?.voyage.debug()).catch(() => null)))
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {})
  throw error
} finally {
  await browser.close()
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('regression-fixes: OK')
