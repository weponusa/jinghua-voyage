import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, lanternPosts, type SceneDef } from '../chapter'
import { JUNZI_MAP, JUNZI_PATHS } from '../navigation'
import { CHAPTERS } from '../story'
import { paifangFallback, pavilionFallback, textTexture, type Stage, villager } from '../stage'

const M = CHAPTERS.junzi

type LandmarkId = 'dock' | 'arch' | 'market' | 'courtesy' | 'pavilion'
type Point = { x: number; z: number }

/** Keep the playable island anchored to the same canonical points used by the map UI. */
function landmark(id: LandmarkId): Point {
  const point = JUNZI_MAP.landmarks.find(item => item.id === id)
  if (!point) throw new Error(`Missing Junzi landmark: ${id}`)
  return { x: point.x, z: point.z }
}

// Layout (north = -Z). These anchors are deliberately derived from navigation.ts: a visitor can
// follow the chart's paths to the actual road signs, rather than to an approximate prop centre.
const DOCK = landmark('dock')
const ARCH = landmark('arch')
const MARKET = landmark('market')
const COURTESY = landmark('courtesy')
const PAVILION_ENTRY = landmark('pavilion')
const R = 22
const STALL = { x: -3.1, z: -3.25 }
const SELLER_AT = { x: -4.05, z: -1.72 }
const BUYER_AT = { x: -2.15, z: -1.45 }
// The chart pin and interaction are at the open eastern approach; the pavilion itself is set back
// on the hill so its collider cannot swallow the landing point or block the main path.
const HILL = { x: PAVILION_ENTRY.x + 1.8, z: PAVILION_ENTRY.z }
const HOUSES: [number, number, number][] = [
  [-8.5, -10, Math.PI * 0.2],
  [0, -13.5, 0],
  [8.5, -11.5, -Math.PI * 0.22],
]

/** Procedural stall, used only if the generated market stall is unavailable. */
function stallFallback(): THREE.Group {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.85 })
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 1.1), wood)
  counter.position.y = 0.5
  g.add(counter)
  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 2), new THREE.MeshStandardMaterial({ color: '#3e8e7e' }))
  awning.position.set(0, 2.6, -0.3)
  awning.rotation.x = -0.18
  g.add(awning)
  for (const x of [-1.7, 1.7]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), wood)
    pole.position.set(x, 1.3, 0.5)
    g.add(pole)
  }
  return g
}

/** A light, non-colliding wayfinding board. It makes routes legible without narrowing paths. */
function roadSign(stage: Stage, label: string, at: Point, rotY = 0): THREE.Group {
  const sign = new THREE.Group()
  const wood = new THREE.MeshLambertMaterial({ color: '#6b4429' })
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 1.18),
    new THREE.MeshBasicMaterial({ map: textTexture(label, { w: 128, h: 220, size: 42, vertical: true, bg: '#f3ead7', fg: '#2f5f57' }), side: THREE.FrontSide }),
  )
  board.position.y = 1.55
  board.position.z = 0.012
  const reverse = board.clone()
  reverse.position.z = -0.012
  reverse.rotation.y = Math.PI
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.08), wood)
  cap.position.y = 2.18
  for (const x of [-0.25, 0.25]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.4, 6), wood)
    post.position.set(x, 0.7, 0)
    sign.add(post)
  }
  sign.add(board, reverse, cap)
  sign.position.set(at.x, stage.groundHeight(at.x, at.z), at.z)
  sign.rotation.y = rotY
  stage.scene.add(sign)
  return sign
}

export const junzi: SceneDef = {
  id: 'junzi',
  palette: M.palette,
  models: ['duojiugong', 'seller', 'buyer', 'elder', 'oilseller', 'paifang', 'market_stall', 'house', 'pavilion', 'chinese_pine', 'peach_tree', 'willow', 'taihu_rock', 'rock_largeA', 'rock_largeC', 'stone_lantern', 'lantern_post', 'small_boat'],
  spawn: new THREE.Vector3(0, 1.2, 17),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(R, {
      seed: 11,
      roll: 0.35,
      wobble: 0.09,
      hills: [
        { x: HILL.x, z: HILL.z, r: 8.5, h: 2.4, top: 2.8 },
        { x: -14, z: -8, r: 7, h: 1.4 },
        { x: -2, z: -19, r: 8, h: 1.1 },
      ],
      flats: [
        { x: MARKET.x, z: MARKET.z, r: 6.5 },
        { x: ARCH.x, z: ARCH.z, r: 3.2 },
        { x: COURTESY.x, z: COURTESY.z, r: 2.6 },
        ...HOUSES.map(([x, z]) => ({ x, z, r: 3.6 })),
      ],
      paths: JUNZI_PATHS.map(route => route.map(point => [point.x, point.z] as [number, number])),
      pathWidth: 2.2,
      foliage: {
        form: 'garden',
        density: 1,
        flowers: ['#f6efe0', '#f3b5c5', '#f2d36b', '#e48d8d'],
        avoid: [{ x: COURTESY.x, z: COURTESY.z, r: 2 }],
      },
    })

    // The broad paved square leaves the north–south road clear; every solid stall sits to a side.
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8cfbd', roughness: 0.95 }))
    plaza.position.set(MARKET.x, s.groundHeight(MARKET.x, MARKET.z) + 0.03, MARKET.z)
    plaza.receiveShadow = true
    s.scene.add(plaza)
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.2, 6.55, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a99c84', roughness: 1 }))
    ring.position.copy(plaza.position).setY(plaza.position.y + 0.005)
    s.scene.add(ring)
    let solved = ctx.progress.junzi.haggleSolved

    // The arch has no single mesh collider: its open central bay stays a real, reliable passage.
    const arch = await s.prop('paifang', ARCH.x, 'ground', ARCH.z, { fallback: paifangFallback })
    if (arch) {
      const box = new THREE.Box3().setFromObject(arch)
      const size = box.getSize(new THREE.Vector3())
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.7, size.x * 0.24), 0.5), new THREE.MeshBasicMaterial({ map: textTexture('惟善为宝', { w: 320, h: 100, size: 60, bg: '#2f5f57', fg: '#f3ead7' }) }))
      plaque.position.set(ARCH.x, box.min.y + size.y * 0.62, box.max.z + 0.03)
      plaque.name = 'plaque'
      s.scene.add(plaque)
    }
    await s.prop('taihu_rock', 3.4, 'ground', ARCH.z + 1.2, { rotY: 0.6, collider: 0.7 })
    await s.prop('taihu_rock', -3.6, 'ground', ARCH.z - 0.6, { rotY: 2.1, scale: 0.75, collider: 0.6 })

    // Market: the disputed stall is west of the centreline; the seller is in front of its counter,
    // never inside the solid mesh. The central chart route remains a clear paved corridor.
    const stallY = s.groundHeight(STALL.x, STALL.z)
    await s.prop('market_stall', STALL.x, stallY, STALL.z, { solid: true, fallback: stallFallback })
    await s.prop('market_stall', -6.2, s.groundHeight(-6.2, -2.4), -2.4, { rotY: Math.PI * 0.42, solid: true, fallback: stallFallback })
    await s.prop('market_stall', 5.2, s.groundHeight(5.2, -2.8), -2.8, { rotY: -Math.PI * 0.42, solid: true, fallback: stallFallback })
    const marketBanner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.5), new THREE.MeshBasicMaterial({ map: textTexture('让利集', { w: 80, h: 256, size: 52, vertical: true, bg: '#f3ead7', fg: '#c8412f' }), side: THREE.DoubleSide }))
    marketBanner.position.set(STALL.x + 2.05, stallY + 1.3, STALL.z + 0.35)
    s.scene.add(marketBanner)

    for (const [x, z, rot] of HOUSES) await s.prop('house', x, 'ground', z, { rotY: rot, solid: true })

    // The pavilion is a view, not a wall in the approach. Its map pin is the clear eastern entrance.
    const hy = s.groundHeight(HILL.x, HILL.z)
    await s.prop('pavilion', HILL.x, hy, HILL.z, { rotY: Math.PI, fallback: pavilionFallback })
    for (const [dx, dz] of [[-1.5, 2.2], [-1.5, -2.2]]) await s.prop('stone_lantern', HILL.x + dx, 'ground', HILL.z + dz, { collider: 0.35 })
    for (const [x, z, sc] of [[16.5, -1, 1.1], [15, -8, 0.9], [9.5, -8.5, 1], [17, 3.5, 0.85]] as const) await s.prop('chinese_pine', x, 'ground', z, { rotY: x, scale: sc, collider: 0.5 })

    // Peach trees round the square, willows by the shore, pines on the western rise.
    for (const [x, z, sc] of [[-6.8, 3.2, 1], [6.2, 3.8, 0.9], [-7.5, -4.5, 1.05], [6.8, -5.5, 0.95], [-3.5, -16, 1]] as const) await s.prop('peach_tree', x, 'ground', z, { rotY: x * 1.3, scale: sc, collider: 0.4 })
    for (const [x, z] of [[-6.5, 14.5], [7, 13.5], [-13, 9.5], [12.5, 9]] as const) await s.prop('willow', x, 'ground', z, { rotY: z, collider: 0.45 })
    for (const [x, z, sc] of [[-15, -6, 1], [-12, -12.5, 0.9], [-17, 0, 0.8], [3, -18, 0.9], [-9, -16.5, 0.85]] as const) await s.prop('chinese_pine', x, 'ground', z, { rotY: z, scale: sc, collider: 0.5 })
    await s.scatter(0, 0, 9, R * 0.8, 7, ['taihu_rock', 'rock_largeA', 'rock_largeC'], 11, [
      { x: DOCK.x, z: DOCK.z, r: 4 }, { x: ARCH.x, z: ARCH.z, r: 4 }, { x: HILL.x, z: HILL.z, r: 5 }, { x: COURTESY.x, z: COURTESY.z, r: 3 },
      ...HOUSES.map(([x, z]) => ({ x, z, r: 4.5 })),
    ], 0, true, [0.35, 0.6])
    await lanternPosts(s, [[-1.9, 14], [1.9, 14], [-1.9, 4.5], [1.9, 4.5], [-3.6, -8.5], [3.6, -8.5], [8.8, -1.6]])

    const seller = await ctx.npc({ name: '卖货人', model: 'seller', x: SELLER_AT.x, z: SELLER_AT.z, yaw: Math.PI, fallback: () => villager('#3e8e7e', { hatShape: 'tall' }) })
    const buyer = await ctx.npc({ name: '买货人', model: 'buyer', x: BUYER_AT.x, z: BUYER_AT.z, yaw: Math.PI * 0.82, fallback: () => villager('#2e5e8c', { hat: '#2a2622', height: 1.65 }) })
    const duo = await ctx.npc(duoSpec(2.4, 15, Math.PI))
    const [elder] = await Promise.all([
      ctx.npc({ name: '老者', model: 'elder', x: COURTESY.x - 0.8, z: COURTESY.z, yaw: -Math.PI / 2, fallback: () => villager('#7a6a9a', { hat: '#f3ead7', hatShape: 'bun', height: 1.55 }) }),
      ctx.npc({ name: '路人', model: 'oilseller', x: COURTESY.x + 0.8, z: COURTESY.z, yaw: Math.PI / 2, fallback: () => villager('#c9a045', { height: 1.6 }) }),
    ])

    const returnBoat = await dockAndReturn(ctx, 'junzi', new THREE.Vector3(DOCK.x, 0, R + 2), [
      { who: NAMES.duo, text: '一桩买卖，价归公道，余力归众人。镜花既得，君子国这一程便算圆满。' },
      { who: NAMES.tang, text: '我记下的不是谁多让了银钱，而是人人肯把一分余裕留给旁人。' },
      { who: NAMES.duo, text: `正是——${M.moral}。回船罢；这趟首航已收束，余下海图仍待慢慢绘成。` },
    ])

    // Every map landmark has a non-colliding sign just off the road and an optional travel-journal entry.
    const signs = {
      dock: roadSign(s, '归舟渡', { x: DOCK.x + 2.2, z: DOCK.z - 1.3 }, Math.PI),
      arch: roadSign(s, '惟善为宝', { x: ARCH.x + 3.1, z: ARCH.z + 0.25 }, Math.PI / 2),
      market: roadSign(s, '让利集', { x: MARKET.x + 3.5, z: MARKET.z + 0.7 }, Math.PI / 2),
      courtesy: roadSign(s, '礼让巷', { x: COURTESY.x + 1.4, z: COURTESY.z + 1.3 }, -Math.PI / 2),
      pavilion: roadSign(s, '听涛亭', { x: PAVILION_ENTRY.x - 0.7, z: PAVILION_ENTRY.z + 1.0 }, Math.PI * 0.8),
    }

    const journal = async (id: LandmarkId, title: string, firstLines: { who: string; text: string }[], revisit: string) => {
      const first = !ctx.progress.junzi.visited.includes(id)
      ctx.updateJunzi({ visited: [id] })
      if (first) {
        ctx.toast(`《君子国游记》记下：${title}`)
        await ctx.say(firstLines)
      } else {
        await ctx.say([{ who: NAMES.narrator, text: `《君子国游记·${title}》：${revisit}` }])
      }
    }

    ctx.interact({
      pos: signs.dock.position, radius: 2.2, verb: '读牌', name: '归舟渡路牌', enabled: () => true,
      run: () => journal('dock', '归舟渡', [
        { who: NAMES.narrator, text: '渡口的木牌写着「归舟渡」。潮声推着小舟，来时有路，归时也有路。' },
        { who: NAMES.tang, text: '游历不是急着奔向下一处，先把眼前所见安放妥当。' },
      ], '潮平舟稳，若镜花已在囊中，便可由此返航。'),
    })
    ctx.interact({
      pos: signs.arch.position, radius: 2.2, verb: '读牌', name: '惟善为宝路牌', enabled: () => true,
      run: async () => {
        await journal('arch', '惟善为宝', [
          { who: NAMES.narrator, text: '国门匾额只四字：「惟善为宝」。不是以珠玉论贵，而是以能否惠人论贵。' },
          { who: NAMES.duo, text: '唐兄过了这道门，且留心他们如何把这句话做在日用里。' },
        ], '国门的四字，正是城中风俗的起笔。')
        if (!solved && !ctx.hasFlower) ctx.objective('前往让利集，替买卖二人评理', seller.root)
      },
    })
    ctx.interact({
      pos: signs.market.position, radius: 2.2, verb: '读牌', name: '让利集路牌', enabled: () => true,
      run: async () => {
        await journal('market', '让利集', [
          { who: NAMES.narrator, text: '让利集里没有人高声招徕。摊前的争执却格外奇怪：一个嫌价低，一个嫌价高。' },
          { who: NAMES.tang, text: '价钱之外，或许还有让彼此安心的法子。' },
        ], '买卖声渐歇，广场仍留着「价归公道，余力惠人」的谈论。')
        if (!solved && !ctx.hasFlower) ctx.objective('走到柜台前，替买卖二人评理', seller.root)
      },
    })
    ctx.interact({
      pos: signs.courtesy.position, radius: 2.2, verb: '读牌', name: '礼让巷路牌', enabled: () => true,
      run: () => journal('courtesy', '礼让巷', [
        { who: NAMES.narrator, text: '巷口石牌题作「礼让巷」。两位行人相对拱手，谁也不肯先迈一步。' },
        { who: NAMES.tang, text: '礼若只停在一句「请」，便要把路堵住了；还是问问老者。' },
      ], '让路贵在顾及对方，也贵在不把彼此困在客套里。'),
    })
    ctx.interact({
      pos: signs.pavilion.position, radius: 2.2, verb: '读牌', name: '听涛亭路牌', enabled: () => true,
      run: () => journal('pavilion', '听涛亭', [
        { who: NAMES.narrator, text: '东坡山路尽头是听涛亭。凭栏可见归舟渡和城门，海风把松声与潮声揉在一处。' },
        { who: NAMES.tang, text: '记游不必集齐物件；能停下来望一望，已是不虚此行。' },
      ], '亭外松涛未歇，游记也可慢慢添写。'),
    })

    ctx.interact({
      pos: elder.position, radius: 2.6, verb: '交谈', name: '老者', enabled: () => true,
      run: async () => {
        await journal('courtesy', '礼让巷', [
          { who: '老者', text: '请先行。' },
          { who: '路人', text: '不敢不敢，老丈请先。' },
          { who: '老者', text: '……我二人已在此相让了一盏茶的工夫。客人从外邦来？请先请先。' },
        ], '老者笑说：礼要让人舒展，不该让人寸步难行。')
      },
    })

    // Optional market scenes from the novel: courtesy is shown in more than one kind of trade.
    const clothSeller = await ctx.npc({ name: '布商', model: 'seller', x: -5.4, z: 1, yaw: Math.PI * 0.7, fallback: () => villager('#6b8e7d', { hatShape: 'cap' }) })
    const clothBuyer = await ctx.npc({ name: '买布人', model: 'buyer', x: -3.9, z: 1.4, yaw: -Math.PI * 0.7, fallback: () => villager('#8b6a9a', { hatShape: 'cap' }) })
    const wuZhihe = await ctx.npc({ name: '吴之和', model: 'elder', x: 5.6, z: 1, yaw: Math.PI * 0.65, fallback: () => villager('#597b86', { hatShape: 'tall' }) })
    const wuZhixiang = await ctx.npc({ name: '吴之祥', model: 'oilseller', x: 7, z: 0.2, yaw: -Math.PI * 0.65, fallback: () => villager('#8a7358', { hatShape: 'tall' }) })
    ctx.interact({
      pos: clothSeller.position, radius: 2.2, verb: '听买卖', name: '布商让尺', enabled: () => true,
      run: () => ctx.say([
        { who: '布商', text: '这匹布只算八尺的钱，我多送客官二尺。' },
        { who: '买布人', text: '你熬夜织出来的，哪能白送？我偏要按十尺付。' },
        { who: NAMES.tang, text: '一个怕多收，一个怕少给。你们争的，倒不是自己的便宜。' },
      ]),
    })
    ctx.interact({
      pos: clothBuyer.position, radius: 2.2, verb: '问见闻', name: '盐柴相酬', enabled: () => true,
      run: () => ctx.say([
        { who: '买布人', text: '上回我买盐，店家只收粗盐钱，偏要给我雪花盐。' },
        { who: '布商', text: '你也不肯白占便宜，第二天就给他送了两捆柴。' },
        { who: NAMES.tang, text: '不白拿，也不驳回别人的好意。这样来往，两边都痛快。' },
      ]),
    })
    const wuTalk = () => ctx.say([
      { who: '吴之和', text: '争来的利，不过眼前一点；肯让一步，心里倒能长久安生。' },
      { who: '吴之祥', text: '可让也不是一味退。该守的公道还得守，别叫老实人吃亏。' },
      { who: NAMES.tang, text: '肯让人，也肯替人撑住公道。二位这话，不是空谈。' },
    ])
    for (const npc of [wuZhihe, wuZhixiang]) {
      ctx.interact({ pos: npc.position, radius: 2.2, verb: '听清谈', name: '吴氏兄弟', enabled: () => true, run: wuTalk })
    }

    const flowerAt = new THREE.Vector3(STALL.x - 0.2, s.groundHeight(STALL.x - 0.2, STALL.z + 1.42) + 1.25, STALL.z + 1.42)
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: ctx.hasFlower ? '镜花已在囊中。若想返航，归舟渡就在南边；若想温习，四处路牌都可一读。' : solved ? '镜花还在柜台前等唐兄拾起。拾妥后便可回归舟渡。' : '牌坊后头便是让利集。唐兄可直去评理，也可先在岛上随意走走。' }]),
    })

    const haggle = async () => {
      await ctx.say([
        { who: '买货人', text: '老兄，如此上等好货，你只要十两银子？这叫我如何心安！我偏要付二十两！' },
        { who: '卖货人', text: '使不得！货本平常，十两已是公道价。客官再加价，便是叫小弟昧了良心。' },
        { who: '买货人', text: '外邦客人，你来评评理！' },
      ])
      const options = [
        '按十两成交，照单取货',
        '付足二十两，照单取货',
        '十两成交；买家另捐十两，卖家另捐两成货给义仓',
        '各退一步：十五两成交',
      ]
      for (;;) {
        const pick = await ctx.choose(NAMES.tang, '这桩买卖，该如何了结？', options)
        if (pick === 2) break
        const replies = [
          [
            { who: '买货人', text: '十两虽是公道价，可我仍觉得只顾自己，占了这等好货的便宜。' },
            { who: '卖货人', text: '客官的心意我领了，却不能把价钱抬得不公不明。' },
          ],
          [
            { who: '卖货人', text: '二十两拿全货，是叫我多收一倍银子；我心里反倒不安。' },
            { who: '买货人', text: '我加价是想让人，不是想叫老兄为难。' },
          ],
          [
            { who: '买货人', text: '十五两仍不是十两的公道价；我多给，他仍多收，谁也说不清。' },
            { who: '卖货人', text: '折中的数目好听，却没解开我俩各自不安的地方。' },
          ],
        ][pick]
        await ctx.say(replies)
        await ctx.say([{ who: NAMES.duo, text: '（低声）价钱先归公道；若二人都想多让一步，不妨让这份心意再惠及第三人。' }])
      }
      await ctx.say([
        { who: NAMES.tang, text: '十两照公道价成交。客官若仍想多尽心，另出十两捐给义仓；店家也从这批货中捐出两成，让穷困人家领用。' },
        { who: '买货人', text: '好！货价不乱，我的十两另作善款，心里便踏实了。' },
        { who: '卖货人', text: '我也捐两成货入义仓。不是少给客人，是多留一份给城里需要的人。' },
        { who: NAMES.narrator, text: '价仍是十两，善意却添成三份：买家、卖家与义仓各得其所。二人相视而笑，各自作揖。柜台前，一枚镜花悄然浮起。' },
      ])
      solved = true
      ctx.updateJunzi({ haggleSolved: true })
      ctx.spawnFlower(flowerAt.clone())
      ctx.objective('拾起柜台前的镜花', flowerAt.clone())
    }

    for (const npc of [seller, buyer]) {
      ctx.interact({
        pos: npc.position, radius: 2.6, verb: '评理', name: '买卖二人', enabled: () => !solved && !ctx.hasFlower, run: haggle,
      })
    }
    ctx.interact({
      pos: seller.position, radius: 2.6, verb: '温习', name: '卖货人', enabled: () => solved || ctx.hasFlower,
      run: () => ctx.say([{ who: '卖货人', text: '十两是货价，十两是善款，两成货入义仓。各归各处，谁也不必吃亏，这才叫心安。' }]),
    })

    // Save recovery has three deliberate branches: a solved riddle recreates the uncollected flower;
    // a collected flower never respawns; a fresh visit simply points toward the arch and market.
    if (solved && !ctx.hasFlower) {
      ctx.spawnFlower(flowerAt.clone())
      ctx.objective('拾起柜台前等待的镜花', flowerAt.clone())
    } else if (ctx.hasFlower) {
      ctx.objective('镜花已在囊中：可回归舟渡返航，或自由游览君子国', returnBoat)
    } else {
      ctx.objective('穿过「惟善为宝」牌坊，去让利集看看', signs.arch)
    }
  },
  async start(ctx) {
    if (ctx.progress.completed.includes('junzi')) {
      await ctx.say([
        { who: NAMES.duo, text: '君子国可随时重游。镜花既已收好，唐兄只管看景、读牌、温习那桩买卖。' },
        { who: NAMES.tang, text: '一段见闻能回头再读，才知当时未必尽懂。' },
      ])
      return
    }
    await ctx.say([
      { who: NAMES.duo, text: '前方便是君子国。此国之人，好让不争，连做买卖都与别处相反。' },
      { who: NAMES.tang, text: '买卖相反？那倒要见识见识。' },
    ])
  },
}
