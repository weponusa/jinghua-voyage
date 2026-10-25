import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = process.env.SHOTS_DIR ?? `${root}shots/commercial-2026-10-25/world`
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const errors = []
const report = []
page.on('pageerror', error => errors.push(String(error)))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
const assert = (value, message) => { if (!value) throw new Error(message) }
const safe = value => value.replace(/[^\p{L}\p{N}_-]/gu, '_')

try {
  await page.goto(process.env.URL ?? 'http://127.0.0.1:3003/?test=1')
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  for (const id of ['junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai']) {
    await page.evaluate(id => window.__game.voyage.enter(id, false), id)
    await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 60_000 })
    await page.evaluate(() => window.__game.ui.show('hud'))
    await page.keyboard.press('KeyM')
    await page.waitForSelector('.local-map.is-active')
    await page.waitForFunction(() => {
      const image = document.querySelector('.local-map .terrain-artwork')
      return image?.href?.baseVal.includes('/interface/map-')
    })
    await page.waitForTimeout(500)
    assert(await page.locator('.local-map .terrain-artwork').count() === 1, `${id}: painted local map missing`)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id}: local map horizontal overflow`)
    await page.screenshot({ path: `${out}/map-${id}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => window.__game.voyage.mode === 'explore')

    const npcCount = await page.evaluate(() => window.__game.voyage.active.npcs.length)
    const chapter = { id, npcs: [] }
    for (let index = 0; index < Math.min(npcCount, 2); index += 1) {
      const before = await page.evaluate(index => {
        const a = window.__game.voyage.active
        const npc = a.npcs[index]
        npc.body.updateMatrixWorld(true)
        const skinned = []
        let bounds = null
        npc.body.traverse(object => {
          if (!object.isSkinnedMesh) return
          skinned.push(object)
          object.computeBoundingBox()
          const box = object.boundingBox.clone().applyMatrix4(object.matrixWorld)
          bounds = bounds ? bounds.union(box) : box
        })
        const sample = skinned[0]
        const vertex = () => {
          if (!sample) return null
          sample.skeleton.update()
          const value = npc.position.clone().fromBufferAttribute(sample.geometry.getAttribute('position'), 0)
          sample.applyBoneTransform(0, value)
          return value.toArray()
        }
        return {
          name: npc.name,
          info: { ...npc.animationInfo },
          vertex: vertex(),
          position: npc.position.toArray(),
          bounds: bounds ? { center: bounds.getCenter(npc.position.clone()).toArray(), size: bounds.getSize(npc.position.clone()).toArray() } : null,
        }
      }, index)
      assert(before.info.bones === 16 && before.info.skinnedMeshes > 0, `${id}/${before.name}: runtime rig missing`)
      assert(before.bounds && Math.hypot(before.bounds.center[0] - before.position[0], before.bounds.center[2] - before.position[2]) < 0.9, `${id}/${before.name}: skin is offset from interaction root (${JSON.stringify(before.bounds)})`)
      assert(before.bounds.size[1] > 0.5 && before.bounds.size[1] < 3.5, `${id}/${before.name}: invalid skin height (${before.bounds.size[1]})`)
      const after = await page.evaluate(index => {
        const a = window.__game.voyage.active
        const npc = a.npcs[index]
        npc.talking = true
        for (let frame = 0; frame < 6; frame += 1) npc.update(0.05, a.player.position)
        const sample = []
        npc.body.traverse(object => { if (object.isSkinnedMesh) sample.push(object) })
        const mesh = sample[0]
        mesh.skeleton.update()
        const value = npc.position.clone().fromBufferAttribute(mesh.geometry.getAttribute('position'), 0)
        mesh.applyBoneTransform(0, value)
        return { info: { ...npc.animationInfo }, vertex: value.toArray() }
      }, index)
      assert(after.info.state === 'talk', `${id}/${before.name}: talk state missing`)
      assert(before.vertex && before.vertex.some((value, i) => Math.abs(value - after.vertex[i]) > 0.00001), `${id}/${before.name}: vertices do not deform`)
      await page.evaluate(index => {
        const a = window.__game.voyage.active
        const npc = a.npcs[index]
        // The fairy is intentionally hidden until the six flowers are placed; reveal only for this isolated visual check.
        if (id === 'penglai' && index === 0) npc.root.visible = true
        npc.talking = true
        npc.update = () => {}
        const target = npc.position.clone()
        target.y += 1.05
        const direction = a.player.position.clone().sub(npc.position)
        direction.y = 0
        if (direction.lengthSq() < 0.01) direction.set(0, 0, 1)
        direction.normalize()
        a.cam.update = () => {}
        a.cam.camera.position.copy(npc.position).addScaledVector(direction, 2.65)
        a.cam.camera.position.y += 1.45
        a.cam.camera.lookAt(target)
        a.cam.camera.updateMatrixWorld(true)
        window.__game.voyage.renderer.render(a.stage.scene, a.cam.camera)
      }, index)
      await page.waitForTimeout(120)
      await page.screenshot({ path: `${out}/npc-${id}-${index}-${safe(before.name)}.png`, animations: 'disabled' })
      chapter.npcs.push({ name: before.name, rig: before.info, deformed: true })
    }
    report.push(chapter)
    console.log(`${id}: painted map + ${chapter.npcs.length} NPC close-ups OK`)
  }
  assert(errors.length === 0, `browser errors:\n${errors.join('\n')}`)
  writeFileSync(`${out}/report.json`, JSON.stringify({ ok: true, report, errors }, null, 2))
  console.log('commercial visual QA: OK')
} catch (error) {
  writeFileSync(`${out}/report.json`, JSON.stringify({ ok: false, error: String(error), report, errors }, null, 2))
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {})
  throw error
} finally {
  await browser.close()
}
