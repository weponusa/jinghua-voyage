// Isolated Progress v2 browser checks. Run one SCOPE at a time to avoid a full-voyage memory peak.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.URL ?? 'http://127.0.0.1:3003/'
const scope = process.env.SCOPE ?? 'all'
const scopes = ['shushi', 'qishe', 'nver', 'endings', 'legacy']
if (scope !== 'all' && !scopes.includes(scope)) throw new Error(`Unknown SCOPE: ${scope}; use all, ${scopes.join(', ')}`)
const target = new URL(base)
target.searchParams.set('test', '1')
const testUrl = target.toString()

const SOLUTIONS = {
  shushi: [['酒保', []], ['腐儒', [0]], ['徐承志', []], ['巡关告示', []], ['旧关牒', []], ['北侧墙', []], ['淑士关侧门', []]],
  qishe: [['多九公', []], ['青蒿', []], ['金银花', []], ['药方', []], ['多九公', []], ['音韵台·听音', [1]], ['音韵台·辨调', [3]], ['音韵台·排字', [0]], ['花灯·画谜', [0]], ['花灯·果谜', [1]], ['花灯·哑谜', [1]], ['多九公', []]],
  nver: [['林之洋', []], ['织机与竹管', []], ['防水绸货账', [1]], ['女官文绮', []], ['西窗竹管', []], ['治河黄榜', []], ['源水闸', []], ['分水闸', []], ['归漕闸', []], ['河工竹管', []], ['女官文绮', [1]], ['西水门', []]],
}
const FLOWER_CHAPTERS = ['junzi', 'daren', 'wuchang', 'heichi', 'baimin', 'liangmian']
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

async function ready(page) {
  await page.waitForFunction(() => document.getElementById('ui')?.dataset.activeScreen === 'title', null, { timeout: 60_000 })
  await page.evaluate(() => {
    const g = window.__game
    g.answers = []
    g.ui.dialog = async () => {}
    g.ui.choose = async () => g.answers.shift() ?? 0
  })
}

async function enter(page, id) {
  await page.evaluate(id => window.__game.voyage.enter(id, false), id)
  await page.waitForFunction(id => window.__game.voyage.sceneId === id && window.__game.voyage.mode === 'explore', id, { timeout: 60_000 })
}

async function reloadAndEnter(page, id) {
  await page.reload()
  await ready(page)
  await enter(page, id)
}

async function interact(page, name, answers = []) {
  const ok = await page.evaluate(async ([name, answers]) => {
    const g = window.__game
    g.answers = [...answers]
    return g.voyage.debugInteract(name)
  }, [name, answers])
  assert(ok, `interaction unavailable: ${name}`)
}

async function flowerTotal(page) {
  return page.evaluate(ids => {
    const p = window.__game.save.data.progress
    return ids.filter(id => p.completed.includes(id) || (id === 'junzi' ? p.junzi.flowerCollected : p.chapters[id]?.flowerCollected)).length
  }, FLOWER_CHAPTERS)
}

async function assertSolvedWithoutFlower(page, id, expectedFlowers) {
  const state = await page.evaluate(id => {
    const g = window.__game
    const checkpoint = g.save.data.progress.chapters[id]
    return {
      solved: checkpoint?.solved === true,
      flowerCollected: checkpoint?.flowerCollected === true,
      hasFlower: g.voyage.debug().hasFlower,
      objective: document.querySelector('.quest-text')?.textContent ?? '',
    }
  }, id)
  assert.equal(state.solved, true, `${id}: solved checkpoint missing`)
  assert.equal(state.flowerCollected, false, `${id}: story chapter collected a flower`)
  assert.equal(state.hasFlower, false, `${id}: story chapter owns a flower`)
  assert(state.objective.includes('小舟'), `${id}: solved objective does not point to the boat: ${state.objective}`)
  assert.equal(await flowerTotal(page), expectedFlowers, `${id}: flower total changed`)
}

async function assertRestoredActor(page, phase, actor) {
  const state = await page.evaluate(() => {
    const g = window.__game
    const checkpoint = g.save.data.progress.chapters.nver
    return {
      phase: checkpoint?.data.phase,
      actor: checkpoint?.data.actor,
      x: checkpoint?.data.x,
      z: checkpoint?.data.z,
      pos: g.voyage.debug().pos,
      skinnedMeshes: g.voyage.debug().animation.skinnedMeshes,
      objective: document.querySelector('.quest-text')?.textContent ?? '',
    }
  })
  assert.equal(state.phase, phase, `nver: phase not restored as ${phase}`)
  assert.equal(state.actor, actor, `nver: actor not restored as ${actor}`)
  assert.equal(typeof state.x, 'number')
  assert.equal(typeof state.z, 'number')
  assert(Math.hypot(state.pos.x - state.x, state.pos.z - state.z) < 0.25, `nver: saved position not restored: ${JSON.stringify(state)}`)
  assert(state.skinnedMeshes > 0, 'nver: restored player has no rendered skinned model')
  if (phase === 'palace' || phase === 'escape') assert(state.objective.includes('林之洋'), `nver: wrong objective after ${phase} restore`)
  if (phase === 'river') assert(state.objective.includes('唐敖'), 'nver: wrong objective after river restore')
}

async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto(testUrl)
  await ready(page)
  return { context, page, errors }
}

async function finishStory(page, id, expectedFlowers) {
  await page.evaluate(() => { window.__storySealRun = window.__game.voyage.debugInteract('小舟') })
  await page.waitForSelector('.seal.is-active', { timeout: 10_000 })
  assert((await page.locator('.seal-body').textContent()).includes('人物见闻已录'), `${id}: story seal missing`)
  await page.click('.seal.is-active [data-action="overlay-ok"]')
  await page.evaluate(() => window.__storySealRun)
  await page.waitForFunction(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore', null, { timeout: 60_000 })
  const completed = await page.evaluate(id => window.__game.save.data.progress.completed.filter(chapter => chapter === id).length, id)
  assert.equal(completed, 1, `${id}: completion count is not exactly one`)
  assert.equal(await flowerTotal(page), expectedFlowers, `${id}: completion changed the flower total`)
}

async function runStory(id) {
  const { context, page, errors } = await openPage()
  try {
    await enter(page, id)
    const expectedFlowers = await flowerTotal(page)

    // An unsolved story chapter may be left early, but must not award completion.
    await interact(page, '小舟', [1])
    await page.waitForFunction(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore', null, { timeout: 60_000 })
    assert.equal(await page.evaluate(id => window.__game.save.data.progress.completed.includes(id), id), false, `${id}: early return completed the chapter`)
    await enter(page, id)

    const restorePoints = id === 'nver'
      ? { 林之洋: ['palace', 'linzhiyang'], 西窗竹管: ['river', 'tangao'], 河工竹管: ['escape', 'linzhiyang'] }
      : {}
    for (const [name, answers] of SOLUTIONS[id]) {
      await interact(page, name, answers)
      if (id === 'nver' && name === '治河黄榜') {
        // A downstream gate opened too early must drop every gate, and that reset must survive refresh.
        await interact(page, '源水闸')
        assert.deepEqual(await page.evaluate(() => window.__game.save.data.progress.chapters.nver?.data.opened), ['source'])
        await interact(page, '归漕闸')
        assert.deepEqual(await page.evaluate(() => window.__game.save.data.progress.chapters.nver?.data.opened), [])
        await reloadAndEnter(page, id)
        await assertRestoredActor(page, 'river', 'tangao')
        assert.deepEqual(await page.evaluate(() => window.__game.save.data.progress.chapters.nver?.data.opened), [])
      }
      if (restorePoints[name]) {
        await reloadAndEnter(page, id)
        await assertRestoredActor(page, ...restorePoints[name])
      }
    }
    await assertSolvedWithoutFlower(page, id, expectedFlowers)

    // A second refresh must retain the solved state without creating a collectible.
    await reloadAndEnter(page, id)
    await assertSolvedWithoutFlower(page, id, expectedFlowers)
    if (id === 'nver') await assertRestoredActor(page, 'done', 'tangao')
    await finishStory(page, id, expectedFlowers)
    assert.deepEqual(errors, [], `${id}: browser errors`)
    console.log(`v2-story-qa: ${id} OK (early return, solved refresh${id === 'nver' ? ', actor restore' : ''}, story seal)`)
  } finally {
    await context.close()
  }
}

async function runLegacy() {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(() => {
    localStorage.setItem('jinghua.save', JSON.stringify({
      version: 1,
      progress: { completed: ['junzi', 'daren', 'liangmian'], prologueSeen: true },
    }))
  })
  const normalUrl = new URL(base)
  normalUrl.searchParams.delete('test')
  await page.goto(normalUrl.toString())
  await ready(page)
  try {
    const migrated = await page.evaluate(() => ({
      version: window.__game.save.data.version,
      route: window.__game.save.data.progress.route,
      prologueAct: window.__game.save.data.progress.prologueAct,
      completed: window.__game.save.data.progress.completed,
    }))
    assert.deepEqual(migrated, { version: 2, route: 'legacy', prologueAct: 3, completed: ['junzi', 'daren', 'liangmian'] })
    await enter(page, 'wuchang')
    await enter(page, 'hub')
    await page.evaluate(() => window.__game.voyage.enter('heichi', false))
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => window.__game.voyage.sceneId), 'hub', 'legacy: heichi must remain locked')
    await enter(page, 'shushi')
    assert.deepEqual(errors, [], 'legacy: browser errors')
    console.log('v2-story-qa: legacy OK (v1 migration, old route lock, story chapter unlock, no prologue replay)')
  } finally {
    await context.close()
  }
}

async function runEnding(choice, answer) {
  const { context, page, errors } = await openPage()
  try {
    await enter(page, 'penglai')
    // Stop at the ending question after the flowers are placed. Reloading must restore the altar,
    // fairy and six-flower ring without forcing the player to collect or place anything again.
    await page.evaluate(() => {
      const g = window.__game
      g.ui.choose = async () => new Promise(() => {})
      void g.voyage.debugInteract('镜台')
    })
    await page.waitForFunction(() => {
      const p = window.__game.save.data.progress
      return p.chapters.penglai?.solved === true && p.chapters.penglai.data.placed === true
    })
    await reloadAndEnter(page, 'penglai')
    const restored = await page.evaluate(() => ({
      placed: window.__game.save.data.progress.chapters.penglai?.data.placed === true,
      ending: window.__game.save.data.progress.ending,
      objective: document.querySelector('.quest-text')?.textContent ?? '',
    }))
    assert(restored.placed && !restored.ending && restored.objective.includes('照见前尘'), `penglai: placed altar not restored: ${JSON.stringify(restored)}`)
    await page.evaluate(answer => {
      const g = window.__game
      g.answers = [answer]
      window.__endingRun = g.voyage.debugInteract('镜台')
    }, answer)
    await page.waitForSelector('.ending.is-active', { timeout: 15_000 })
    const ending = await page.evaluate(() => ({
      flowers: [...document.querySelectorAll('.ending-list li b')].map(node => node.textContent),
      choice: document.querySelector('.ending-choice')?.textContent ?? '',
      epilogue: document.querySelector('.ending-epilogue')?.textContent ?? '',
      savedChoice: window.__game.save.data.progress.endingChoice,
    }))
    assert.deepEqual(ending.flowers, ['君子国', '大人国', '无肠国', '黑齿国', '白民国', '两面国'])
    assert(ending.choice.includes(choice === 'stay' ? '唐敖题诗入山' : '唐敖选择归乡'), `wrong ${choice} ending copy`)
    assert(ending.epilogue.includes('唐小山'), `${choice}: Tang Xiaoshan epilogue missing`)
    assert.equal(ending.savedChoice, choice)
    await page.click('.ending.is-active [data-action="overlay-ok"]')
    await page.evaluate(() => window.__endingRun)
    await page.waitForFunction(() => window.__game.voyage.sceneId === 'hub' && window.__game.voyage.mode === 'explore', null, { timeout: 60_000 })
    const progress = await page.evaluate(() => window.__game.save.data.progress)
    assert.equal(progress.ending, true)
    assert.equal(progress.endingChoice, choice)
    assert.equal(progress.epilogueSeen, true)
    assert(progress.completed.includes('penglai'))
    assert.deepEqual(errors, [], `${choice}: browser errors`)
    console.log(`v2-story-qa: ending ${choice} OK (six flowers, Tang Xiaoshan epilogue)`)
  } finally {
    await context.close()
  }
}

try {
  for (const selected of scope === 'all' ? scopes : [scope]) {
    if (selected === 'endings') {
      await runEnding('stay', 0)
      await runEnding('return', 1)
    } else if (selected === 'legacy') {
      await runLegacy()
    } else {
      await runStory(selected)
    }
  }
  console.log(`v2-story-qa: OK (${scope})`)
} finally {
  await browser.close()
}
