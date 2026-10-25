// Full-voyage playtest against a running server (default: dev server on :3000).
// Plays every chapter's solution through the real interactables, collects the six mirror flowers,
// records the three story chapters, sails back, and finishes at 小蓬莱. Screenshots go to ./shots/.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.env.URL ?? 'http://127.0.0.1:3000/'
const out = process.env.SHOTS_DIR ?? 'shots'
const mobile = process.env.MOBILE === '1'
const testAll = new URL(url).searchParams.get('test') === '1'
mkdirSync(out, { recursive: true })

// [interactable name, scripted choice answers]
const SOLUTIONS = {
  junzi: [['买卖二人', [0, 2]]],
  daren: [['老婆婆', [0]], ['孩童', [0]], ['钱袋', [0]], ['卖油郎', []], ['大人国长者', []]],
  wuchang: [['富翁', []], ['热饭', []], ['小厮阿福', []], ['热饭', []], ['厨娘', []], ['热饭', []], ['老仆', []], ['富翁', [1, 0]]],
  heichi: [['二位才女', []], ['灯谜一', [0]], ['灯谜二', [1]], ['灯谜三', [0]], ['二位才女', []]],
  baimin: [['塾师', []], ['书页', []], ['书页', []], ['书页', []], ['塾师', [0, 1, 1]]],
  shushi: [['酒保', []], ['腐儒', [0]], ['徐承志', []], ['巡关告示', []], ['旧关牒', []], ['北侧墙', []], ['淑士关侧门', []]],
  liangmian: [['守门老者', [1, 1]]],
  qishe: [['多九公', []], ['青蒿', []], ['金银花', []], ['药方', []], ['多九公', []], ['音韵台·听音', [1]], ['音韵台·辨调', [3]], ['音韵台·排字', [0]], ['花灯·画谜', [0]], ['花灯·果谜', [1]], ['花灯·哑谜', [1]], ['多九公', []]],
  nver: [['林之洋', []], ['织机与竹管', []], ['防水绸货账', [1]], ['女官文绮', []], ['西窗竹管', []], ['治河黄榜', []], ['源水闸', []], ['分水闸', []], ['归漕闸', []], ['河工竹管', []], ['女官文绮', [1]], ['西水门', []]],
  penglai: [['镜台', [1]]],
}
const STORY_CHAPTERS = new Set(['shushi', 'qishe', 'nver'])
const FLOWER_CHAPTERS = ['junzi', 'daren', 'wuchang', 'heichi', 'baimin', 'liangmian']

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mobile
  ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 760 } })
const page = await context.newPage()
const flowerTotal = () => page.evaluate(ids => {
  const p = window.__game.save.data.progress
  return ids.filter(id => p.completed.includes(id) || (id === 'junzi' ? p.junzi.flowerCollected : p.chapters[id]?.flowerCollected)).length
}, FLOWER_CHAPTERS)
const errors = []
page.on('console', m => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', e => errors.push(String(e)))
async function waitFor(fn, arg, opts) {
  try { return await page.waitForFunction(fn, arg, opts) } catch (e) {
    console.error('playtest: FAIL', e.message)
    console.error('errors:', errors.join('\n'))
    console.error('state:', JSON.stringify(await page.evaluate(() => window.__game.voyage.debug()).catch(() => null)))
    await page.screenshot({ path: `${out}/fail.png` })
    process.exit(1)
  }
}
process.on('unhandledRejection', async e => {
  console.error('playtest: FAIL', e.message)
  console.error('errors:', errors.join('\n'))
  try { console.error('state:', JSON.stringify(await page.evaluate(() => ({ dbg: window.__game.voyage.debug(), scene: window.__game.voyage.sceneId })))) } catch {}
  process.exit(1)
})
const t0 = Date.now()
await page.goto(url)
await waitFor(() => document.getElementById('ui')?.dataset.activeScreen === 'title', null, { timeout: 60_000 })
console.log(`title ready in ${Date.now() - t0} ms`)
await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}00-title.png` })

// Start with the same input method as the player; the prologue plays on the deck.
if (mobile) await page.locator('[data-action="start"]').tap()
else await page.click('[data-action="start"]')
await page.waitForTimeout(1800)
await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}01-prologue.png` })
const advance = async () => {
  if (mobile) await page.locator('.dialog').tap({ position: { x: 80, y: 40 } })
  else await page.keyboard.press('Space')
}
// Advance a few dialogue lines with real key presses / touches.
for (let i = 0; i < 3; i += 1) { await advance(); await page.waitForTimeout(250); await advance(); await page.waitForTimeout(150) }

// From here on, dialogue auto-advances and choices follow the scripted answers.
await page.evaluate(() => {
  const g = window.__game
  g.answers = []
  g.ui.dialog = async () => {}
  g.ui.choose = async () => g.answers.shift() ?? 0
})
for (let i = 0; i < 40; i += 1) {
  if (await page.evaluate(() => window.__game.voyage.mode === 'explore')) break
  await advance()
  await page.waitForTimeout(120)
}
await waitFor(() => window.__game.voyage.mode === 'explore', null, { timeout: 5_000 })

// Walk a little with the keyboard to verify movement.
const before = await page.evaluate(() => window.__game.voyage.debug().pos)
const fps0 = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => (++n, performance.now() - t < 1000 ? requestAnimationFrame(f) : r(n)); requestAnimationFrame(f) }))
console.log(`headless fps ≈ ${fps0}`)
if (mobile) {
  // A real touch drag on the left side of the canvas drives the floating joystick.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 260, id: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 190, id: 1 }] })
  await page.waitForTimeout(2200)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
} else {
  await page.keyboard.down('KeyS'); await page.waitForTimeout(2500); await page.keyboard.up('KeyS')
}
const after = await page.evaluate(() => window.__game.voyage.debug().pos)
const moved = Math.hypot(after.x - before.x, after.z - before.z)
console.log(`walked ${moved.toFixed(2)} m (${mobile ? 'touch joystick' : 'keyboard'})`)
if (moved < 0.5) errors.push(`player did not move with ${mobile ? 'touch joystick' : 'S'}`)
if (mobile && !(await page.evaluate(() => window.__game.input.method === 'touch' && document.body.classList.contains('is-touch')))) errors.push('touch controls did not activate')

let n = 2
const PLAYABLE = (process.env.CHAPTERS ?? 'junzi,daren,wuchang,heichi,baimin,shushi,liangmian,qishe,nver,penglai').split(',')
for (const [id, steps] of Object.entries(SOLUTIONS).filter(([id]) => PLAYABLE.includes(id))) {
  await page.evaluate(id => window.__game.voyage.enter(id), id)
  await waitFor(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 30_000 })
  const story = STORY_CHAPTERS.has(id)
  const flowersBefore = story ? await flowerTotal() : 0
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-${id}.png` })
  if (id === 'liangmian') {
    // Walk-round-the-back rule: stand on each NPC's local +Z side until the scarf lifts.
    const folk = [[-4.2, -1.5, -Math.PI * 0.35], [-1.4, -4.6, -Math.PI * 0.1], [2.2, -4.2, Math.PI * 0.15], [4.6, -0.8, Math.PI * 0.4]]
    for (const [x, z, yaw] of folk) {
      await page.evaluate(([x, z, yaw]) => window.__game.voyage.debugTeleport(x + Math.sin(yaw) * 2, 1.2, z + Math.cos(yaw) * 2), [x, z, yaw])
      await page.waitForTimeout(900)
    }
    const quest = await page.locator('.quest-text').textContent()
    if (!quest?.includes('4/4') && !quest?.includes('去村口')) errors.push(`liangmian: back-face observation did not complete (${quest})`)
  }
  if (id === 'penglai' && !mobile) {
    // The finale must be climbable with real movement, not only reachable by debug teleport.
    await page.evaluate(() => { window.__game.voyage.debugTeleport(17, 1.2, 0); window.__game.voyage.active.cam.yaw = Math.PI / 2 })
    await page.keyboard.down('KeyW')
    await waitFor(() => window.__game.voyage.debug().pos.y >= 2.8, null, { timeout: 12_000 })
    await page.keyboard.up('KeyW')
    const lower = await page.evaluate(() => window.__game.voyage.debug().pos)
    if (lower.y < 2.8) errors.push(`penglai: lower stair climb failed (y=${lower.y})`)
    await page.evaluate(() => { window.__game.voyage.debugTeleport(-11, 3.4, 0); window.__game.voyage.active.cam.yaw = -Math.PI / 2 })
    await page.keyboard.down('KeyW')
    await waitFor(() => window.__game.voyage.debug().pos.y >= 5.1, null, { timeout: 12_000 })
    await page.keyboard.up('KeyW')
    const upper = await page.evaluate(() => window.__game.voyage.debug().pos)
    if (upper.y < 5.1) errors.push(`penglai: upper stair climb failed (y=${upper.y})`)
  }
  // Test mode deliberately owns every flower, so Junzi's optional bargaining puzzle is disabled.
  const chapterSteps = testAll && id === 'junzi' ? [] : steps
  for (const [name, answers] of chapterSteps) {
    if (id === 'penglai') {
      const ok = await page.evaluate(([name, answers]) => {
        const g = window.__game
        g.answers = [...answers]
        window.__endingRun = g.voyage.debugInteract(name)
        return true
      }, [name, answers])
      if (!ok) errors.push(`${id}: could not interact with ${name}`)
      await waitFor(() => document.querySelector('.ending')?.classList.contains('is-active'), null, { timeout: 10_000 })
      await waitFor(() => Number(getComputedStyle(document.querySelector('.ending')).opacity) > 0.99, null, { timeout: 30_000 })
      const endingLayout = await page.evaluate(() => {
        const scroll = document.querySelector('.ending-scroll')
        const button = scroll.querySelector('[data-action="overlay-ok"]').getBoundingClientRect()
        const mini = document.querySelector('.mini-map-button')
        const miniRect = mini.getBoundingClientRect()
        const overMini = mini.getClientRects().length ? document.elementFromPoint(miniRect.x + miniRect.width / 2, miniRect.y + miniRect.height / 2) : null
        return {
          entries: scroll.querySelectorAll('.ending-list li').length,
          epilogue: scroll.querySelector('.ending-epilogue')?.textContent ?? '',
          fits: scroll.scrollHeight <= scroll.clientHeight + 2,
          buttonVisible: button.top >= 0 && button.bottom <= innerHeight,
          hudCovered: !overMini || !!overMini.closest('.ending'),
        }
      })
      if (endingLayout.entries !== 6 || !endingLayout.epilogue.includes('唐小山') || !endingLayout.fits || !endingLayout.buttonVisible || !endingLayout.hudCovered) errors.push(`ending layout invalid: ${JSON.stringify(endingLayout)}`)
      await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-ending.png` })
      if (mobile) await page.locator('.ending.is-active [data-action="overlay-ok"]').tap()
      else await page.click('.ending.is-active [data-action="overlay-ok"]')
      await page.evaluate(() => window.__endingRun)
    } else {
      const ok = await page.evaluate(async ([name, answers]) => {
        const g = window.__game
        g.answers = [...answers]
        return g.voyage.debugInteract(name)
      }, [name, answers])
      if (!ok) errors.push(`${id}: could not interact with ${name}`)
    }
    await page.waitForTimeout(120)
  }
  if (id === 'penglai') {
    await waitFor(() => window.__game.voyage.sceneId === 'hub', null, { timeout: 60_000 })
    break
  }
  if (story) {
    const state = await page.evaluate(id => ({
      hasFlower: window.__game.voyage.debug().hasFlower,
      solved: window.__game.save.data.progress.chapters[id]?.solved === true,
      flowerCollected: window.__game.save.data.progress.chapters[id]?.flowerCollected === true,
    }), id)
    if (state.hasFlower !== false || state.flowerCollected) errors.push(`${id}: story chapter must not own a mirror flower`)
    if (!state.solved) errors.push(`${id}: story checkpoint not solved`)
    if (await flowerTotal() !== flowersBefore) errors.push(`${id}: story puzzle changed the flower total`)
    await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-${id}-done.png` })
  } else {
    const flower = await page.evaluate(() => window.__game.voyage.debugFlower())
    const already = await page.evaluate(() => window.__game.voyage.debug().hasFlower)
    if (!flower && !already) { errors.push(`${id}: no mirror flower appeared`); break }
    if (flower) await page.evaluate(f => window.__game.voyage.debugTeleport(f.x, f.y, f.z), flower)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-${id}-done.png` })
    const has = await page.evaluate(() => window.__game.voyage.debug().hasFlower)
    if (!has) errors.push(`${id}: flower not collected`)
  }
  await page.evaluate(() => { window.__sealRun = window.__game.voyage.debugInteract('小舟'); return true })
  await waitFor(() => document.querySelector('.seal')?.classList.contains('is-active'), null, { timeout: 10_000 })
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-${id}-seal.png` })
  if (mobile) await page.locator('.seal.is-active [data-action="overlay-ok"]').tap()
  else await page.click('.seal.is-active [data-action="overlay-ok"]')
  await page.evaluate(() => window.__sealRun)
  await waitFor(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore', null, { timeout: 30_000 })
  if (story && await flowerTotal() !== flowersBefore) errors.push(`${id}: story completion changed the flower total`)
}
const progress = await page.evaluate(() => window.__game.save.data.progress.completed)
console.log('completed:', progress.join(','))
if (progress.length !== PLAYABLE.length) errors.push(`expected ${PLAYABLE.length} completed chapters, got ${progress.length}`)

// Chart overlay with everything done. The finale may still be fading back into the hub.
await waitFor(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore', null, { timeout: 30_000 })
await page.evaluate(() => { void window.__game.voyage.openChart() })
await waitFor(() => document.querySelector('.chart')?.classList.contains('is-active'), null, { timeout: 5_000 })
await waitFor(() => Number(getComputedStyle(document.querySelector('.chart')).opacity) > 0.99, null, { timeout: 30_000 })
await page.waitForFunction(() => {
  const images = [...document.querySelectorAll('.chart-sea .port.has-portrait img.island-portrait')]
  return images.length === 10 && images.every(image => image.complete && image.naturalWidth >= 300)
}, null, { timeout: 60_000 })
await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-chart.png` })
await page.keyboard.press('Escape')

await browser.close()
if (errors.length) {
  console.error('playtest: FAIL\n' + errors.join('\n'))
  process.exit(1)
}
console.log('playtest: OK')
