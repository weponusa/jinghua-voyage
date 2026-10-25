// Reuses the starter's smoke entry point for the actual chapter-one game.
// URL selects the running dev server; without URL this serves the production dist/.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const port = 4401
const url = process.env.URL ?? `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? `${root}../.work/sEdjkCC3/previews`
mkdirSync(out, { recursive: true })
const server = process.env.URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' })
let browser, current
const errors = []
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const wait = ms => new Promise(r => setTimeout(r, ms))
const guard = setTimeout(() => { console.error('smoke: timeout'); server?.kill(); process.exit(1) }, 420_000)
const get = page => page.evaluate(() => window.__game.voyage.debug())
async function open(context) {
  const page = await context.newPage(); current = page
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`) })
  page.on('requestfailed', r => { if (!r.failure()?.errorText.includes('ERR_ABORTED')) errors.push(`request failed: ${r.url()}`) })
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  assert(await page.evaluate(() => document.documentElement.lang === 'zh-CN'), 'game must stay in Simplified Chinese')
  assert(await page.title() === '镜花缘', 'browser title must be 镜花缘')
  assert(await page.locator('.logo-text').textContent() === '镜花缘', 'game title must be 镜花缘')
  return page
}
async function advance(page) {
  // Real keyboard presses advance the real dialogue/typewriter; choices are never bypassed.
  for (let i = 0; i < 120; i++) {
    if (await page.locator('.choice').count()) return 'choice'
    if (await page.locator('.seal.is-active').count()) return 'seal'
    const state = await get(page)
    if (state.mode === 'explore' && !(await page.locator('.dialog.is-active').count())) return 'explore'
    if (await page.locator('.dialog.is-active').count()) await page.keyboard.press('Space')
    await page.waitForTimeout(80)
  }
  throw new Error('dialogue did not resolve')
}
async function sail(page, junziCompleted = false) {
  await page.click('[data-action="pause-chart"]')
  await page.waitForSelector('.chart.is-active')
  assert(await page.locator('.chart-sea .port').count() === 10, 'sea chart must preserve ten chapter anchors')
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('.chart-sea .port.has-portrait img.island-portrait')]
    return images.length === 10 && images.every(image => image.complete && image.naturalWidth >= 300)
  }, undefined, { timeout: 60000 })
  assert(await page.evaluate(() => { const sea = document.querySelector('.chart-sea'); return sea.scrollWidth <= sea.clientWidth + 2 }), 'map must not require horizontal scrolling')
  assert(await page.locator('.chart-sea .port-visual').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 60)), 'island portraits must not collapse into horizontal strips')
  const view = page.viewportSize()
  const close = await page.locator('[data-action="chart-close"]').boundingBox()
  assert(close && close.x >= 0 && close.y >= 0 && close.x + close.width <= view.width && close.y + close.height <= view.height, 'chart close button must remain in viewport')
  await screenshot(page, `01a-sea-chart-${view.width}x${view.height}`)
  await page.locator('[data-port="penglai"]').scrollIntoViewIfNeeded()
  await page.click('[data-port="penglai"]')
  assert(await page.locator('[data-action="sail"]').isDisabled(), 'final chapter must be readable but not playable')
  await page.locator('[data-port="daren"]').scrollIntoViewIfNeeded()
  await page.click('[data-port="daren"]')
  assert(await page.locator('[data-action="sail"]').isDisabled() === !junziCompleted, 'second chapter unlock state must follow first-chapter completion')
  await page.locator('[data-port="junzi"]').scrollIntoViewIfNeeded()
  await page.click('[data-port="junzi"]')
  await page.click('[data-action="sail"]')
  await page.waitForFunction(() => window.__game.voyage.sceneId === 'junzi' && window.__game.voyage.mode !== 'loading')
  await advance(page)
}
async function walkTo(page, x, z, tolerance = 0.9) {
  for (let i = 0; i < 80; i++) {
    const p = (await get(page)).pos
    if (Math.hypot(p.x - x, p.z - z) < tolerance) { await page.keyboard.up('KeyW'); return }
    await page.evaluate(({ x, z }) => {
      const a = window.__game.voyage.active, p = a.player.position
      a.cam.yaw = Math.atan2(-(x - p.x), -(z - p.z))
    }, { x, z })
    await page.keyboard.down('KeyW'); await page.waitForTimeout(120)
  }
  await page.keyboard.up('KeyW')
  throw new Error(`main walking route blocked near ${JSON.stringify((await get(page)).pos)} on way to ${x},${z}`)
}
async function hookInteract(page, name) {
  await page.evaluate(name => { void window.__game.voyage.debugInteract(name) }, name)
  await page.waitForTimeout(100)
  await advance(page)
}
async function screenshot(page, name) { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${name}.png`, timeout: 15000, animations: 'disabled' }) }

async function rigPose(page) {
  return page.evaluate(() => {
    const a = window.__game.voyage.active
    const skins = []
    a.player.root.traverse(o => { if (o.isSkinnedMesh) skins.push(o) })
    const mesh = skins[0]
    if (!mesh) return { bones: [], vertices: [], count: 0 }
    a.player.root.updateMatrixWorld(true)
    mesh.skeleton.update()
    const p = mesh.geometry.getAttribute('position'), vertices = []
    for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 48))) {
      const v = a.player.root.position.clone().fromBufferAttribute(p, i)
      mesh.applyBoneTransform(i, v)
      vertices.push(v.x, v.y, v.z)
    }
    return { bones: mesh.skeleton.bones.flatMap(b => b.quaternion.toArray()), vertices, count: skins.length }
  })
}

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break } catch {} await wait(250) }
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  browser = await chromium.launch({ args }).catch(() => chromium.launch({ args, channel: 'chrome' }))
  if (process.env.ATLAS_ONLY) {
    for (const view of [{width:1280,height:800}, {width:844,height:390}, {width:390,height:844}]) {
      const touch = view.width < 1000
      const context = await browser.newContext({viewport:view,isMobile:touch,hasTouch:touch,deviceScaleFactor:touch ? 2 : 1})
      // Atlas-only layout checks start after the prologue; fresh saves intentionally play it first.
      await context.addInitScript(() => {
        localStorage.setItem('jinghua.save', JSON.stringify({ version: 2, progress: { prologueSeen: true, prologueAct: 3 } }))
      })
      const page = await open(context)
      await page.click('[data-action="chart-title"]')
      await page.waitForSelector('.chart.is-active')
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('.chart-sea .port.has-portrait img.island-portrait')]
        return images.length === 10 && images.every(image => image.complete && image.naturalWidth >= 300)
      }, undefined, {timeout:60000})
      assert(await page.locator('.chart-sea .port-visual').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 60)), 'island portrait height collapsed')
      assert(await page.evaluate(() => { const sea=document.querySelector('.chart-sea');return sea.scrollWidth<=sea.clientWidth+2 }), 'atlas has horizontal overflow')
      await screenshot(page, `atlas-final-${view.width}x${view.height}`)
      for (const id of ['junzi','daren','wuchang','heichi','baimin','shushi','liangmian','qishe','nver','penglai']) {
        await page.locator(`[data-port="${id}"]`).scrollIntoViewIfNeeded()
        if (touch) await page.tap(`[data-port="${id}"]`); else await page.click(`[data-port="${id}"]`)
        assert(await page.locator('[data-action="sail"]').isDisabled() === (id !== 'junzi'), `invalid sail state for ${id}`)
        assert(await page.evaluate(() => {
          const detail=document.querySelector('.chart-detail'), rect=detail.getBoundingClientRect()
          return [...detail.children].every(node => { if (!node.getClientRects().length) return true; const r=node.getBoundingClientRect();return r.left>=rect.left-1&&r.right<=rect.right+1 })
        }), 'detail content wrapped into columns outside its panel')
      }
      await screenshot(page, `atlas-final-detail-${view.width}x${view.height}`)
      const close=await page.locator('[data-action="chart-close"]').boundingBox()
      assert(close&&close.x>=0&&close.y>=0&&close.x+close.width<=view.width&&close.y+close.height<=view.height,'close is offscreen')
      await page.click('[data-action="chart-close"]')
      await page.waitForSelector('[data-screen="title"].is-active')
      await context.close()
    }
    assert(errors.length===0, `atlas browser errors:\n${errors.join('\n')}`)
    console.log('smoke: atlas OK — real portraits, ten selectable chapters, detail width, native close and desktop/mobile layouts')
  } else {
  if (!process.env.MOBILE_ONLY) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })
  const page = await open(context)
  await screenshot(page, '01-title')
  await page.click('[data-action="start"]'); await advance(page)
  await sail(page)
  await screenshot(page, '02-island')
  const idlePose = await rigPose(page)
  assert(idlePose.count >= 1 && idlePose.bones.length >= 16 * 4, 'player has no real skeleton/skinned mesh')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(() => /walk/.test(window.__game.voyage.debug().animation.state), undefined, { timeout: 10000 })
  await page.waitForTimeout(260)
  const movingPose = await rigPose(page)
  assert(movingPose.bones.some((v, i) => Math.abs(v - idlePose.bones[i]) > 0.025), 'walking did not animate independent bones')
  assert(movingPose.vertices.some((v, i) => Math.abs(v - idlePose.vertices[i]) > 0.004), 'walking did not deform skinned vertices')
  await screenshot(page, '02a-skeletal-walk')
  await page.keyboard.up('KeyW')
  await page.waitForFunction(() => /idle/i.test(window.__game.voyage.debug().animation.state), undefined, { timeout: 10000 })
  assert(/idle/i.test((await get(page)).animation.state), 'stopping must blend back to idle')
  await page.keyboard.press('KeyM'); await page.waitForSelector('.local-map.is-active')
  assert(await page.locator('.local-map .terrain-coast').count() === 1, 'actual coastline missing')
  assert(await page.locator('[data-map-landmark]').count() === 5, 'five landmarks missing')
  const beforeGuide = (await get(page)).pos
  await page.click('[data-map-landmark="courtesy"]'); await page.click('[data-action="local-guide"]')
  await page.waitForFunction(() => window.__game.voyage.mode === 'explore')
  const afterGuide = (await get(page)).pos
  assert(Math.hypot(afterGuide.x - beforeGuide.x, afterGuide.z - beforeGuide.z) < 0.2, 'map must not teleport the player')
  await page.keyboard.press('KeyM'); await screenshot(page, '03-local-map')
  await page.keyboard.press('Escape'); await page.waitForTimeout(200)
  assert((await get(page)).mode === 'explore', 'Escape closing map must not pause')
  // Walk the real road, through the open arch, using the real character controller.
  await walkTo(page, 0, 11)
  await walkTo(page, 0, 6)
  await walkTo(page, 0, 1)
  await walkTo(page, -2.0, -0.3)
  await page.waitForTimeout(350); await page.keyboard.press('KeyE')
  await page.waitForFunction(() => window.__game.voyage.mode === 'dialog', { timeout: 5000 })
  await advance(page)
  assert(await page.locator('.choice').count() === 4, 'market interaction did not reach puzzle')
  await screenshot(page, '04-haggle')
  await page.click('[data-choice="0"]'); await advance(page)
  assert(await page.locator('.choice').count() === 4, 'wrong answer should allow another try')
  await page.click('[data-choice="2"]')
  await page.evaluate(() => window.__game.voyage.debugTeleport(0, 1.2, 17))
  await advance(page)
  assert(await page.evaluate(() => window.__game.save.data.progress.junzi.haggleSolved), 'riddle checkpoint not saved')
  // Refresh before picking up the flower: continue must restore the solved state and collectible.
  await page.reload(); await page.waitForSelector('[data-screen="title"].is-active', { timeout: 60_000 })
  await page.click('[data-action="start"]'); await advance(page)
  assert((await get(page)).scene === 'junzi', 'continue should restore unfinished first chapter')
  const flower = await page.evaluate(() => window.__game.voyage.debugFlower())
  assert(flower, 'solved/uncollected flower not restored')
  await page.evaluate(f => window.__game.voyage.debugTeleport(f.x, f.y, f.z), flower)
  await page.waitForFunction(() => window.__game.voyage.debug().hasFlower)
  assert(await page.evaluate(() => window.__game.save.data.progress.junzi.flowerCollected), 'pickup not saved immediately')
  await screenshot(page, '05-flower')
  // Optional observations: interact with the real story scripts, without rewriting progress.
  for (const name of ['归舟渡路牌', '惟善为宝路牌', '让利集路牌', '老者', '听涛亭路牌']) await hookInteract(page, name)
  assert(await page.evaluate(() => window.__game.save.data.progress.junzi.visited.length) === 5, 'travel journal did not save all five observations')
  await page.keyboard.press('KeyM'); await screenshot(page, '06-journal'); await page.keyboard.press('KeyM')
  await hookInteract(page, '小舟')
  await page.waitForSelector('.seal.is-active')
  assert((await page.locator('.seal-next').textContent()).includes('大人国'), 'completion should unlock the second chapter')
  await screenshot(page, '07-chapter-complete')
  await page.click('[data-action="overlay-ok"]')
  // New sea events may begin as soon as the seal closes; advance them with real dialogue input.
  await advance(page)
  await page.waitForFunction(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore')
  assert((await page.evaluate(() => window.__game.save.data.progress.completed)).join(',') === 'junzi', 'chapter not completed exactly once')
  await sail(page, true)
  assert(!(await page.evaluate(() => window.__game.voyage.debugFlower())), 'replay should not create duplicate flowers')
  assert((await get(page)).hasFlower, 'completed replay must permit returning')
  // Settings retain a single detailed art pipeline; reopening must preserve the real rig.
  await page.keyboard.press('Escape'); await page.click('[data-screen="pause"] [data-action="settings"]')
  assert(await page.locator('[data-model-style]').count() === 0, 'removed character-style switch must stay absent')
  await page.keyboard.press('Escape'); await page.click('[data-action="resume"]')
  assert((await rigPose(page)).count >= 1, 'detailed model must retain a real skinned rig')
  await screenshot(page, '08-detailed')
  await context.close()
  console.log('smoke: desktop OK — real road, puzzle retry, save/reload, five observations, return, replay and detailed skeletal rig')
  }

  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const phone = await open(mobile)
  await phone.tap('[data-action="start"]'); await advance(phone); await sail(phone)
  await phone.touchscreen.tap(95, 245)
  await phone.waitForFunction(() => document.body.classList.contains('is-touch'))
  const miniBox = await phone.locator('.mini-map-button').boundingBox()
  const stickBox = await phone.locator('.touch-stick').boundingBox()
  assert(miniBox && stickBox && miniBox.x >= stickBox.x + stickBox.width, 'mobile minimap overlaps joystick')
  await phone.tap('[data-touch="jump"]')
  await phone.tap('[data-action="local-map"]'); await phone.waitForSelector('.local-map.is-active')
  const close = await phone.locator('[data-action="local-close"]').boundingBox()
  assert(close && close.y >= 0 && close.y + close.height <= 390, 'mobile close button offscreen')
  await phone.tap('[data-map-landmark="pavilion"]'); await screenshot(phone, '09-mobile-map')
  await phone.tap('[data-action="local-close"]')
  // Existing gameplay hooks exercise the full mobile renderer path while actual touch controls remain enabled.
  await phone.evaluate(() => { window.__game.ui.dialog = async () => {}; window.__game.ui.choose = async () => 2; window.__game.ui.seal = async () => {} })
  assert(await phone.evaluate(() => window.__game.voyage.debugInteract('买卖二人')), 'mobile puzzle unreachable')
  const mf = await phone.evaluate(() => window.__game.voyage.debugFlower())
  await phone.evaluate(f => window.__game.voyage.debugTeleport(f.x, f.y, f.z), mf)
  await phone.waitForFunction(() => window.__game.voyage.debug().hasFlower)
  await phone.evaluate(() => window.__game.voyage.debugInteract('小舟'))
  await phone.waitForFunction(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore')
  await phone.setViewportSize({ width: 390, height: 844 })
  await phone.tap('[data-action="pause-chart"]'); await phone.waitForSelector('.chart.is-active')
  assert(await phone.evaluate(() => { const sea = document.querySelector('.chart-sea'); return sea.scrollWidth <= sea.clientWidth + 2 }), 'portrait chart must fit horizontally')
  await phone.locator('[data-port="penglai"]').scrollIntoViewIfNeeded()
  await phone.tap('[data-port="penglai"]')
  assert(await phone.locator('[data-action="sail"]').isDisabled(), 'portrait final chapter must stay in production')
  await screenshot(phone, '11-mobile-portrait-chart')
  await phone.locator('[data-port="junzi"]').scrollIntoViewIfNeeded()
  await phone.tap('[data-port="junzi"]')
  await phone.tap('[data-action="chart-close"]')
  await phone.tap('[data-action="local-map"]'); await phone.waitForSelector('.local-map.is-active')
  await screenshot(phone, '10-mobile-portrait')
  await phone.tap('[data-action="local-close"]')
  assert(await phone.evaluate(() => window.__game.save.data.progress.completed.length === 1), 'mobile chapter loop failed')
  await mobile.close()
  assert(errors.length === 0, `browser errors:\n${errors.join('\n')}`)
  console.log('smoke: OK — road, puzzle retries, save/reload, five landmarks, pickup, return, replay, detailed rig and mobile map verified')
  }
} catch (error) {
  if (current && !current.isClosed()) {
    console.error('state:', await get(current).catch(() => null))
    console.error('motion:', await current.evaluate(() => { const g = window.__game, p = g.voyage.active.player; return { keys: [...g.input.keys], move: g.input.move, frozen: p.frozen, velocity: p.velocity, animationTime: p.animation?.mixer.time } }).catch(() => null))
    await screenshot(current, 'failure').catch(() => {})
  }
  console.error('browser errors:', errors.join('\n'))
  console.error('smoke: FAIL', error?.stack ?? String(error)); process.exitCode = 1
} finally {
  clearTimeout(guard); await browser?.close().catch(() => {}); server?.kill('SIGTERM')
}
