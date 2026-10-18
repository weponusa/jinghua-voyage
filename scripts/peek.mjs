// Screenshot one scene from a chosen spot: node scripts/peek.mjs <scene> <x> <z> <yaw> [out.png]
import { chromium } from 'playwright'

const [scene = 'hub', x = '0', z = '0', yaw = '0', out = 'shots/peek.png'] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } })
page.on('pageerror', e => console.error('pageerror', String(e)))
await page.goto(process.env.URL ?? 'http://127.0.0.1:3000/')
await page.waitForFunction(() => document.getElementById('ui')?.dataset.activeScreen === 'title', null, { timeout: 60_000 })
await page.evaluate(y => { window.__peekY = y }, Number(process.env.Y ?? 2))
await page.evaluate(async ([scene, x, z, yaw]) => {
  const g = window.__game
  g.ui.dialog = async () => {}
  g.save.update({ progress: { completed: ['junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi'], prologueSeen: true } })
  g.ui.show('hud')
  await g.voyage.enter(scene)
  g.voyage.debugTeleport(+x, +(window.__peekY ?? 2), +z)
  g.voyage.active.cam.yaw = +yaw
}, [scene, x, z, yaw])
await page.waitForTimeout(2500)
await page.screenshot({ path: out })
await browser.close()
console.log('saved', out)
