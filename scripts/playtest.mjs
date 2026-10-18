// Full-voyage playtest against a running server (default: dev server on :3000).
// Plays every chapter's solution through the real interactables, collects each mirror flower,
// sails back, and finishes at 小蓬莱. Fails on console errors. Screenshots go to ./shots/.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.env.URL ?? 'http://127.0.0.1:3000/'
const out = process.env.SHOTS_DIR ?? 'shots'
const mobile = process.env.MOBILE === '1'
mkdirSync(out, { recursive: true })

// [interactable name, scripted choice answers]
const SOLUTIONS = {
  junzi: [['买卖二人', [0, 2]]],
  daren: [['老婆婆', [0]], ['孩童', [0]], ['钱袋', [0]], ['卖油郎', []], ['大人国长者', []]],
  liangmian: [['守门老者', [1, 1]]],
  wuchang: [['富翁', []], ['热饭', []], ['小厮阿福', []], ['热饭', []], ['厨娘', []], ['热饭', []], ['老仆', []], ['富翁', [1, 0]]],
  baimin: [['塾师', []], ['书页', []], ['书页', []], ['书页', []], ['塾师', [0, 1, 1]]],
  heichi: [['二位才女', []], ['灯谜一', [0]], ['灯谜二', [1]], ['灯谜三', [0]], ['二位才女', []]],
  penglai: [['镜台', [1]]],
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mobile
  ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 760 } })
const page = await context.newPage()
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

// Start: real click; the prologue plays on the deck.
await page.click('[data-action="start"]')
await page.waitForTimeout(1800)
await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}01-prologue.png` })
// Advance a few dialogue lines with real key presses.
for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Space'); await page.waitForTimeout(250); await page.keyboard.press('Space'); await page.waitForTimeout(150) }

// From here on, dialogue auto-advances and choices follow the scripted answers.
await page.evaluate(() => {
  const g = window.__game
  g.answers = []
  g.ui.dialog = async () => {}
  g.ui.choose = async () => g.answers.shift() ?? 0
  g.ui.seal = async () => {}
  g.ui.ending = async () => {}
})
for (let i = 0; i < 40; i += 1) {
  if (await page.evaluate(() => window.__game.voyage.mode === 'explore')) break
  await page.keyboard.press('Space')
  await page.waitForTimeout(120)
}
await waitFor(() => window.__game.voyage.mode === 'explore', null, { timeout: 5_000 })

// Walk a little with the keyboard to verify movement.
const before = await page.evaluate(() => window.__game.voyage.debug().pos)
const fps0 = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => (++n, performance.now() - t < 1000 ? requestAnimationFrame(f) : r(n)); requestAnimationFrame(f) }))
console.log(`headless fps ≈ ${fps0}`)
await page.keyboard.down('KeyS'); await page.waitForTimeout(2500); await page.keyboard.up('KeyS')
const after = await page.evaluate(() => window.__game.voyage.debug().pos)
const moved = Math.hypot(after.x - before.x, after.z - before.z)
console.log(`walked ${moved.toFixed(2)} m`)
if (moved < 0.5) errors.push('player did not move with S')

let n = 2
const PLAYABLE = (process.env.CHAPTERS ?? 'junzi').split(',')
for (const [id, steps] of Object.entries(SOLUTIONS).filter(([id]) => PLAYABLE.includes(id))) {
  await page.evaluate(id => window.__game.voyage.enter(id), id)
  await waitFor(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 30_000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-${id}.png` })
  for (const [name, answers] of steps) {
    const ok = await page.evaluate(async ([name, answers]) => {
      const g = window.__game
      g.answers = [...answers]
      return g.voyage.debugInteract(name)
    }, [name, answers])
    if (!ok) errors.push(`${id}: could not interact with ${name}`)
    await page.waitForTimeout(120)
  }
  if (id === 'penglai') {
    await waitFor(() => window.__game.voyage.sceneId === 'hub', null, { timeout: 30_000 })
    break
  }
  const flower = await page.evaluate(() => window.__game.voyage.debugFlower())
  const already = await page.evaluate(() => window.__game.voyage.debug().hasFlower)
  if (!flower && !already) { errors.push(`${id}: no mirror flower appeared`); break }
  if (flower) await page.evaluate(f => window.__game.voyage.debugTeleport(f.x, f.y, f.z), flower)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-${id}-done.png` })
  const has = await page.evaluate(() => window.__game.voyage.debug().hasFlower)
  if (!has) errors.push(`${id}: flower not collected`)
  await page.evaluate(() => window.__game.voyage.debugInteract('小舟'))
  await waitFor(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore', null, { timeout: 30_000 })
}
const progress = await page.evaluate(() => window.__game.save.data.progress.completed)
console.log('completed:', progress.join(','))
if (progress.length !== PLAYABLE.length) errors.push(`expected ${PLAYABLE.length} completed chapters, got ${progress.length}`)

// Chart overlay with everything done.
await page.evaluate(() => { void window.__game.voyage.openChart() })
await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/${mobile ? 'm-' : ''}${String(n++).padStart(2, '0')}-chart.png` })
await page.keyboard.press('Escape')

await browser.close()
if (errors.length) {
  console.error('playtest: FAIL\n' + errors.join('\n'))
  process.exit(1)
}
console.log('playtest: OK')
