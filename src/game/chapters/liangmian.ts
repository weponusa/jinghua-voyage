import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, lanternPosts, type SceneDef } from '../chapter'
import type { Npc } from '../npc'
import { CHAPTERS } from '../story'
import { villager } from '../stage'
import { createLiangmianGate } from '../regional-architecture'

const M = CHAPTERS.liangmian

/** The hidden face drawn on canvas: a scowling second face, or just plain hair. */
function backTexture(evil: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = evil ? '#7a2d2a' : '#2a2622'
  g.beginPath()
  g.arc(64, 64, 60, 0, Math.PI * 2)
  g.fill()
  if (evil) {
    g.strokeStyle = '#f3ead7'
    g.lineWidth = 7
    g.lineCap = 'round'
    g.beginPath(); g.moveTo(26, 38); g.lineTo(54, 52); g.stroke()
    g.beginPath(); g.moveTo(102, 38); g.lineTo(74, 52); g.stroke()
    g.fillStyle = '#ffd35c'
    g.beginPath(); g.arc(42, 62, 8, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(86, 62, 8, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#1b1416'
    g.beginPath(); g.ellipse(64, 94, 26, 14, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f3ead7'
    for (const x of [46, 82]) { g.beginPath(); g.moveTo(x - 6, 84); g.lineTo(x + 6, 84); g.lineTo(x, 100); g.fill() }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

type Folk = { npc: Npc; evil: boolean; flap: THREE.Mesh; face: THREE.Mesh; seen: boolean; lift: number; greet: string }

/**
 * 两面国 — 巾后藏面. Four townsfolk all smile at Tang Ao. Walk behind them and the 浩然巾 lifts,
 * showing what is hidden there. Tell the gatekeeper which two are two-faced.
 */
export const liangmian: SceneDef = {
  id: 'liangmian',
  palette: M.palette,
  models: ['duojiugong', 'liangmian', 'elder', 'twin_screen', 'stern_cypress', 'bamboo', 'rock_tallB', 'plant_bush', 'canoe', 'grass_large', 'fence_simple'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(20, {
      seed: 31, roll: 0.18, wobble: 0.07,
      flats: [{ x: 0, z: -2, r: 7 }, { x: -3, z: 7.5, r: 2.4 }, { x: 0, z: 9.5, r: 3 }, { x: 0, z: -9, r: 3.8 }],
      paths: [[[0, 18], [0, 12], [0, 9.5], [0, 3], [0, -7.2]], [[-3, 7.5], [-6, 3], [-4, -2]], [[0, 1], [5, -1]], [[-5, 1], [-6, -5]], [[5, 1], [6, -5]]],
      foliage: { form: 'stern', density: 0.58, grassBase: '#716c4c', grassTip: '#b0a06b', flowers: ['#f3ead7', '#d7a98a'], flowerRatio: 0.055 },
    })
    const saved = ctx.checkpoint
    let solved = saved.solved

    const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshLambertMaterial({ color: '#d9c49a' }))
    plaza.rotation.x = -Math.PI / 2
    plaza.position.y = 0.02
    plaza.receiveShadow = true
    s.scene.add(plaza)
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(6.65, 7.05, 64), new THREE.MeshLambertMaterial({ color: '#b9a57f', side: THREE.DoubleSide }))
    outerRing.rotation.x = -Math.PI / 2
    outerRing.position.y = 0.035
    s.scene.add(outerRing)
    // A two-faced screen closes the northern end of the plaza. Its opposite reliefs echo the
    // walk-around rule without putting obstacles among the four observation spaces.
    await s.prop('twin_screen', 0, 0, -9.4, { solid: true })

    const specs: { name: string; x: number; z: number; yaw: number; evil: boolean; robe: string; greet: string }[] = [
      { name: '王员外', x: -4.2, z: -1.5, yaw: -Math.PI * 0.35, evil: false, robe: '#6f8fa8', greet: '远客辛苦！小地方没什么好招待的，喝碗茶再走。' },
      { name: '赵掌柜', x: -1.4, z: -4.6, yaw: -Math.PI * 0.1, evil: true, robe: '#c8412f', greet: '哎呀呀，贵客临门！瞧这一身气派，定是大富大贵之人，小的这厢有礼！' },
      { name: '钱秀才', x: 2.2, z: -4.2, yaw: Math.PI * 0.15, evil: true, robe: '#b0752f', greet: '久仰久仰！兄台一表人才，小弟见了，真是相见恨晚，相见恨晚！' },
      { name: '孙郎中', x: 4.6, z: -0.8, yaw: Math.PI * 0.4, evil: false, robe: '#3e8e7e', greet: '客官面色有些疲倦，海上风大，记得多喝热水。' },
    ]
    const folk: Folk[] = []
    for (const f of specs) {
      const npc = await ctx.npc({
        // Everyone wears the same 浩然巾 so looks alone never give the answer away.
        name: f.name, model: 'liangmian', x: f.x, z: f.z, yaw: f.yaw, lookAt: false,
        fallback: () => villager(f.robe, { hatShape: 'tall', hat: '#f3ead7', height: 1.7 }),
      })
      const tint = new THREE.Color(f.robe).lerp(new THREE.Color('#ffffff'), 0.12)
      npc.body.traverse(o => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const materials = Array.isArray(m.material) ? m.material : [m.material]
        let changed = false
        const tinted = materials.map(current => {
          if (!(current as THREE.MeshStandardMaterial).isMeshStandardMaterial) return current
          // Palette compression is disabled for this asset so these semantic names survive.
          if (!/^Liangmian \| (deep petrol|worn teal|ash linen)/.test(current.name)) return current
          const mat = (current as THREE.MeshStandardMaterial).clone()
          const trim = /worn teal|ash linen/.test(current.name)
          mat.color.copy(trim ? tint.clone().lerp(new THREE.Color('#eee5cf'), 0.38) : tint)
          changed = true
          return mat
        })
        if (!changed) return
        m.material = Array.isArray(m.material) ? tinted : tinted[0]
        m.userData.ownedMaterial = true
      })
      // Fit the rear head opening, not the sleeves: a small hinged cloth covers the hidden face.
      const height = npc.top - npc.root.position.y
      const r = THREE.MathUtils.clamp(height * 0.06, 0.095, 0.115)
      const head = npc.root.position.y + height * 0.88
      const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.78, 24), new THREE.MeshBasicMaterial({ map: backTexture(f.evil), transparent: true }))
      face.position.set(0, head, r * 0.96)
      const flapWidth = r * 1.72
      const flapHeight = r * 1.55
      const halfW = flapWidth / 2
      const halfH = flapHeight / 2
      const corner = r * 0.2
      const clothShape = new THREE.Shape()
      clothShape.moveTo(-halfW, halfH)
      clothShape.lineTo(halfW, halfH)
      clothShape.lineTo(halfW, -halfH + corner)
      clothShape.quadraticCurveTo(halfW, -halfH, halfW - corner, -halfH)
      clothShape.lineTo(-halfW + corner, -halfH)
      clothShape.quadraticCurveTo(-halfW, -halfH, -halfW, -halfH + corner)
      clothShape.closePath()
      const flap = new THREE.Mesh(new THREE.ShapeGeometry(clothShape), new THREE.MeshStandardMaterial({ color: '#303b3c', roughness: 0.92, side: THREE.DoubleSide }))
      flap.geometry.translate(0, -halfH, 0)
      flap.position.set(0, head + r * 0.96, r * 1.08)
      face.name = 'Hidden rear face'
      flap.name = 'Hinged浩然巾 back flap'
      npc.body.add(face, flap)
      folk.push({ npc, evil: f.evil, flap, face, seen: Array.isArray(saved.data.seen) && (saved.data.seen as string[]).includes(f.name), lift: 0, greet: f.greet })
      ctx.interact({
        pos: npc.position, radius: 2.2, verb: '交谈', name: f.name, enabled: () => true,
        run: () => ctx.say([{ who: f.name, text: f.greet }]),
      })
    }
    const seenCount = () => folk.filter(f => f.seen).length

    const keeper = await ctx.npc({ name: '守门老者', model: 'elder', x: -3, z: 7.5, yaw: Math.PI * 0.8, fallback: () => villager('#8a8070', { hat: '#c9a66b', hatShape: 'straw', height: 1.5 }) })
    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: '人前笑脸，谁都会摆。唐兄不妨绕到他们身后，悄悄瞧上一眼。' }]),
    })

    const names = specs.map(f => f.name)
    ctx.interact({
      pos: keeper.position, radius: 2.6, verb: '禀告', name: '守门老者', enabled: () => !solved,
      run: async () => {
        await ctx.say([{ who: '守门老者', text: '客人可看出来了？广场上那四位，哪两位是「两面人」？' }])
        if (seenCount() === 0) await ctx.say([{ who: NAMES.duo, text: '（低声）唐兄还没绕到他们背后看过呢。' }])
        const first = await ctx.choose(NAMES.tang, '第一位两面人是——', names)
        const rest = names.filter((_, i) => i !== first)
        const second = names.indexOf(rest[await ctx.choose(NAMES.tang, '第二位两面人是——', rest)])
        const right = specs[first].evil && specs[second].evil
        if (!right) {
          await ctx.say([{ who: '守门老者', text: '客人只看了笑脸罢？再到他们身后，掀开浩然巾瞧瞧。' }])
          return
        }
        solved = true
        for (const f of folk) if (f.evil) f.seen = true
        ctx.updateCheckpoint({ solved: true, data: { seen: folk.filter(f => f.seen).map(f => f.npc.name) } })
        await ctx.say([
          { who: '守门老者', text: '好眼力！那二位见了衣着光鲜的便满脸堆笑，见了穷人便换上巾后那张脸。' },
          { who: '守门老者', text: '客人不被笑脸所惑，这枚镜花，该归你。' },
        ])
        ctx.spawnFlower(new THREE.Vector3(-3, 1.6, 5.6))
        ctx.objective('拾起守门老者身前的镜花', new THREE.Vector3(-3, 1.6, 5.6))
      },
    })

    const plan = () => {
      if (solved) return
      const n = seenCount()
      ctx.objective(n < 4 ? `绕到广场四人身后，看清浩然巾下的面孔（${n}/4）` : '去村口告诉守门老者，谁是两面人', n < 4 ? null : keeper.root)
    }
    const tmp = new THREE.Vector3()
    ctx.onUpdate(dt => {
      const p = ctx.player.root.position
      for (const f of folk) {
        // Behind = the player is on the side the npc's back faces (its +Z axis in local space).
        tmp.copy(p).sub(f.npc.position).setY(0)
        const dist = tmp.length()
        const back = new THREE.Vector3(Math.sin(f.npc.body.rotation.y), 0, Math.cos(f.npc.body.rotation.y))
        const behind = dist < 3.6 && tmp.normalize().dot(back) > 0.45
        f.lift = THREE.MathUtils.damp(f.lift, behind ? 1 : 0, 8, dt)
        f.flap.rotation.x = -f.lift * 1.9
        if (behind && f.lift > 0.8 && !f.seen) {
          f.seen = true
          ctx.updateCheckpoint({ data: { seen: folk.filter(item => item.seen).map(item => item.npc.name) } })
          ctx.sfx(f.evil ? 'hurt' : 'ui')
          ctx.toast(f.evil ? `${f.npc.name}的巾后，竟是一张狰狞的脸！` : `${f.npc.name}的巾后，只是寻常发髻。`)
          plan()
        }
      }
    })

    const gate = createLiangmianGate()
    gate.position.set(0, s.groundHeight(0, 9.5), 9.5)
    s.scene.add(gate)
    for (const x of [-2.2, 2.2]) s.physics.addStaticCylinder(new THREE.Vector3(x, 1.5, 9.5), 0.3, 3)
    await lanternPosts(s, [[-6.5, -6], [6.5, -6], [-7.5, 2], [7.5, 2]], '#c8412f')
    await s.scatter(0, 0, 10, 16.5, 24, ['stern_cypress', 'bamboo', 'rock_tallB', 'plant_bush', 'grass_large'], 31, [{ x: 0, z: 14, r: 4 }, { x: -3, z: 7.5, r: 2.5 }, { x: 0, z: 9.5, r: 3 }], 0, true)
    const returnBoat = await dockAndReturn(ctx, 'liangmian', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.tang, text: '前面一张笑脸，后面一张恶脸。若不绕到背后，真看不出来。' },
      { who: NAMES.duo, text: '世上何尝没有两面国人？见富贵便谄，见贫贱便骄。' },
      { who: NAMES.duo, text: `所以——${M.moral}` },
    ])
    if (solved && !ctx.hasFlower) {
      const at = new THREE.Vector3(-3, 1.6, 5.6)
      ctx.spawnFlower(at)
      ctx.objective('拾起守门老者身前的镜花', at)
    } else if (ctx.hasFlower) {
      ctx.objective('镜花已在囊中，回到岸边的小舟返航', returnBoat)
    } else {
      plan()
    }
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '两面国到了。此国之人，个个头戴浩然巾，看着和颜悦色。' },
      { who: NAMES.duo, text: '只是听说，有的人巾后还藏着另一张脸。唐兄留神。' },
    ])
  },
}
