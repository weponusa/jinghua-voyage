// Export the real north-up terrain renders used beneath each local navigation UI.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const out = fileURLToPath(new URL('../shots/map-reference-2026-10-25/', import.meta.url))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 900, height: 650 } })
try {
  await page.goto(process.env.URL ?? 'http://127.0.0.1:3003/?test=1')
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  for (const id of ['hub', 'junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai']) {
    await page.evaluate(id => window.__game.voyage.enter(id, false), id)
    await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 45_000 })
    const data = await page.evaluate(() => window.__game.voyage.active.map.illustration)
    if (!data?.startsWith('data:image/png;base64,')) throw new Error(`${id}: no real map illustration`)
    writeFileSync(`${out}/${id}.png`, Buffer.from(data.split(',')[1], 'base64'))
    console.log(`${id}: real terrain map exported`)
  }
} finally {
  await browser.close()
}
