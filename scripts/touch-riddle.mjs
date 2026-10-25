// Mobile regression for the previously unreachable third lantern: real joystick, touch button and choice.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const url = process.env.URL ?? 'http://127.0.0.1:3003/?test=1'
const out = fileURLToPath(new URL('../shots/regression-fixes/', import.meta.url))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
try {
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  await page.evaluate(() => {
    const g = window.__game
    const p = g.save.data.progress
    g.save.update({ progress: { ...p, chapters: { ...p.chapters, heichi: { solved: false, flowerCollected: false, visited: [], data: { accepted: true } } } } })
    return g.voyage.enter('heichi', false)
  })
  await page.waitForFunction(() => window.__game.voyage.sceneId === 'heichi' && window.__game.voyage.mode === 'explore', null, { timeout: 30_000 })
  await page.evaluate(() => {
    window.__game.ui.show('hud')
    window.__game.voyage.setQuality('low')
    window.__game.voyage.debugTeleport(0.77, 1.2, 3.6)
    window.__game.voyage.active.cam.yaw = 0
  })
  await page.waitForTimeout(700)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 270, id: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 246, id: 1 }] })
  // Stop on the actual focus instead of a wall-clock delay: software-rendered phones have uneven FPS.
  await page.waitForFunction(() => document.querySelector('.prompt.is-active .prompt-name')?.textContent === '灯谜三', null, { timeout: 8000, polling: 50 })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  const action = await page.locator('.touch-act').boundingBox()
  if (!action) throw new Error('touch interaction button is not visible')
  await page.touchscreen.tap(action.x + action.width / 2, action.y + action.height / 2)
  await page.waitForSelector('.dialog.is-active.is-choice', { timeout: 5000 })
  await page.locator('[data-choice="0"]').tap()
  await page.waitForSelector('.dialog.is-active:not(.is-choice)')
  for (let i = 0; i < 8; i += 1) {
    if (await page.evaluate(() => window.__game.voyage.mode === 'explore')) break
    await page.locator('.dialog').tap({ position: { x: 80, y: 35 } })
    await page.waitForTimeout(160)
  }
  await page.waitForFunction(() => window.__game.voyage.mode === 'explore')
  const answered = await page.evaluate(() => window.__game.save.data.progress.chapters.heichi?.data.answered)
  if (!Array.isArray(answered) || !answered.includes(2)) errors.push(`third riddle not saved: ${JSON.stringify(answered)}`)
  await page.screenshot({ path: `${out}/third-riddle-touch.png` })
  await page.reload()
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('jinghua.save.test')).progress.chapters.heichi.data.answered)
  if (!restored.includes(2)) errors.push('third riddle did not survive refresh')
  console.log('touch-riddle: real joystick + touch interaction + answer + refresh passed')
} catch (error) {
  console.error('failure:', JSON.stringify(await page.evaluate(() => window.__game?.voyage.debug()).catch(() => null)))
  await page.screenshot({ path: `${out}/third-riddle-touch-failure.png` }).catch(() => {})
  errors.push(String(error))
} finally {
  await browser.close()
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
