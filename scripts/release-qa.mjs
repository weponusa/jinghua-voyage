import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = process.env.URL ?? 'http://127.0.0.1:3003/'
const out = fileURLToPath(new URL('../shots/release-qa-2026-10-25/', import.meta.url))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
const failedResponses = []
const report = { covers: {}, normalLock: false, saveIsolation: false, singlePresses: 0 }
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.on('pageerror', e => errors.push(String(e)))
page.on('response', r => { if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.url()}`) })

async function title(p) {
  await p.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  await p.waitForFunction(() => {
    const image = document.querySelector('.title-cover img')
    return image?.complete && image.naturalWidth > 0
  })
}

try {
  await page.goto(base)
  await title(page)
  const desktop = await page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.content ?? '',
    cover: document.querySelector('.title-cover img')?.currentSrc ?? '',
    status: document.querySelector('.title-status')?.textContent ?? '',
  }))
  assert(desktop.description.includes('七章完整航程'))
  assert(!desktop.description.includes('第一章'))
  assert(desktop.cover.includes('cover-jinghua-full'))
  assert(desktop.status.includes('七章完整航程'))
  report.covers.desktop = desktop
  await page.screenshot({ path: `${out}/title-desktop.png` })

  // A fresh normal save must not unlock the second chapter.
  await page.evaluate(() => window.__game.voyage.enter('daren', false))
  assert.equal(await page.evaluate(() => window.__game.voyage.sceneId), 'hub')
  report.normalLock = true

  // Both modes share an origin, but must read and write different save records.
  await page.evaluate(() => window.__game.save.update({ sensitivity: 1.4 }))
  await page.goto(`${base}?test=1`)
  await title(page)
  const isolated = await page.evaluate(() => ({
    sensitivity: window.__game.save.data.sensitivity,
    normal: JSON.parse(localStorage.getItem('jinghua.save') ?? '{}').sensitivity,
    status: document.querySelector('.title-status')?.textContent ?? '',
  }))
  assert.equal(isolated.sensitivity, 1)
  assert.equal(isolated.normal, 1.4)
  assert(isolated.status.includes('独立测试存档'))
  report.saveIsolation = true

  // Force a 144 Hz rAF schedule. Render-only frames must not eat a single physical E press.
  const fast = await context.newPage()
  fast.on('pageerror', e => errors.push(String(e)))
  await fast.addInitScript(() => {
    let next = 1
    const timers = new Map()
    window.requestAnimationFrame = callback => {
      const id = next++
      timers.set(id, window.setTimeout(() => { timers.delete(id); callback(performance.now()) }, 1000 / 144))
      return id
    }
    window.cancelAnimationFrame = id => { clearTimeout(timers.get(id)); timers.delete(id) }
  })
  await fast.goto(`${base}?test=1`)
  await title(fast)
  await fast.evaluate(() => window.__game.voyage.enter('junzi', false))
  await fast.waitForFunction(() => window.__game.voyage.sceneId === 'junzi' && window.__game.voyage.mode === 'explore', null, { timeout: 60_000 })
  await fast.evaluate(() => window.__game.ui.show('hud'))
  for (let i = 0; i < 10; i += 1) {
    await fast.evaluate(() => {
      const a = window.__game.voyage.active
      const it = a.things.find(t => t.name === '多九公')
      window.__game.voyage.debugTeleport(it.pos.x, it.pos.y + 1.2, it.pos.z + 0.65)
    })
    await fast.waitForFunction(() => document.querySelector('.prompt.is-active .prompt-name')?.textContent === '多九公')
    await fast.keyboard.press('KeyE')
    try {
      await fast.waitForFunction(() => window.__game.voyage.mode === 'dialog' && document.querySelector('.dialog.is-active'), null, { timeout: 2_500 })
    } catch (error) {
      console.error('single-press failure', i + 1, await fast.evaluate(() => ({
        state: window.__game.voyage.debug(),
        prompt: document.querySelector('.prompt')?.textContent,
        mode: window.__game.voyage.mode,
      })))
      await fast.screenshot({ path: `${out}/single-press-failure.png` })
      throw error
    }
    report.singlePresses += 1
    for (let n = 0; n < 8 && await fast.evaluate(() => window.__game.voyage.mode === 'dialog'); n += 1) {
      await fast.keyboard.press('KeyE')
      await fast.waitForTimeout(100)
    }
    await fast.waitForFunction(() => window.__game.voyage.mode === 'explore')
    await fast.waitForTimeout(360)
  }
  assert.equal(report.singlePresses, 10)
  await fast.close()

  const portrait = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const phone = await portrait.newPage()
  phone.on('pageerror', e => errors.push(String(e)))
  await phone.goto(base)
  await title(phone)
  const mobileCover = await phone.evaluate(() => document.querySelector('.title-cover img')?.currentSrc ?? '')
  assert(mobileCover.includes('title-jinghua-full'))
  report.covers.portrait = mobileCover
  await phone.screenshot({ path: `${out}/title-phone-portrait.png` })
  await phone.setViewportSize({ width: 844, height: 390 })
  await phone.waitForTimeout(250)
  await phone.screenshot({ path: `${out}/title-phone-landscape.png` })
  await portrait.close()

  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [])
  writeFileSync(`${out}/report.json`, JSON.stringify({ ok: true, ...report, errors, failedResponses }, null, 2))
  console.log(JSON.stringify({ ok: true, ...report, errors, failedResponses }, null, 2))
  console.log('release-qa: OK')
} finally {
  await browser.close()
}
