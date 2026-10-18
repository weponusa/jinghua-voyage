import * as THREE from 'three'
import { NAMES, duoSpec, linSpec, type Ctx, type SceneDef } from '../chapter'
import { CHAPTERS, HUB_PALETTE } from '../story'
import { flowerCount, nextChapter } from '../progress'
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
  const isles = [[70, 230], [150, 120], [235, 210], [300, 90], [370, 200], [430, 110], [470, 250]]
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
        const n = flowerCount(ctx.progress)
        const lines = [
          '妹夫，这趟海外贩货，你只管看风景，买卖交给俺林之洋！',
          '君子国的镜花安在航海图旁，这一趟从登岸、评理到归舟，算是有始有终。我去把货舱收拾妥当。',
        ]
        await ctx.say([{ who: NAMES.lin, text: lines[n >= 1 ? 1 : 0] }])
      },
    })
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '请教', name: NAMES.duo, enabled: () => true,
      run: async () => {
        const next = nextChapter(ctx.progress)
        if (!next) {
          await ctx.say([
            { who: NAMES.duo, text: '君子国这一章已经圆满收束：镜花在船，见闻也已记下。' },
            { who: NAMES.duo, text: '海图上其余港口仍标作「制作中」，今日不再催唐兄起航。若想重游君子国，只管展开航海图。' },
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
    ctx.objective(next ? `到甲板中央展开航海图，前往${CHAPTERS[next].name}` : '第一章已完成 · 后续章节制作中，可展开航海图重游君子国', table)
  },
  async start(ctx) {
    if (ctx.progress.prologueSeen) return
    await ctx.say([
      { who: NAMES.narrator, text: '唐朝年间，岭南秀才唐敖赴京赶考，中了探花，却因故被革去功名。' },
      { who: NAMES.narrator, text: '心灰意冷之际，他随妻舅林之洋的商船出海，想去看一看海外的天地。' },
      { who: NAMES.lin, text: '妹夫，船已出了港！功名丢了便丢了，海外奇国多得是，够你看个够。' },
      { who: NAMES.duo, text: '老夫多九公，掌舵四十年。据说每到一国，悟透其中道理，便能得一枚「镜花」。' },
      { who: NAMES.tang, text: '集齐镜花，便能登上海上仙山小蓬莱么？那便一国一国地走下去罢。' },
    ])
  },
}
