import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, lanternPosts, linSpec, type Ctx, type SceneDef } from '../chapter'
import { instance } from '../models'
import type { CheckpointValue } from '../progress'
import { textTexture, villager } from '../stage'

type Phase = 'market' | 'palace' | 'river' | 'escape' | 'done'
type Actor = 'tangao' | 'linzhiyang'
type Clue = 'loom' | 'ledger' | 'official'
type GateId = 'source' | 'divide' | 'canal'
type Point = { x: number; z: number }

const PALETTE = { sky: '#b9cedd', horizon: '#efd5cf', fog: '#c5d2cf', water: '#397e88', grass: '#718f7d', sand: '#d8c1a4', accent: '#9c5268' }
const MARKET = { x: -5, z: 7 }
const PALACE = { x: -12, z: -12 }
const NOTICE = { x: 1, z: -3 }
const RIVER_SIGNAL = { x: 6, z: -7 }
const PALACE_SIGNAL = { x: -18, z: -16 }
const WEST_GATE = { x: -19, z: -12 }
const MEETING = { x: -8, z: -6 }
const LOOM = { x: -15, z: -14 }
const LEDGER = { x: -9, z: -14 }
const OFFICIAL = { x: -12, z: -9.5 }
const GATE_ORDER: GateId[] = ['source', 'divide', 'canal']
const GATES: Record<GateId, Point & { name: string }> = {
  source: { x: 11, z: -5, name: '源水闸' },
  divide: { x: 14, z: 0, name: '分水闸' },
  canal: { x: 11, z: 5, name: '归漕闸' },
}
const CLUES: Clue[] = ['loom', 'ledger', 'official']

function validPhase(value: CheckpointValue | undefined): Phase {
  return value === 'palace' || value === 'river' || value === 'escape' || value === 'done' ? value : 'market'
}

function actorFor(phase: Phase): Actor {
  return phase === 'palace' || phase === 'escape' ? 'linzhiyang' : 'tangao'
}

function numberData(value: CheckpointValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** An open, roofless work court: readable as an interior without trapping the follow camera. */
function workCourt(ctx: Ctx, at: Point, width: number, depth: number, color: string, label: string): void {
  const s = ctx.stage
  const y = s.groundHeight(at.x, at.z)
  s.box(new THREE.Vector3(at.x, y + 0.035, at.z), new THREE.Vector3(width, 0.07, depth), color, { collide: false })
  const plaster = '#e7d6c5'
  for (const dx of [-width / 2, width / 2]) {
    s.box(new THREE.Vector3(at.x + dx, y + 0.42, at.z), new THREE.Vector3(0.22, 0.84, depth), plaster)
  }
  s.box(new THREE.Vector3(at.x, y + 0.42, at.z - depth / 2), new THREE.Vector3(width, 0.84, 0.22), plaster)
  for (const dx of [-width / 2 + 0.25, width / 2 - 0.25]) {
    for (const dz of [-depth / 2 + 0.25, depth / 2 - 0.25]) {
      s.box(new THREE.Vector3(at.x + dx, y + 1.55, at.z + dz), new THREE.Vector3(0.16, 3.1, 0.16), '#854f61')
    }
  }
  const lintel = s.box(new THREE.Vector3(at.x, y + 2.85, at.z - depth / 2 + 0.25), new THREE.Vector3(width, 0.16, 0.24), '#854f61', { collide: false })
  lintel.castShadow = true
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.48), new THREE.MeshBasicMaterial({ map: textTexture(label, { w: 240, h: 80, size: 52, bg: '#81495b', fg: '#f7ead8' }), side: THREE.DoubleSide }))
  sign.position.set(at.x, y + 2.4, at.z - depth / 2 + 0.38)
  s.scene.add(sign)
}

function makeLoom(ctx: Ctx, at: Point): THREE.Group {
  const y = ctx.stage.groundHeight(at.x, at.z)
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#6f4a3b', roughness: 0.9 })
  for (const x of [-0.85, 0.85]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.65, 0.12), wood)
    post.position.set(x, 0.825, 0)
    g.add(post)
  }
  for (const h of [0.35, 1.45]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.16), wood)
    beam.position.y = h
    g.add(beam)
  }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.85), new THREE.MeshStandardMaterial({ color: '#b7687e', roughness: 0.95, side: THREE.DoubleSide }))
  cloth.position.y = 0.9
  g.add(cloth)
  for (let i = 0; i < 9; i += 1) {
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.05, 4), new THREE.MeshBasicMaterial({ color: '#ead9b7' }))
    thread.position.set(-0.65 + i * 0.16, 0.9, 0.025)
    g.add(thread)
  }
  g.position.set(at.x, y, at.z)
  ctx.stage.scene.add(g)
  return g
}

function makeSluice(ctx: Ctx, id: GateId): { group: THREE.Group; slab: THREE.Mesh; wheel: THREE.Mesh; at: THREE.Vector3 } {
  const spec = GATES[id]
  const s = ctx.stage
  const y = s.groundHeight(spec.x, spec.z)
  const g = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: '#9c9b91', roughness: 0.95 })
  const wood = new THREE.MeshStandardMaterial({ color: '#684d3d', roughness: 0.9 })
  for (const x of [-1.45, 1.45]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.7, 0.65), stone)
    post.position.set(x, 1.35, 0)
    g.add(post)
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 0.75), stone)
  beam.position.y = 2.65
  g.add(beam)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.55, 0.22), wood)
  slab.position.y = 0.78
  g.add(slab)
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 6, 18), new THREE.MeshStandardMaterial({ color: '#a67a45', roughness: 0.75 }))
  wheel.position.set(0, 1.85, 0.45)
  g.add(wheel)
  g.position.set(spec.x, y, spec.z)
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  s.scene.add(g)
  return { group: g, slab, wheel, at: new THREE.Vector3(spec.x, y, spec.z + 1.75) }
}

/**
 * 女儿国：同一座岛上的双视角叙事。宫内段操控林之洋，宫外段操控唐敖；两条信息链
 * 在西水门会合。所有关键动作即时写入 checkpoint，重建时恢复角色、阶段和位置。
 */
export const nver: SceneDef = {
  id: 'nver',
  palette: PALETTE,
  models: ['tangao', 'linzhiyang', 'duojiugong', 'official', 'baihua', 'seller', 'buyer', 'market_stall', 'banquet_house', 'paifang', 'desk_books', 'peach_tree', 'willow', 'bamboo', 'rock_smallA', 'flower_purpleA', 'lantern_post', 'small_boat', 'canoe'],
  spawn: new THREE.Vector3(0, 1.2, 24),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(30, {
      seed: 73, roll: 0.12, wobble: 0.065,
      flats: [
        { ...MARKET, r: 7 }, { ...PALACE, r: 9 }, { ...NOTICE, r: 3 }, { ...RIVER_SIGNAL, r: 2.5 },
        { ...MEETING, r: 3 }, ...Object.values(GATES).map(g => ({ x: g.x, z: g.z, r: 3.2 })),
      ],
      paths: [
        [[0, 27], [0, 18], [-4, 12], [-5, 7], [-2, 1], [1, -3]],
        [[-5, 7], [-8, 1], [-8, -6], [-12, -9], [-12, -12], [-18, -12]],
        [[-12, -12], [-15, -14], [-18, -16]],
        [[1, -3], [6, -7], [11, -5], [14, 0], [11, 5], [5, 7], [-5, 7]],
      ],
      pathWidth: 2.6,
      foliage: { form: 'garden', density: 0.64, grassBase: '#5e8172', grassTip: '#9fb9a0', flowers: ['#f1d6df', '#eee3c4', '#c99ab5'], flowerRatio: 0.075 },
    })

    const saved = ctx.checkpoint
    let phase: Phase = saved.solved ? 'done' : validPhase(saved.data.phase)
    let actor = actorFor(phase)
    let accepted = saved.data.accepted === true
    let petitioned = saved.data.petitioned === true
    const clues = new Set<Clue>(Array.isArray(saved.data.clues) ? saved.data.clues.filter((v): v is Clue => typeof v === 'string' && (CLUES as string[]).includes(v)) : [])
    const rawOpened = Array.isArray(saved.data.opened) ? saved.data.opened : []
    const opened: GateId[] = []
    for (const id of GATE_ORDER) {
      if (rawOpened[opened.length] !== id) break
      opened.push(id)
    }
    if (opened.length > 0) accepted = true

    const ground = (p: Point) => new THREE.Vector3(p.x, s.groundHeight(p.x, p.z), p.z)
    const spawnAt = (p: Point) => ground(p).add(new THREE.Vector3(0, 0.9, 0))
    const save = (patch: Record<string, CheckpointValue> = {}) => {
      const p = ctx.player.position
      ctx.updateCheckpoint({ data: { phase, actor, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, ...patch } })
    }

    // A pale canal crosses the eastern district. It is scenery over walkable ground; the three
    // mechanisms and their approach points never require jumping or walking through deep water.
    const waterMat = new THREE.MeshStandardMaterial({ color: '#579aa0', roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.88 })
    for (const [x, z, rot, len] of [[11, -5, 0.2, 6], [13, 0, -0.35, 6], [11, 5, 0.25, 6]] as const) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.3, len), waterMat)
      strip.rotation.x = -Math.PI / 2
      strip.rotation.z = rot
      strip.position.set(x, s.groundHeight(x, z) + 0.045, z)
      s.scene.add(strip)
    }

    // Market buildings frame, rather than obstruct, the central road.
    for (const [x, z, r] of [[-10, 8, 0.2], [-5, 2.5, 0], [0, 8, -0.25]] as const) {
      await s.prop('market_stall', x, 'ground', z, { rotY: r, solid: true })
    }
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.8, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9c5b6', roughness: 0.96 }))
    plaza.position.set(MARKET.x, s.groundHeight(MARKET.x, MARKET.z) + 0.025, MARKET.z)
    plaza.receiveShadow = true
    s.scene.add(plaza)

    // The palace occupies a separate rose-stone quarter. Two open work courts and a west service
    // gate remain physically connected to the exterior road.
    await s.prop('banquet_house', -12, 'ground', -20, { solid: true })
    await s.prop('paifang', -9, 'ground', -8, { rotY: -Math.PI / 4 })
    workCourt(ctx, { x: -15, z: -13.7 }, 5.2, 5.2, '#cdaab0', '织房')
    workCourt(ctx, { x: -9, z: -13.7 }, 5.2, 5.2, '#c5b39f', '账房')
    makeLoom(ctx, LOOM)
    await s.prop('desk_books', LEDGER.x, 'ground', LEDGER.z, { collider: 0.45 })
    for (const z of [-13.2, -10.8]) s.box(new THREE.Vector3(-19, s.groundHeight(-19, z) + 1.4, z), new THREE.Vector3(0.5, 2.8, 0.35), '#b58483')
    const gateBeamY = Math.max(s.groundHeight(-19, -13.2), s.groundHeight(-19, -10.8)) + 2.8
    s.box(new THREE.Vector3(-19, gateBeamY, -12), new THREE.Vector3(0.65, 0.35, 2.4), '#854f61', { collide: false })
    const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.48), new THREE.MeshBasicMaterial({ map: textTexture('西水门', { w: 240, h: 80, size: 52, bg: '#e4cfba', fg: '#713e50' }), side: THREE.DoubleSide }))
    gateSign.position.set(-18.64, gateBeamY - 0.45, -12)
    gateSign.rotation.y = Math.PI / 2
    s.scene.add(gateSign)

    const noticeY = s.groundHeight(NOTICE.x, NOTICE.z)
    const noticeBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.15), new THREE.MeshBasicMaterial({ map: textTexture('治河黄榜', { w: 256, h: 180, size: 48, bg: '#d6b65f', fg: '#663c32' }), side: THREE.DoubleSide }))
    noticeBoard.position.set(NOTICE.x, noticeY + 1.45, NOTICE.z)
    s.scene.add(noticeBoard)
    for (const dx of [-0.65, 0.65]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.8, 6), new THREE.MeshLambertMaterial({ color: '#684d3d' }))
      post.position.set(NOTICE.x + dx, noticeY + 0.9, NOTICE.z - 0.04)
      s.scene.add(post)
    }

    // Bamboo speaking-tubes bind the two viewpoints together.
    for (const p of [PALACE_SIGNAL, RIVER_SIGNAL]) {
      const y = s.groundHeight(p.x, p.z)
      for (let i = 0; i < 3; i += 1) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6 + i * 0.22, 8), new THREE.MeshStandardMaterial({ color: '#7b8c59', roughness: 0.9 }))
        pipe.position.set(p.x + (i - 1) * 0.28, y + 0.8, p.z)
        pipe.rotation.z = (i - 1) * 0.08
        s.scene.add(pipe)
      }
    }

    const marketLin = await ctx.npc(linSpec(-4, 7, Math.PI * 0.8))
    const reunionLin = await ctx.npc({ ...linSpec(MEETING.x - 0.8, MEETING.z, -Math.PI / 2), collider: false })
    const official = await ctx.npc({ name: '女官文绮', model: 'official', x: OFFICIAL.x, z: OFFICIAL.z, yaw: Math.PI, fallback: () => villager('#8e526a', { hatShape: 'bun', height: 1.72 }) })
    const queen = await ctx.npc({ name: '女儿国女王', model: 'baihua', x: -16, z: -9.2, yaw: -Math.PI / 2, fallback: () => villager('#a45c78', { hat: '#c9a045', hatShape: 'bun', height: 1.82 }) })
    const marketeer = await ctx.npc({ name: '女市令', model: 'seller', x: -6.4, z: 8.6, yaw: 0, fallback: () => villager('#567e76', { hatShape: 'bun' }) })
    const embroiderer = await ctx.npc({ name: '绣坊男工', model: 'buyer', x: -8, z: 5.4, yaw: -Math.PI / 2, fallback: () => villager('#79859b', { height: 1.68 }) })
    const duo = await ctx.npc(duoSpec(2.2, 18, Math.PI))
    marketLin.root.visible = phase === 'market'
    reunionLin.root.visible = phase === 'done'

    const gateObjects = GATE_ORDER.map(id => makeSluice(ctx, id))
    const refreshGates = () => {
      gateObjects.forEach((g, i) => {
        const open = opened.includes(GATE_ORDER[i]!)
        g.slab.position.y = open ? 2.05 : 0.78
        g.wheel.rotation.z = open ? Math.PI * 0.75 : 0
      })
    }
    refreshGates()

    let returnBoat: THREE.Object3D | null = null
    const plan = () => {
      if (phase === 'market') ctx.objective('与林之洋一同察看女儿国街市', marketLin.root)
      else if (phase === 'palace') {
        if (clues.size < 3) ctx.objective(`林之洋：观察织房、核对账货、询问女官（线索 ${clues.size}/3）`, null)
        else ctx.objective('林之洋：到织房西窗，以竹管向宫外发信', ground(PALACE_SIGNAL))
      } else if (phase === 'river') {
        if (!accepted) ctx.objective('唐敖：到城外揭黄榜，查明河患与宫中旧规', ground(NOTICE))
        else if (opened.length < 3) ctx.objective(`唐敖：依黄榜依次启闸（${opened.length}/3）`, gateObjects[opened.length]!.at)
        else ctx.objective('唐敖：到河工竹管回信，与林之洋约定西水门', ground(RIVER_SIGNAL))
      } else if (phase === 'escape') {
        if (!petitioned) ctx.objective('林之洋：合并三条线索，向女官提出自救与出宫方案', official.root)
        else ctx.objective('林之洋：亲自穿过西水门，唐敖在门外接应', ground(WEST_GATE))
      } else ctx.objective('二人已经会合：回南岸小舟，结束女儿国一程', returnBoat ?? new THREE.Vector3(0, 0, 25))
    }

    const applyActor = async (next: Actor) => {
      // A fresh clone protects the cached formal Tang Ao GLB and its skeleton from other viewpoints.
      const model = await instance(next)
      ctx.player.setModel(model ?? villager(next === 'tangao' ? '#3d6fa3' : '#b0652f', { hatShape: 'tall', height: next === 'tangao' ? 1.78 : 1.72 }))
    }
    const switchTo = async (next: Phase, at: Point, message: string) => {
      const nextActor = actorFor(next)
      await applyActor(nextActor)
      phase = next
      actor = nextActor
      const destination = spawnAt(at)
      ctx.player.teleport(destination)
      ctx.player.facing = next === 'palace' || next === 'escape' ? Math.PI : 0
      ctx.setSpawn(destination)
      marketLin.root.visible = phase === 'market'
      reunionLin.root.visible = phase === 'done'
      save()
      ctx.toast(message)
      plan()
    }

    const discover = async (clue: Clue, lines: { who: string; text: string }[]) => {
      if (!clues.has(clue)) {
        clues.add(clue)
        save({ clues: [...clues] })
        ctx.sfx('pickup')
        ctx.toast(`脱身线索 ${clues.size}/3`)
      }
      await ctx.say(lines)
      plan()
    }

    // 1. The market establishes inverted public roles without treating either sex as incapable.
    ctx.interact({
      pos: marketLin.position, radius: 2.5, verb: '同行', name: '林之洋', enabled: () => phase === 'market',
      run: async () => {
        await ctx.say([
          { who: NAMES.lin, text: '唐兄你看，掌市、修堤、跑船的都是女子；纺绣、育儿、守内账的反多是男子。' },
          { who: NAMES.tang, text: '分工与别处倒置，倒不必笑谁。只是若把一种分工变成人人都逃不得的命数，便该问了。' },
          { who: '女市令', text: '外邦这位林客人，女王有请。宫籍已备，随仪从入宫罢。' },
          { who: NAMES.lin, text: '我只来贩货，并未应许长留！唐兄——' },
          { who: NAMES.narrator, text: '仪从以王命收住去路。唐敖被拦在宫外，林之洋则被带往织房旁的宫院。' },
        ])
        await switchTo('palace', { x: -12, z: -11.5 }, '视角切换 · 林之洋（宫内织房）')
        await ctx.say([
          { who: NAMES.narrator, text: '几日来，窄鞋与束衣限制了步履，习礼的更次一再催促。林之洋只说：这些规矩，也该容人说一个“不”字。' },
          { who: NAMES.lin, text: '硬闯只会连累旁人。这里有织房、账房和往来女官，我先把可用的路找齐。' },
        ])
      },
    })
    ctx.interact({
      pos: marketeer.position, radius: 2.4, verb: '交谈', name: '女市令', enabled: () => phase === 'market',
      run: () => ctx.say([
        { who: '女市令', text: '我管市价，也管河道工期。街市不靠“女子天生该如何”，靠的是各人把差事做好。' },
        { who: NAMES.tang, text: '那么男子若愿外出营商，女子若愿守家纺织，也当由得他们？' },
        { who: '女市令', text: '这……旧例写得少，众人便忘了还能另选。' },
      ]),
    })
    ctx.interact({
      pos: embroiderer.position, radius: 2.3, verb: '交谈', name: '绣坊男工', enabled: () => phase === 'market',
      run: () => ctx.say([{ who: '绣坊男工', text: '我喜欢绣花，也靠它养家。旁人笑不笑随他；怕的是不许选，只把“本分”二字压在所有人头上。' }]),
    })

    // 2a. Observation: the speaking tube and its signal.
    ctx.interact({
      pos: ground(LOOM).add(new THREE.Vector3(0, 0, 1.35)), radius: 2.1, verb: '观察', name: '织机与竹管', enabled: () => phase === 'palace',
      run: () => discover('loom', [
        { who: NAMES.narrator, text: '织机声掩不住墙外水响。西窗下第三截竹管通河工望楼，管旁刻着“三短一长，急信复答”。' },
        { who: NAMES.lin, text: '第一条路有了：不必喊破宫墙，也能把消息送到唐敖手里。' },
      ]),
    })

    // 2b. Goods and bookkeeping: 32 - 8 - 12 = 12, while only six remain on the shelf.
    ctx.interact({
      pos: ground(LEDGER).add(new THREE.Vector3(0, 0, 1.3)), radius: 2.1, verb: '核账', name: '防水绸货账', enabled: () => phase === 'palace',
      run: async () => {
        if (clues.has('ledger')) {
          await ctx.say([{ who: NAMES.lin, text: '签簿已核清：另有六匹防水绸从西水门旧货道送往河工，货道能容一人通过。' }])
          return
        }
        const pick = await ctx.choose(NAMES.lin, '进货三十二匹，宫用八匹，河工领十二匹；账面现存应是几匹？', ['六匹', '十二匹', '二十匹'])
        if (pick !== 1) {
          await ctx.say([{ who: NAMES.lin, text: '三十二先减八、再减十二，不能只看河工那一笔。重算一回。' }])
          return
        }
        await discover('ledger', [
          { who: NAMES.lin, text: '账面该余十二匹，货架却只有六匹。不是丢了——另有一张六匹的补领单。' },
          { who: NAMES.narrator, text: '补领单写明“由西水门旧货道直送河工”。这条供防水绸出入的窄道，今日仍未封死。' },
        ])
      },
    })

    // 2c. Dialogue: the official is bound by office, but records dissent and explains a lawful route.
    ctx.interact({
      pos: official.position, radius: 2.6, verb: () => phase === 'escape' ? '陈策' : '交谈', name: '女官文绮', enabled: () => phase === 'palace' || phase === 'escape',
      run: async () => {
        if (phase === 'palace') {
          await discover('official', [
            { who: '女官文绮', text: '女王重你的商旅才干，以为尊荣可偿离乡之苦；但未问愿否，终究不是愿。未改例前，我不能私放你。' },
            { who: '女官文绮', text: '我能做的是停用那些整饰身形的旧礼，把你的异议记入宫簿。城外黄榜又写明：献治河良策者，准入宫当面陈词，内宫不得阻断。' },
            { who: NAMES.lin, text: '好。你把我的话记上，我自己把策拿出来。强留不是一句“恩典”就能抹平的。' },
          ])
          return
        }
        if (petitioned) {
          await ctx.say([{ who: '女官文绮', text: '放行文书已送到西水门。你自己走出去，我在宫簿上记“本人请行”，不是谁的恩赐。' }])
          return
        }
        const pick = await ctx.choose(NAMES.lin, '河工回信已到。怎样把三条线索合成可执行的离宫之策？', [
          '请女官偷藏我于货箱，不必声张',
          '呈西水门货账与竹管回信，依黄榜陈治河策，请开门由唐敖接应',
          '毁掉宫籍，趁夜翻墙离宫',
        ])
        if (pick !== 1) {
          await ctx.say([{ who: '女官文绮', text: '这会把帮你的人推入罪责，也解不开“宫籍不得自出”的根。把公开黄榜、货道和接应证据合在一起，再来。' }])
          return
        }
        petitioned = true
        save({ petitioned: true })
        await ctx.say([
          { who: NAMES.lin, text: '账簿证明西水门可通，竹管证明外援已到。我愿把河工货道的积弊一并写清，但陈策之后，请依本人意愿放行。' },
          { who: '女儿国女王', text: '朕原以名分、供养能补你离乡，今日才知未问本人愿否，尊荣也可能成为拘禁。准你陈策，也准你去。' },
          { who: '女官文绮', text: '臣请一并复核“入宫即不得自出”的旧例，往后须本人画押，并留申诉与退出之路。' },
          { who: '女儿国女王', text: '准议。河道要疏，人的去路也不该堵。文绮，你亲送文书到西水门。' },
        ])
        ctx.toast('自救方案获准 · 西水门文书已送达')
        plan()
      },
    })

    // Lin initiates contact; the river line only becomes available after all three clues converge.
    ctx.interact({
      pos: ground(PALACE_SIGNAL), radius: 2.2, verb: '发信', name: '西窗竹管', enabled: () => phase === 'palace' && clues.size === 3,
      run: async () => {
        await ctx.say([
          { who: NAMES.lin, text: '三短一长。唐敖若听见，就该去揭黄榜；我这里有西水门货账，也有当面陈策的凭据。' },
          { who: NAMES.narrator, text: '竹管把轻叩送向宫外。片刻后，唐敖在河工望楼听见回音。' },
        ])
        await switchTo('river', { x: 1, z: -1 }, '视角切换 · 唐敖（宫外黄榜）')
      },
    })

    // 3. The public notice supplies the mechanism order and a lawful reason to cooperate.
    ctx.interact({
      pos: ground(NOTICE), radius: 2.4, verb: '揭榜', name: '治河黄榜', enabled: () => phase === 'river' && !accepted,
      run: async () => {
        accepted = true
        save({ accepted: true, opened: [] })
        await ctx.say([
          { who: NAMES.narrator, text: '黄榜：春水壅城，募懂漕运者同修。启闸须“先疏源，次分势，末归漕”，依次启源水、分水、归漕三闸，错序则全部落闸。' },
          { who: '女官文绮', text: '（竹管回音）献策者准入宫陈词。林客人会带着账簿在西水门等你的复信。' },
          { who: NAMES.tang, text: '治河不是替他换自由的条件，是眼下该做的公事；他能自己走出来，才是正理。' },
        ])
        plan()
      },
    })

    gateObjects.forEach((gate, index) => {
      const id = GATE_ORDER[index]!
      ctx.interact({
        pos: gate.at, radius: 2.1, verb: '启闸', name: GATES[id].name,
        enabled: () => phase === 'river' && accepted && opened.length < 3 && !opened.includes(id),
        run: async () => {
          const expected = GATE_ORDER[opened.length]
          if (id !== expected) {
            opened.length = 0
            refreshGates()
            save({ opened: [] })
            ctx.sfx('hurt')
            await ctx.say([{ who: NAMES.narrator, text: '水声骤急，三闸联动落板。须照黄榜从源水闸重新开始：源水 → 分水 → 归漕。' }])
            plan()
            return
          }
          opened.push(id)
          refreshGates()
          save({ opened: [...opened] })
          ctx.sfx('pickup')
          await ctx.say([{ who: NAMES.narrator, text: `${GATES[id].name}升起，第${opened.length}段水势渐稳。` }])
          if (opened.length === 3) ctx.toast('三闸已通 · 河工竹管可以回信')
          plan()
        },
      })
    })

    ctx.interact({
      pos: ground(RIVER_SIGNAL), radius: 2.3, verb: '回信', name: '河工竹管', enabled: () => phase === 'river' && opened.length === 3,
      run: async () => {
        save({ linked: true })
        await ctx.say([
          { who: NAMES.tang, text: '三短一长。三闸已通；我携黄榜副本到西水门外接应。你带上账簿，亲自向女官陈策。' },
          { who: NAMES.lin, text: '（回音）货道、黄榜、外援都齐了。这一回，不是我等你来救，是我们各走一段，在门口会合。' },
        ])
        await switchTo('escape', { x: -12, z: -11.5 }, '视角切换 · 林之洋（宫内自救）')
      },
    })

    // 4. Lin must walk through the gate himself; only then does control return to Tang outside.
    ctx.interact({
      pos: ground(WEST_GATE), radius: 2.3, verb: '出宫', name: '西水门', enabled: () => phase === 'escape' && petitioned,
      run: async () => {
        await ctx.say([
          { who: '女官文绮', text: '文书核验无误。林客人，宫籍争议已记，今日由你自己迈过这道门。' },
          { who: NAMES.lin, text: '我带走的是自己的货账与去路。旧例复核之后，也望后来人不必再靠一场河患才能说“不愿”。' },
        ])
        await switchTo('done', MEETING, '视角切换 · 唐敖（西水门外接应）')
        ctx.updateCheckpoint({ solved: true })
        await ctx.say([
          { who: NAMES.tang, text: '林兄，货账可带齐了？三闸水势已稳，回舟的路也通了。' },
          { who: NAMES.lin, text: '带齐了。你在宫外疏河，我在宫内找路、陈策，少哪一段都到不了这里。' },
          { who: '女儿国女王', text: '（宫门内）文绮，把今日所议列入朝会。治河要顺水势，立制也当给人留转圜。' },
          { who: NAMES.narrator, text: '二人并肩离开西水门。此事不产镜花，只留下一份已经落笔的改例议单。' },
        ])
        plan()
      },
    })

    ctx.interact({
      pos: queen.position, radius: 2.4, verb: '交谈', name: '女儿国女王', enabled: () => phase === 'escape' && !petitioned,
      run: () => ctx.say([
        { who: '女儿国女王', text: '朕要保住宫中秩序，也确曾以为王命所赐就是福分。你若只来求朕开恩，仍是由朕决定你的去留。' },
        { who: NAMES.lin, text: '那便不只求恩。我会拿账、拿黄榜、拿可实行的办法，把“我是否愿意”摆到制度面前。' },
      ]),
    })
    ctx.interact({
      pos: reunionLin.position, radius: 2.5, verb: '交谈', name: '林之洋', enabled: () => phase === 'done',
      run: () => ctx.say([{ who: NAMES.lin, text: '走罢。窄鞋束衣不是最难受的，最难受的是旁人说“你该知足”。如今路在自己脚下了。' }]),
    })
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => actor === 'tangao',
      run: () => ctx.say([{ who: NAMES.duo, text: phase === 'done' ? '林老弟自己争来出宫之路，唐兄在外接住他。女王肯复议旧例，也是把权柄往回收了一寸。' : phase === 'river' ? '黄榜写着启闸次序。先源水，再分水，后归漕；千万别抢着开下游。' : '此处女主外、男主内。新奇的是分工，要紧的是谁有资格决定自己的分工。' }]),
    })

    for (const [x, z, key] of [[-19, -7, 'bamboo'], [-18, -19, 'peach_tree'], [-5, -17, 'willow'], [18, 4, 'willow'], [16, -9, 'bamboo'], [4, 11, 'peach_tree'], [-14, 10, 'peach_tree']] as const) {
      await s.prop(key, x, 'ground', z, { collider: 0.45, scale: key === 'bamboo' ? 0.8 : 0.9 })
    }
    await s.scatter(0, 0, 19, 25, 15, ['rock_smallA', 'flower_purpleA'], 73, [{ x: 0, z: 24, r: 4 }], 0, false, [0.6, 1])
    await lanternPosts(s, [[-7, 11], [-2, 11], [-8, -4], [-10, -7], [4, -5], [8, -4], [13, 3]], '#b75a70')

    returnBoat = await dockAndReturn(ctx, 'nver', new THREE.Vector3(0, 0, 31), [
      { who: NAMES.duo, text: '女儿国这一程，没有镜花，却有一纸复议旧例的议单。' },
      { who: NAMES.lin, text: '不是女王一味恶，也不是女官都能私自做主。权柄落在制度里，旁人便容易被一句“恩典”困住。' },
      { who: NAMES.tang, text: '好在林兄自救有策，宫外有人接应，掌权者也肯听一句“不愿”。分工可异，去留当由本人。' },
    ])

    // dockAndReturn normally owns the beach spawn. A checkpoint must override it only afterwards,
    // so a refresh in the palace never respawns Lin on the outer beach as Tang.
    const hasSavedView = typeof saved.data.phase === 'string' || saved.solved
    if (hasSavedView) {
      const expectedActor = actorFor(phase)
      actor = expectedActor
      await applyActor(actor)
      const x = numberData(saved.data.x)
      const z = numberData(saved.data.z)
      const defaults: Record<Phase, Point> = {
        market: MARKET,
        palace: { x: -12, z: -11.5 },
        river: NOTICE,
        escape: { x: -12, z: -11.5 },
        done: MEETING,
      }
      const restored = x !== null && z !== null && Math.hypot(x, z) < 27 ? new THREE.Vector3(x, 0, z) : ground(defaults[phase])
      restored.y = s.groundHeight(restored.x, restored.z) + 0.9
      ctx.setSpawn(restored)
      ctx.toast(`进度恢复 · ${actor === 'linzhiyang' ? '林之洋（宫内）' : '唐敖（宫外）'}`)
    }
    marketLin.root.visible = phase === 'market'
    reunionLin.root.visible = phase === 'done'
    refreshGates()
    plan()
  },
  async start(ctx) {
    if (ctx.checkpoint.data.intro === true || ctx.checkpoint.solved) return
    ctx.updateCheckpoint({ data: { intro: true } })
    await ctx.say([
      { who: NAMES.duo, text: '前方女儿国，女子主外、男子主内，街市与宫闱的分工同别处相反。唐兄与林老弟只管去看，别忙着以别处规矩断人。' },
      { who: NAMES.lin, text: '我带货，唐兄带眼睛。看看人家怎样过日子，也看看哪些规矩容不得人说不。' },
    ])
  },
}
