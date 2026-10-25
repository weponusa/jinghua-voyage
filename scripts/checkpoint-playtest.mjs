// Mid-chapter persistence: refreshing the detailed-only game must preserve puzzle state.
import { chromium } from 'playwright'
const url = process.env.URL ?? 'http://127.0.0.1:3003/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
async function ready() {
  await page.waitForFunction(() => document.getElementById('ui')?.dataset.activeScreen === 'title', null, { timeout: 60_000 })
  await page.evaluate(() => {
    const g = window.__game
    g.answers = []
    g.ui.dialog = async () => {}
    g.ui.choose = async () => g.answers.shift() ?? 0
  })
}
async function enter(id) {
  await page.evaluate(id => window.__game.voyage.enter(id), id)
  await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 30_000 })
}
async function interact(name, answers = []) {
  return page.evaluate(async ([name, answers]) => {
    const g = window.__game
    g.answers = [...answers]
    return g.voyage.debugInteract(name)
  }, [name, answers])
}
await page.goto(url)
await ready()
await page.evaluate(() => window.__game.save.update({ progress: { ...window.__game.save.data.progress, completed: ['junzi'] } }))
await enter('daren')
for (const [name, answers] of [['老婆婆', [0]], ['孩童', [0]], ['钱袋', [0]]]) {
  if (!await interact(name, answers)) errors.push(`daren interaction failed: ${name}`)
}
await page.reload()
await ready()
await enter('daren')
let data = await page.evaluate(() => window.__game.save.data.progress.chapters.daren.data)
if (data.fruit !== 1 || data.kite !== 1 || data.carryingPurse !== true) errors.push(`daren refresh state wrong: ${JSON.stringify(data)}`)
let quest = await page.locator('.quest-text').textContent()
if (!quest?.includes('还给')) errors.push(`daren refresh objective wrong: ${quest}`)
if (!await interact('卖油郎')) errors.push('daren restored owner interaction failed')
if (!await interact('大人国长者')) errors.push('daren restored final interaction failed')
await page.waitForFunction(() => !!window.__game.voyage.debugFlower())

await page.evaluate(() => window.__game.save.update({ progress: { ...window.__game.save.data.progress, completed: ['junzi', 'daren', 'liangmian'] } }))
await enter('wuchang')
if (!await interact('富翁')) errors.push('wuchang miser introduction failed')
if (!await interact('热饭')) errors.push('wuchang bowl pickup failed')
await page.reload()
await ready()
await enter('wuchang')
data = await page.evaluate(() => window.__game.save.data.progress.chapters.wuchang.data)
if (data.talkedMiser !== true || data.carryingBowl !== 0) errors.push(`wuchang refresh state wrong: ${JSON.stringify(data)}`)
quest = await page.locator('.quest-text').textContent()
if (!quest?.includes('把热饭送给')) errors.push(`wuchang carried-bowl objective wrong: ${quest}`)
if (!await interact('小厮阿福')) errors.push('wuchang restored bowl delivery failed')
data = await page.evaluate(() => window.__game.save.data.progress.chapters.wuchang.data)
if (!Array.isArray(data.fed) || data.fed.length !== 1 || data.carryingBowl !== -1) errors.push(`wuchang delivery not saved: ${JSON.stringify(data)}`)
await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('checkpoint-playtest: OK (daren refresh, wuchang carried bowl refresh)')
