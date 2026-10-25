import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, type SceneDef } from '../chapter'
import { CHAPTERS } from '../story'
import { lantern, villager } from '../stage'

const M = CHAPTERS.daren
const RAINBOW = ['#f28b82', '#fbbc04', '#fff475', '#ccff90', '#a7ffeb', '#aecbfa', '#d7aefb']
const GREY = new THREE.Color('#c9c9c9')
const BLACK = new THREE.Color('#2f2f35')

/** A puffy cloud of spheres whose colour reflects the heart: grey → rainbow, or → black. */
function cloud(scale = 1): { group: THREE.Group; tint: (good: number, bad: number) => void } {
  const group = new THREE.Group()
  const puffs: THREE.MeshLambertMaterial[] = []
  for (let i = 0; i < 7; i += 1) {
    const mat = new THREE.MeshLambertMaterial({ color: GREY, emissive: '#ffffff', emissiveIntensity: 0.08 })
    const a = (i / 7) * Math.PI * 2
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 10, 8), mat)
    p.position.set(Math.cos(a) * 0.42 * scale, 0, Math.sin(a) * 0.42 * scale)
    p.scale.y = 0.6
    group.add(p)
    puffs.push(mat)
  }
  const tint = (good: number, bad: number) => {
    puffs.forEach((m, i) => {
      const c = GREY.clone().lerp(new THREE.Color(RAINBOW[i]), good)
      c.lerp(BLACK, bad)
      m.color.copy(c)
    })
  }
  return { group, tint }
}

/**
 * 大人国 — 云随心生. Three small moral choices around the island colour the cloud that appears
 * under Tang Ao's feet. The Great Man at the cloud bridge receives only a guest on a rainbow cloud.
 * Unkind choices can be taken back (回头是岸): talk to the person again.
 */
export const daren: SceneDef = {
  id: 'daren',
  palette: M.palette,
  models: ['duojiugong', 'daren', 'official', 'granny', 'child', 'oilseller', 'cloud_gate', 'peach_tree', 'sky_palm', 'flower_purpleA', 'flower_yellowA', 'plant_bushLarge', 'canoe', 'stone_tallC'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(20, {
      seed: 21, roll: 0.22, wobble: 0.08,
      flats: [{ x: -8, z: 4, r: 2.4 }, { x: 6.2, z: 8.6, r: 2 }, { x: 7, z: -2, r: 2 }, { x: -11, z: -5, r: 2 }],
      paths: [[[0, 18], [0, 11], [-2, 4], [-3, -1], [0, -5]], [[-2, 4], [-8, 4]], [[0, 10], [6, 9]], [[-3, -1], [-11, -5]], [[-2, 2], [7, -2]]],
      foliage: { form: 'cloud', density: 0.72, grassBase: '#628b7d', grassTip: '#b1cfb2', flowers: ['#f6efe0', '#d7aefb', '#aecbfa'] },
    })
    const saved = ctx.checkpoint
    const deed = (value: unknown): 0 | 1 | -1 => value === 1 ? 1 : value === -1 ? -1 : 0
    const deeds: Record<'fruit' | 'kite' | 'purse', 0 | 1 | -1> = { fruit: deed(saved.data.fruit), kite: deed(saved.data.kite), purse: deed(saved.data.purse) }
    const good = () => Object.values(deeds).filter(v => v === 1).length
    const bad = () => Object.values(deeds).filter(v => v === -1).length
    let received = saved.solved

    const mine = cloud()
    mine.group.position.y = -0.95
    ctx.player.root.add(mine.group)
    const refresh = () => mine.tint(good() / 3, bad() / 3)
    refresh()

    // A cloud gate and an open ceremonial terrace replace the generic hilltop pavilion. The
    // approach stays on the central axis while the cloud banks make the summit read from afar.
    s.island(0, -9, 6, 1.2, { fence: false, sand: false })
    for (let i = 0; i < 4; i += 1) {
      const top = (i + 1) * 0.3
      s.box(new THREE.Vector3(0, top / 2, -0.8 - i * 0.55), new THREE.Vector3(2.2, top, 0.6), '#cfc4ad')
    }
    await s.prop('cloud_gate', 0, 1.2, -5.7, { rotY: Math.PI, scale: 0.88 })
    for (const [x, z, scale] of [[-4.4, -7.5, 2.2], [4.4, -7.5, 2.2], [-3.3, -12, 1.8], [3.3, -12, 1.8]] as const) {
      const bank = cloud(scale)
      bank.tint(0.75, 0)
      bank.group.position.set(x, 1.35, z)
      s.scene.add(bank.group)
      s.spin(bank.group, x < 0 ? 0.08 : -0.08)
    }
    const great = await ctx.npc({ name: '大人国长者', model: 'daren', x: 0, y: 1.2, z: -8.6, yaw: 0, fallback: () => villager('#7b5ea7', { height: 2.4, hatShape: 'bun' }) })
    const greatCloud = cloud(1.6)
    greatCloud.tint(1, 0)
    greatCloud.group.position.set(0, 1.25, -8.6)
    s.scene.add(greatCloud.group)

    // The official who hides his cloud under red silk (from the novel).
    const official = await ctx.npc({ name: '官员', model: 'official', x: 7, z: -2, yaw: -Math.PI / 2, fallback: () => villager('#8c2f2f', { hatShape: 'tall', height: 1.75 }) })
    const silk = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.35, 14), new THREE.MeshLambertMaterial({ color: '#c8412f' }))
    silk.position.set(7, 0.15, -2)
    s.scene.add(silk)
    ctx.interact({
      pos: official.position, radius: 2.4, verb: '交谈', name: '官员', enabled: () => true,
      run: () => ctx.say([
        { who: '官员', text: '咳咳，本官脚下这红绫？不过是……防尘，防尘而已。' },
        { who: NAMES.duo, text: '（低声）此国官员若心术不正，足下生出乌云，便用红绫遮着，自以为旁人看不见。' },
      ]),
    })

    // 1. Old woman with spilled fruit.
    const granny = await ctx.npc({ name: '老婆婆', model: 'granny', x: -8, z: 4, yaw: Math.PI / 2, fallback: () => villager('#8a6f5a', { hat: '#e8e2d2', hatShape: 'bun', height: 1.45 }) })
    const fruits: THREE.Mesh[] = []
    for (let i = 0; i < 6; i += 1) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshLambertMaterial({ color: i % 2 ? '#e0763c' : '#d6403a' }))
      f.position.set(-7 + Math.cos(i * 1.7) * 1.1, 0.14, 4.6 + Math.sin(i * 1.7) * 0.9)
      fruits.push(f)
      s.scene.add(f)
    }
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.35, 12, 1, true), new THREE.MeshLambertMaterial({ color: '#b08850', side: THREE.DoubleSide }))
    basket.position.set(-7.2, 0.18, 3.6)
    basket.rotation.z = deeds.fruit === 1 ? 0 : 1.3
    s.scene.add(basket)
    if (deeds.fruit === 1) fruits.forEach(f => f.removeFromParent())
    ctx.interact({
      pos: granny.position, radius: 2.6, verb: '上前', name: '老婆婆', enabled: () => deeds.fruit !== 1,
      run: async () => {
        await ctx.say([{ who: '老婆婆', text: deeds.fruit === -1 ? '后生，你方才不是走开了么？哎哟，我这老腰……' : '哎哟，篮子翻了，果子滚了一地，我这老腰弯不下去……' }])
        const pick = await ctx.choose(NAMES.tang, '要怎么做？', ['蹲下帮婆婆拾起果子', '赶路要紧，绕道而行'])
        deeds.fruit = pick === 0 ? 1 : -1
        if (pick === 0) {
          fruits.forEach(f => f.removeFromParent())
          basket.rotation.z = 0
        }
        refresh()
        ctx.updateCheckpoint({ data: { fruit: deeds.fruit } })
        ctx.sfx(pick === 0 ? 'pickup' : 'hurt')
        await ctx.say([pick === 0
          ? { who: '老婆婆', text: '好心的后生！快看你脚下的云——又添了几分颜色。' }
          : { who: NAMES.narrator, text: '唐敖转身走开，脚下的云彩暗了一暗。' }
        ])
      },
    })

    // 2. Child whose kite is caught in a tree.
    await s.prop('peach_tree', 8, 0, 7, { collider: 0.6, scale: 1.15 })
    const kite = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), new THREE.MeshLambertMaterial({ color: '#2e5e8c' }))
    kite.rotation.set(Math.PI / 2, 0, 0.6)
    kite.position.set(8.4, 4.2, 6.6)
    if (deeds.kite === 1) {
      kite.position.set(6.6, 1.1, 8.2)
      kite.rotation.set(0.2, 0, 0)
    }
    s.scene.add(kite)
    const child = await ctx.npc({ name: '孩童', model: 'child', x: 6.2, z: 8.6, yaw: -Math.PI * 0.6, fallback: () => villager('#e0a44a', { hat: '#2a2622', hatShape: 'bun', height: 1.1 }) })
    ctx.interact({
      pos: child.position, radius: 2.4, verb: '上前', name: '孩童', enabled: () => deeds.kite !== 1,
      run: async () => {
        await ctx.say([{ who: '孩童', text: '呜呜……我的风筝挂到树上去了，够不着……' }])
        const pick = await ctx.choose(NAMES.tang, '要怎么做？', ['踮脚替他把风筝取下', '笑他笨手笨脚', '与我何干，走开'])
        deeds.kite = pick === 0 ? 1 : -1
        if (pick === 0) {
          kite.position.set(6.6, 1.1, 8.2)
          kite.rotation.set(0.2, 0, 0)
        }
        refresh()
        ctx.updateCheckpoint({ data: { kite: deeds.kite } })
        ctx.sfx(pick === 0 ? 'pickup' : 'hurt')
        await ctx.say([{ who: '孩童', text: pick === 0 ? '谢谢叔叔！叔叔的云彩，像我的风筝一样好看！' : pick === 1 ? '呜……你的云，变黑了！' : '……' }])
      },
    })

    // 3. A purse on the road, and its owner searching nearby.
    const purse = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshLambertMaterial({ color: '#c9a045' }))
    purse.scale.set(1, 0.8, 1)
    purse.position.set(-3, 0.16, -1)
    s.scene.add(purse)
    if (deeds.purse !== 0 || saved.data.carryingPurse === true) purse.removeFromParent()
    ;(purse.userData as { carry?: boolean }).carry = saved.data.carryingPurse === true && deeds.purse === 0
    const owner = await ctx.npc({ name: '卖油郎', model: 'oilseller', x: -11, z: -5, yaw: Math.PI / 2, fallback: () => villager('#5c7f5a', { hatShape: 'straw', hat: '#c9a66b' }) })
    ctx.interact({
      pos: purse.position, radius: 1.8, verb: '拾起', name: '钱袋', enabled: () => deeds.purse === 0 && purse.parent !== null,
      run: async () => {
        await ctx.say([{ who: NAMES.narrator, text: '路边一只沉甸甸的钱袋，四下无人。' }])
        const pick = await ctx.choose(NAMES.tang, '这钱袋……', ['寻访失主，原物奉还', '四下无人，揣进怀里'])
        purse.removeFromParent()
        if (pick === 1) deeds.purse = -1
        if (pick === 0) {
          ctx.objective('把钱袋还给正在寻找它的卖油郎', owner.root)
          ;(purse.userData as { carry?: boolean }).carry = true
          ctx.updateCheckpoint({ data: { purse: deeds.purse, carryingPurse: true } })
        } else {
          refresh()
          ctx.updateCheckpoint({ data: { purse: -1, carryingPurse: false } })
          ctx.sfx('hurt')
          await ctx.say([{ who: NAMES.narrator, text: '钱袋入怀，脚下的云彩却像泼了墨。' }])
          setObjective()
        }
      },
    })
    ctx.interact({
      pos: owner.position, radius: 2.4, verb: '交谈', name: '卖油郎', enabled: () => deeds.purse !== 1,
      run: async () => {
        const carrying = (purse.userData as { carry?: boolean }).carry === true
        if (carrying || deeds.purse === -1) {
          const pick = deeds.purse === -1
            ? await ctx.choose(NAMES.tang, '卖油郎正焦急地四处寻找钱袋。', ['回心转意，把钱袋还他', '装作不知'])
            : 0
          if (pick === 0) {
            deeds.purse = 1
            ;(purse.userData as { carry?: boolean }).carry = false
            refresh()
            ctx.sfx('pickup')
            ctx.updateCheckpoint({ data: { purse: 1, carryingPurse: false } })
            await ctx.say([{ who: '卖油郎', text: '这是我一家老小一月的饭钱！恩公，请受我一拜！' }])
            setObjective()
          }
          return
        }
        await ctx.say([{ who: '卖油郎', text: '我的钱袋！方才明明系在腰间，客官可曾见到？' }])
      },
    })

    const setObjective = () => {
      if (received) return
      if ((purse.userData as { carry?: boolean }).carry === true) ctx.objective('把钱袋还给正在寻找它的卖油郎', owner.root)
      else if (good() === 3) ctx.objective('脚踏彩云，穿过云门拜见大人国长者', great.root)
      else ctx.objective(`岛上有人需要帮忙：老婆婆、孩童、路上的钱袋（彩云 ${good()}/3）`, null)
    }
    ctx.interact({
      pos: great.position, radius: 3, verb: '拜见', name: '大人国长者', enabled: () => !received,
      run: async () => {
        if (good() < 3) {
          const left = [deeds.fruit !== 1 && '老婆婆', deeds.kite !== 1 && '孩童', deeds.purse !== 1 && '钱袋'].filter(Boolean).join('、')
          await ctx.say([
            { who: '大人国长者', text: bad() > 0 ? '客人足下云色晦暗，想是心中尚有亏欠之事。' : '客人足下之云，尚是灰白一片。' },
            { who: '大人国长者', text: `云由心生，非人力可以染就。去罢——${left}，还在等着你。` },
          ])
          return
        }
        received = true
        ctx.updateCheckpoint({ solved: true })
        await ctx.say([
          { who: '大人国长者', text: '好一朵彩云！客人心地光明，云色便遮也遮不住。' },
          { who: '大人国长者', text: '我国之人，足下云彩随心而变，行善者彩，作恶者黑，红绫也掩不住。此镜花，赠与客人。' },
        ])
        ctx.spawnFlower(new THREE.Vector3(0, 2.6, -7))
        ctx.objective('拾起长者面前的镜花', new THREE.Vector3(0, 2.6, -7))
      },
    })

    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: `唐兄脚下的云彩，如今是${good() === 3 ? '七彩祥云' : bad() > good() ? '乌云一团' : '淡淡几分颜色'}。` }]),
    })

    for (const [x, z] of [[-3, 4], [3, 4], [-5, -4], [5, -4]] as const) {
      const l = lantern('#7b5ea7')
      l.position.set(x, 2.4, z)
      s.scene.add(l)
      s.spin(l, 0.6)
    }
    await s.scatter(0, 0, 11, 16.5, 22, ['sky_palm', 'plant_bushLarge', 'flower_purpleA', 'flower_yellowA', 'stone_tallC'], 21, [{ x: 0, z: 14, r: 4 }, { x: 8, z: 7, r: 3 }, { x: -8, z: 4, r: 2.5 }, { x: -11, z: -5, r: 2 }, { x: 7, z: -2, r: 2 }], 0, true)
    await s.scatter(0, 0, 2, 9, 10, ['flower_purpleA', 'flower_yellowA'], 22, [{ x: 0, z: -9, r: 6.5 }, { x: -3, z: -1, r: 1.5 }])
    const returnBoat = await dockAndReturn(ctx, 'daren', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.duo, text: '大人国的云，长在脚下，却是从心里生出来的。' },
      { who: NAMES.tang, text: '那位官员用红绫遮云，遮得住旁人的眼，遮不住自己的心。' },
      { who: NAMES.duo, text: `正是——${M.moral}` },
    ])
    ctx.onUpdate((_, t) => {
      mine.group.rotation.y = t * 0.5
      greatCloud.group.rotation.y = -t * 0.3
      kite.position.y += deeds.kite === 1 ? 0 : Math.sin(t * 2) * 0.002
    })
    if (received && !ctx.hasFlower) {
      const at = new THREE.Vector3(0, 2.6, -7)
      ctx.spawnFlower(at)
      ctx.objective('拾起长者面前的镜花', at)
    } else if (ctx.hasFlower) {
      ctx.objective('镜花已在囊中，回到岸边的小舟返航', returnBoat)
    } else {
      setObjective()
    }
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '大人国到了。唐兄看，此国人人脚下都踩着一朵云。' },
      { who: NAMES.tang, text: '咦？我脚下也生出一朵灰云来了！' },
      { who: NAMES.duo, text: '云随心生。唐兄在岛上行事如何，云便是何颜色。长者只见脚踏彩云之人。' },
    ])
  },
}
