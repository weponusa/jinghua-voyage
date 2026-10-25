import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const out = fileURLToPath(new URL('../shots/regional-world-2026-10-25/', import.meta.url))
mkdirSync(out, { recursive: true })
const chapters = {
  junzi: { form: 'garden', tree: 'chinese_pine', wide: [[18, 12, 22], [0, 1, -2]], close: [[10, 7, 10], [0, 1.5, -4]] },
  daren: { form: 'cloud', tree: 'sky_palm', wide: [[18, 13, 20], [0, 2, -4]], close: [[9, 8, 4], [0, 3, -6]] },
  liangmian: { form: 'stern', tree: 'stern_cypress', wide: [[13, 10, 19], [0, 1, -2]], close: [[7, 5.5, 16], [0, 2, 9.5]], gate: true },
  wuchang: { form: 'scrub', tree: 'amber_tree', wide: [[14, 10, 17], [-1, 1, -3]], close: [[9, 6.5, 2], [0, 2.4, -7]], crown: 'ingot' },
  baimin: { form: 'academy', tree: 'scholar_oak', wide: [[15, 10, 17], [0, 1, -4]], close: [[10, 6.5, 2], [0, 2.3, -6.6]], crown: 'book' },
  heichi: { form: 'wetland', tree: 'willow', wide: [[16, 11, 18], [0, 1, -3]], close: [[10, 8, 0], [0, 3, -8]], crown: 'scroll' },
  penglai: { form: 'fairy', tree: 'fairy_tree', wide: [[20, 13, 20], [0, 3, 0]], close: [[8, 9, 9], [0, 5.8, 0]], crown: 'lotus' },
}
const only = process.env.ONLY?.split(',') ?? Object.keys(chapters)
const report = []
for (const id of only) {
  const cfg = chapters[id]
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  try {
    await page.goto(process.env.URL ?? 'http://127.0.0.1:3003/?test=1')
    await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
    await page.evaluate(id => window.__game.voyage.enter(id, false), id)
    await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 60_000 })
    await page.evaluate(() => window.__game.ui.show('hud'))
    const assets = await page.evaluate(({ form, tree, crown, gate }) => {
      const scene = window.__game.voyage.active.stage.scene
      let treeCount = 0
      let lowKitTrees = 0
      let crownCount = 0
      let gateCount = 0
      let grassCount = 0
      scene.traverse(o => {
        if (o.name === `props/${tree}.glb`) treeCount++
        if (/^nature\/tree_/.test(o.name)) lowKitTrees++
        if (o.name === `meadow-grass-${form}`) grassCount++
        if (crown && o.name === `Regional ${crown} roof crown`) crownCount++
        if (gate && o.name === 'Liangmian split-stone gate') gateCount++
      })
      return { treeCount, lowKitTrees, crownCount, gateCount, grassCount }
    }, cfg)
    assert(assets.treeCount > 0, `${id}: regional tree missing (${cfg.tree})`)
    assert.equal(assets.lowKitTrees, 0, `${id}: low-detail kit tree leaked into scene`)
    assert.equal(assets.grassCount, 1, `${id}: regional meadow form missing`)
    if (cfg.crown) assert.equal(assets.crownCount, 1, `${id}: regional roof crown missing`)
    if (cfg.gate) assert.equal(assets.gateCount, 1, `${id}: custom gate missing`)
    for (const [view, camera, target] of [['wide', ...cfg.wide], ['landmark', ...cfg.close]]) {
      await page.evaluate(({ camera, target }) => {
        const a = window.__game.voyage.active
        a.cam.update = () => {}
        a.cam.camera.position.set(...camera)
        a.cam.camera.lookAt(...target)
        a.cam.camera.updateMatrixWorld(true)
        window.__game.voyage.renderer.render(a.stage.scene, a.cam.camera)
      }, { camera, target })
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${out}/${id}-${view}.png`, animations: 'disabled' })
    }
    assert.equal(errors.length, 0, `${id}: browser errors: ${errors.join('\n')}`)
    report.push({ id, ...assets, errors })
    console.log(`${id}: ${cfg.form} + ${cfg.tree} + architecture OK`)
  } finally {
    await browser.close()
  }
}
writeFileSync(`${out}/report.json`, JSON.stringify({ ok: true, report }, null, 2))
console.log('regional-visual-qa: OK')
