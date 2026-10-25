import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const out = fileURLToPath(new URL('../shots/map-hud-2026-10-25/', import.meta.url))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const url = process.env.URL ?? 'http://127.0.0.1:3003/?test=1'
const ids = process.env.ONLY?.split(',') ?? ['hub', 'junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai']
const report = []

async function enter(page, id) {
  await page.evaluate(id => window.__game.voyage.enter(id, false), id)
  await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 45_000 })
  await page.evaluate(() => window.__game.ui.show('hud'))
  await page.waitForFunction(() => {
    const image = document.querySelector('.mini-map .terrain-artwork')
    return image instanceof SVGImageElement && image.href.baseVal.includes('/interface/mini-')
  })
  await page.waitForTimeout(350)
}

async function inspectMini(page, id, label) {
  const result = await page.evaluate(() => {
    const field = document.querySelector('.mini-map-field')
    const art = document.querySelector('.mini-map .terrain-artwork')
    const player = document.querySelector('.mini-map .mini-player')
    const rect = field.getBoundingClientRect()
    const playerRect = player.getBoundingClientRect()
    const map = window.__game.voyage.active.map
    return {
      mapId: map.id,
      art: art.href.baseVal,
      field: { width: rect.width, height: rect.height },
      expectedAspect: (map.bounds.maxX - map.bounds.minX) / (map.bounds.maxZ - map.bounds.minZ),
      actualAspect: rect.width / rect.height,
      lowPriority: document.querySelectorAll('.mini-map .mini-landmark--story, .mini-map .mini-landmark--view').length,
      playerInside: playerRect.left >= rect.left - 10 && playerRect.right <= rect.right + 10 && playerRect.top >= rect.top - 10 && playerRect.bottom <= rect.bottom + 10,
    }
  })
  assert.equal(result.mapId, id)
  assert(result.art.endsWith(`/interface/mini-${id}.webp`), `${label}/${id}: wrong mini artwork`)
  assert(Math.abs(result.expectedAspect - result.actualAspect) < 0.015, `${label}/${id}: distorted map field ${result.actualAspect}`)
  assert.equal(result.lowPriority, 0, `${label}/${id}: low-priority landmarks remain`)
  assert(result.playerInside, `${label}/${id}: player marker outside field`)
  report.push({ label, ...result })
}

try {
  if (process.env.SCOPE !== 'mobile') {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desktop.goto(url)
  await desktop.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  for (const id of ids) {
    await enter(desktop, id)
    await inspectMini(desktop, id, 'desktop')
    if (id === 'hub' || id === 'junzi') {
      await desktop.locator('.mini-map-button').screenshot({ path: `${out}/desktop-${id}-mini.png` })
    }
    if (id === 'hub') {
      await desktop.click('[data-action="local-map"]')
      await desktop.waitForSelector('.local-map.is-active')
      await desktop.waitForFunction(() => Number(getComputedStyle(document.querySelector('.local-map')).opacity) > 0.99)
      const full = await desktop.evaluate(() => {
        const el = document.querySelector('.local-map-visual--hub')
        const art = document.querySelector('.local-map .terrain-artwork')
        const r = el.getBoundingClientRect()
        return { art: art.href.baseVal, width: r.width, height: r.height, viewport: innerHeight, ratio: r.width / r.height }
      })
      assert(full.art.endsWith('/interface/map-hub.webp'), 'hub: full painted map missing')
      assert(full.height < full.viewport * 0.72, 'hub: full map exceeds viewport-safe height')
      assert(Math.abs(full.ratio - 14 / 30) < 0.015, 'hub: full map distorted')
      await desktop.screenshot({ path: `${out}/desktop-hub-full.png`, fullPage: false })
      report.push({ label: 'desktop-hub-full', ...full })
      await desktop.click('[data-action="local-close"]')
    }
  }
  console.log('desktop: all eight maps passed')
  await desktop.close()
  }

  if (process.env.SCOPE !== 'desktop') for (const device of [
    { label: 'phone-portrait', viewport: { width: 390, height: 844 } },
    { label: 'phone-landscape', viewport: { width: 844, height: 390 } },
  ]) {
    const phone = await browser.newPage({ viewport: device.viewport, isMobile: true, hasTouch: true })
    await phone.goto(url)
    await phone.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
    for (const id of process.env.ONLY?.split(',') ?? ['hub', 'junzi']) {
      await enter(phone, id)
      await inspectMini(phone, id, device.label)
      await phone.locator('.mini-map-button').screenshot({ path: `${out}/${device.label}-${id}-mini.png` })
      if (id === 'hub') {
        await phone.tap('[data-action="local-map"]')
        await phone.waitForSelector('.local-map.is-active')
        await phone.waitForFunction(() => Number(getComputedStyle(document.querySelector('.local-map')).opacity) > 0.99)
        await phone.screenshot({ path: `${out}/${device.label}-hub-full.png`, fullPage: false })
        await phone.tap('[data-action="local-close"]')
      }
    }
    await phone.close()
    console.log(`${device.label}: hub and junzi passed`)
  }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
  console.log('map-hud-qa: OK')
} finally {
  await browser.close()
}
