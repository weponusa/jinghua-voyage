// node scripts/view-model.mjs assets/source-models/props/junk_ship.glb [out.png]
import { chromium } from 'playwright'
const [m, out = 'shots/view.png'] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 960 } })
page.on('pageerror', e => console.error('pageerror', String(e)))
await page.goto(`${process.env.URL ?? 'http://127.0.0.1:3000'}/viewer.html?m=${m}`)
await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 90_000 })
console.log(await page.evaluate(() => document.getElementById('info')?.textContent))
await page.screenshot({ path: out })
await browser.close()
console.log('saved', out)
