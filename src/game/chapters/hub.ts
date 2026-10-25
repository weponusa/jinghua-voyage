import * as THREE from 'three'
import { NAMES, duoSpec, linSpec, type Ctx, type SceneDef } from '../chapter'
import { CHAPTERS, HUB_PALETTE } from '../story'
import { CHAPTER_ORDER, flowerCount, nextChapter, type ChapterId } from '../progress'
import { instance } from '../models'
import { lantern, mirrorFlower, textTexture } from '../stage'
import { WATER_Y } from '../terrain'

/** Deck layout discovered from the loaded ship (or the fallback), in world coordinates. */
type Deck = { y: number; clear: (x: number, z: number) => boolean; spot: (x: number, z: number) => THREE.Vector3 }

/**
 * Put the generated junk on the sea and survey its deck by casting rays straight down: the
 * lowest common hit along the keel line is the main deck, and points whose first hit is far
 * above it are masts, cabins or rails. Characters and the chart table are only placed on clear
 * deck, so nothing spawns inside a mast. The ship mesh itself is the collider.
 */
async function placeShip(ctx: Ctx): Promise<Deck | null> {
  const ship = await instance('junk_ship')
  if (!ship) return null
  ship.position.set(0, 0, 0)
  ctx.scene.add(ship)
  ship.updateMatrixWorld(true)
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  const firstHit = (x: number, z: number): number | null => {
    ray.set(new THREE.Vector3(x, 60, z), down)
    const hit = ray.intersectObject(ship, true)[0]
    return hit ? hit.point.y : null
  }
  const samples: number[] = []
  for (let z = -8; z <= 8; z += 0.5) {
    const h = firstHit(0.6, z)
    if (h !== null) samples.push(h)
  }
  samples.sort((a, b) => a - b)
  const deckLocal = samples[Math.floor(samples.length * 0.3)] ?? 4
  // Float the hull so the deck sits ~2.6 m above the sea.
  const lift = WATER_Y + 2.6 - deckLocal
  ship.position.y = lift
  ship.updateMatrixWorld(true)
  ctx.physics.addObjectTrimesh(ship)
  const y = deckLocal + lift
  const clear = (x: number, z: number) => {
    // Clear when the deck is under every point of a small disc around (x, z).
    for (const [dx, dz] of [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) {
      const h = firstHit(x + dx, z + dz)
      if (h === null || Math.abs(h - y) > 0.25) return false
    }
    return true
  }
  const spot = (x: number, z: number) => {
    // Nearest clear point, searching outward along the keel line.
    for (let r = 0; r < 6; r += 0.25) {
      for (const [sx, sz] of [[0, r], [0, -r], [r, 0], [-r, 0]]) if (clear(x + sx, z + sz)) return new THREE.Vector3(x + sx, y, z + sz)
    }
    return new THREE.Vector3(x, y, z)
  }
  return { y, clear, spot }
}

/** Minimal procedural deck used only when the ship model is unavailable. */
function fallbackDeck(ctx: Ctx): Deck {
  const s = ctx.stage
  const y = WATER_Y + 2.6
  s.box(new THREE.Vector3(0, y - 1.9, 0), new THREE.Vector3(7.4, 3.8, 22), '#5b3a26')
  s.box(new THREE.Vector3(0, y - 0.1, 0), new THREE.Vector3(7, 0.2, 22), '#8b5e3c')
  for (const x of [-3.55, 3.55]) s.box(new THREE.Vector3(x, y + 0.45, 0), new THREE.Vector3(0.2, 0.9, 22), '#6b4429')
  for (const z of [-11, 11]) s.box(new THREE.Vector3(0, y + 0.45, z), new THREE.Vector3(7, 0.9, 0.2), '#6b4429')
  return { y, clear: () => true, spot: (x, z) => new THREE.Vector3(x, y, z) }
}

/** A sea-chart table: turned legs, a raised rim, and a painted chart of the voyage. */
function chartTable(): THREE.Group {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4429', roughness: 0.8 })
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 1.25), wood)
  top.position.y = 0.86
  g.add(top)
  for (const [x, z] of [[-0.82, -0.5], [0.82, -0.5], [-0.82, 0.5], [0.82, 0.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.82, 8), wood)
    leg.position.set(x, 0.41, z)
    g.add(leg)
  }
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const k = c.getContext('2d')!
  k.fillStyle = '#efe2c2'
  k.fillRect(0, 0, 512, 320)
  k.strokeStyle = 'rgba(46,94,140,0.35)'
  for (let i = 0; i < 9; i += 1) {
    k.beginPath()
    k.moveTo(0, 30 + i * 32)
    for (let x = 0; x <= 512; x += 16) k.lineTo(x, 30 + i * 32 + Math.sin(x * 0.05 + i) * 4)
    k.stroke()
  }
  const isles = CHAPTER_ORDER.map(id => [CHAPTERS[id].chart.x / 100 * 512, CHAPTERS[id].chart.y / 100 * 320])
  k.fillStyle = '#7fae8e'
  for (const [x, y] of isles) {
    k.beginPath()
    k.ellipse(x, y, 26, 16, 0.3, 0, Math.PI * 2)
    k.fill()
  }
  k.strokeStyle = '#c8412f'
  k.setLineDash([8, 7])
  k.lineWidth = 3
  k.beginPath()
  isles.forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)))
  k.stroke()
  k.setLineDash([])
  k.fillStyle = '#2e5e8c'
  k.font = '40px "ManusCC0 Sans CJK SC", sans-serif'
  k.fillText('航海图', 22, 52)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
  chart.rotation.x = -Math.PI / 2
  chart.position.y = 0.915
  g.add(chart)
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}

const PROLOGUE_ACTS = [
  [
    { who: NAMES.narrator, text: '第一幕 · 百花谪凡。武则天寒冬敕令百花齐放，百花仙子与众花仙却因错乱花时，获谴降入红尘。' },
    { who: NAMES.narrator, text: '岭南唐家，一声婴啼。百花仙子托生为唐敖之女，取名唐小山。此事只有看卷人知道，唐敖并不知晓。' },
    { who: '唐小山', text: '爹爹，外面的世界，也有书里这些山川和花鸟么？' },
    { who: NAMES.tang, text: '等你长大了，爹爹把见过的都讲给你听。' },
  ],
  [
    { who: NAMES.narrator, text: '第二幕 · 探花失意。唐敖赴京得中探花，报喜声犹在耳边，因旧交受牵连的参劾却随后而至。' },
    { who: NAMES.narrator, text: '功名被革，他把文书收进箱底。林之洋正要领商船出海，邀他同行散心，掌舵的正是熟识海外风物的多九公。' },
    { who: NAMES.lin, text: '妹夫，功名丢了，日子还得过。随俺去海外走一趟，看看天到底有多大。' },
  ],
  [
    { who: NAMES.narrator, text: '第三幕 · 梦神观。唐敖夜求仙缘，梦中只闻一句：仙道不离忠孝仁信，下山先学做人。' },
    { who: NAMES.duo, text: '船已离岸。俺们以贩货为业，走到哪国便看哪国，别先把别人的好坏想定了。' },
    { who: NAMES.tang, text: '我本只想躲开失意。既然来了，就把每一程都看清楚罢。' },
    { who: NAMES.narrator, text: '此时无人知道镜花在何处。第一段花信，要等君子国的海风来揭开的。' },
  ],
] as const

const SEA_EVENTS: { id: string; after: ChapterId; lines: readonly { who: string; text: string }[] }[] = [
  { id: 'first-flower-dream', after: 'junzi', lines: [
    { who: NAMES.narrator, text: '夜航 · 花梦。第一枚镜花在图桌旁发亮，唐敖梦见唐小山站在一片从未见过的花林中。' },
    { who: '唐小山', text: '爹爹，花落在人间，也会想家么？' },
    { who: NAMES.tang, text: '小山……原来这一路，还有我不知道的因缘。' },
  ] },
  { id: 'home-letter', after: 'daren', lines: [
    { who: NAMES.narrator, text: '夜航 · 家信。商船托来人捎去一封家书，唐敖写了又改，最后只留下各国真实的见闻。' },
    { who: NAMES.lin, text: '怎么不把镜花写得神些？' },
    { who: NAMES.tang, text: '云色照见的是人心。这个比神异更该告诉小山。' },
  ] },
  { id: 'duo-humbled', after: 'heichi', lines: [
    { who: NAMES.duo, text: '老夫走了半生海路，在黑齿国才知，认得几张面孔，算不得认得天下人。' },
    { who: NAMES.tang, text: '九公肯认错，那两位才女的一课才算没有白讲。' },
  ] },
  { id: 'lin-after-nver', after: 'nver', lines: [
    { who: NAMES.lin, text: '从前只听人说谁该怎样活。自己被困过一回，才知那些话说起来轻巧。' },
    { who: NAMES.tang, text: '你能自己走出来，俺们也才能在外头接住你。' },
    { who: NAMES.narrator, text: '当夜，唐敖把女儿国的经过写进留给唐小山的航海志。' },
  ] },
]

export const hub: SceneDef = {
  id: 'hub',
  palette: HUB_PALETTE,
  models: ['junk_ship', 'linzhiyang', 'duojiugong'],
  spawn: new THREE.Vector3(0, WATER_Y + 3.6, 3),
  yaw: -0.25,
  async build(ctx) {
    const deck = (await placeShip(ctx)) ?? fallbackDeck(ctx)
    const at = (x: number, z: number) => deck.spot(x, z)

    const spawn = at(1.7, 3.6)
    ctx.setSpawn(spawn.clone().setY(deck.y + 0.9))

    const tableAt = at(-1.2, -1.2)
    const table = chartTable()
    table.position.copy(tableAt)
    ctx.scene.add(table)
    ctx.physics.addStaticBox(tableAt.clone().setY(deck.y + 0.45), new THREE.Vector3(1.9, 0.9, 1.25))

    const linAt = at(-1.4, -5.6)
    const duoAt = at(1.2, 6.2)
    const lin = await ctx.npc({ ...linSpec(linAt.x, linAt.z, Math.PI * 0.15), y: deck.y })
    const duo = await ctx.npc({ ...duoSpec(duoAt.x, duoAt.z, Math.PI * 0.9), y: deck.y })

    // Lanterns along the deck, and the 唐 pennant.
    for (const z of [-7.5, 8.2]) {
      const p = at(2.2, z)
      const l = lantern()
      l.scale.setScalar(0.7)
      l.position.copy(p).setY(deck.y + 2.2)
      ctx.scene.add(l)
      ctx.stage.bob(l, 0.04, 1.6)
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshStandardMaterial({ map: textTexture('唐', { w: 128, h: 72, bg: '#c8412f', fg: '#f3ead7', size: 52 }), side: THREE.DoubleSide }))
    flag.position.set(0, deck.y + 1.6, 9.6)
    ctx.scene.add(flag)

    // Collected mirror flowers float in a ring above the chart table.
    const got = flowerCount(ctx.progress)
    for (let i = 0; i < got; i += 1) {
      const f = mirrorFlower()
      f.scale.setScalar(0.32)
      const a = (i / 6) * Math.PI * 2
      f.position.set(tableAt.x + Math.cos(a) * 0.9, deck.y + 1.8, tableAt.z + Math.sin(a) * 0.9)
      ctx.scene.add(f)
      ctx.stage.spin(f, 0.5)
    }

    ctx.interact({ pos: tableAt, radius: 2.4, verb: '展开', name: '航海图', enabled: () => true, run: () => ctx.openChart() })
    ctx.interact({
      pos: lin.position, radius: 2.4, verb: '交谈', name: NAMES.lin, enabled: () => true,
      run: async () => {
        const text = ctx.progress.completed.includes('nver')
          ? '宫里那笔账，俺如今还记得。账能算清，人受的苦可不能随手抹掉。下一船的货，俺照样做买卖，却不做欺负人的买卖。'
          : ctx.progress.completed.includes('liangmian')
            ? '那件绸衫一换，人的脸就跟着变了。俺做买卖讲究货真价实，最烦这种看人下菜碟。'
            : ctx.progress.completed.includes('junzi')
              ? '货舱已收拾妥当。你去各国看风物，俺也把各地货单记下来，回去给小山讲讲外面的世道。'
              : '妹夫，这趟海外贩货，你看风物，俺看行情。别只管前头的奇国，也记得家里还有人等信。'
        await ctx.say([{ who: NAMES.lin, text }])
      },
    })
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '请教', name: NAMES.duo, enabled: () => true,
      run: async () => {
        const next = nextChapter(ctx.progress)
        if (!next) {
          await ctx.say([
            { who: NAMES.duo, text: '六枚镜花俱已归船，三段人物见闻也已录入航海志。小蓬莱留下了唐兄的足迹，这一趟总算圆满。' },
            { who: NAMES.duo, text: '若想重温哪段见闻，只管展开航海图，十处港口随时都能再去走走。' },
          ])
          return
        }
        const meta = CHAPTERS[next]
        await ctx.say([
          { who: NAMES.duo, text: `下一站是${meta.name}——${meta.tagline}。${meta.blurb}` },
          { who: NAMES.duo, text: '到桌前展开航海图，择定港口，老夫便掌舵启航。' },
        ])
      },
    })
    const next = nextChapter(ctx.progress)
    ctx.objective(next ? `到甲板中央展开航海图，前往${CHAPTERS[next].name}` : '百花航海篇已圆满 · 可展开航海图重游十处港口', table)
  },
  async start(ctx) {
    for (let act = ctx.progress.prologueAct; act < PROLOGUE_ACTS.length; act += 1) {
      await ctx.say([...PROLOGUE_ACTS[act]])
      ctx.updateStory({ prologueAct: act + 1, prologueSeen: act === PROLOGUE_ACTS.length - 1 })
    }
    const event = SEA_EVENTS.find(item => ctx.progress.completed.includes(item.after) && !ctx.progress.seaEvents.includes(item.id))
    if (event) {
      await ctx.say([...event.lines])
      ctx.updateStory({ seaEvents: [...ctx.progress.seaEvents, event.id] })
    }
  },
}
