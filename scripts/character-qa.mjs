// Close-range art verification: every named role must use its real GLB in the live scene.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.env.URL ?? 'http://127.0.0.1:3003/'
const out = process.env.SHOTS_DIR ?? 'shots/character-in-game'
mkdirSync(out, { recursive: true })
const scenarios = [
  ['daren', ['老婆婆', '孩童']],
  ['liangmian', ['王员外', '赵掌柜', '钱秀才', '孙郎中']],
  ['wuchang', ['富翁', '小厮阿福', '厨娘', '老仆']],
  ['baimin', ['塾师', '学童']],
  ['heichi', ['黎红薇', '卢紫萱', '多九公']],
].filter(([scene]) => !process.env.SCENE || scene === process.env.SCENE)
  .map(([scene, names]) => [scene, names.filter(name => !process.env.NAME || name === process.env.NAME)])
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
await page.goto(url)
await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
await page.evaluate(() => {
  window.__game.ui.dialog = async () => {}
  const p = window.__game.save.data.progress
  window.__game.save.update({ progress: { ...p, completed: ['junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai'] } })
})
for (const [scene, names] of scenarios) {
  await page.evaluate(id => window.__game.voyage.enter(id), scene)
  await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', scene, { timeout: 30_000 })
  await page.evaluate(() => window.__game.ui.show('hud'))
  await page.waitForFunction(() => {
    const title = document.querySelector('[data-screen="title"]')
    return title && !title.classList.contains('is-active') && Number(getComputedStyle(title).opacity) < 0.05
  }, null, { timeout: 15_000 })
  for (const name of names) {
    const state = await page.evaluate(({ name, scene }) => {
      const a = window.__game.voyage.active
      const npc = a.npcs.find(n => n.name === name)
      if (!npc) return { error: 'missing npc' }
      let shared = false
      let tinted = false
      npc.body.traverse(o => {
        if (o.userData.sharedModel && o.isMesh) shared = true
        if (o.userData.ownedMaterial) tinted = true
      })
      if (!shared) return { error: 'procedural fallback active' }
      if (npc.spec.model === 'liangmian' && !tinted) return { error: 'named robe materials were not tinted' }
      npc.yaw = npc.baseYaw = Math.PI
      npc.body.rotation.y = Math.PI
      window.__game.voyage.debugTeleport(npc.position.x, npc.position.y + 1.1, npc.position.z + 2.7)
      a.cam.yaw = 0
      a.cam.update = () => {}
      a.player.root.visible = false
      const target = npc.position.clone()
      target.y += npc.top - npc.root.position.y - 0.72
      let cameraX = npc.position.x
      let cameraZ = npc.position.z + 3.0
      if (scene === 'heichi') cameraZ = npc.position.z + 1.7
      if (name === '塾师') { cameraX += 1.25; cameraZ = npc.position.z + 1.55 }
      a.cam.camera.position.set(cameraX, target.y + 0.28, cameraZ)
      a.cam.camera.lookAt(target)
      a.stage.scene.updateMatrixWorld(true)
      return { ok: true }
    }, { name, scene })
    if (state.error) {
      errors.push(`${scene}/${name}: ${state.error}`)
      continue
    }
    await page.waitForTimeout(650)
    await page.screenshot({ path: `${out}/${scene}-${name}.png` })
  }
  if (scene === 'liangmian') {
    for (const name of ['赵掌柜', '王员外']) {
      await page.evaluate(name => {
        const a = window.__game.voyage.active
        const npc = a.npcs.find(n => n.name === name)
        npc.yaw = npc.baseYaw = 0
        npc.body.rotation.y = 0
        window.__game.voyage.debugTeleport(npc.position.x, npc.position.y + 1.1, npc.position.z + 2.5)
        a.cam.yaw = 0
        a.cam.update = () => {}
        a.player.root.visible = false
        const target = npc.position.clone()
        target.y += npc.top - npc.root.position.y - 0.38
        a.cam.camera.position.set(npc.position.x + 0.1, target.y + 0.08, npc.position.z + 2.15)
        a.cam.camera.lookAt(target)
      }, name)
      await page.waitForTimeout(1500)
      const rear = await page.evaluate(name => {
        const npc = window.__game.voyage.active.npcs.find(n => n.name === name)
        const flap = npc.body.getObjectByName('Hinged浩然巾 back flap')
        const face = npc.body.getObjectByName('Hidden rear face')
        return { lifted: flap?.rotation.x < -1.4, faceVisible: face?.visible === true }
      }, name)
      if (!rear.lifted || !rear.faceVisible) errors.push(`${scene}/${name}: rear headcloth did not open correctly`)
      await page.screenshot({ path: `${out}/${scene}-${name}-背面.png` })
    }
  }
}
await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`character-qa: OK (${scenarios.reduce((n, [, names]) => n + names.length, 0)} named roles use real GLBs; close-range screenshots saved)`)
