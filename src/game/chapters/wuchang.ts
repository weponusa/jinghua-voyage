import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, lanternPosts, type SceneDef } from '../chapter'
import type { Npc } from '../npc'
import { CHAPTERS } from '../story'
import { villager } from '../stage'
import { addRegionalBanners, addRegionalCrown } from '../regional-architecture'

const M = CHAPTERS.wuchang

function bowl(): THREE.Group {
  const g = new THREE.Group()
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f3ead7', side: THREE.DoubleSide }))
  cup.rotation.x = Math.PI
  cup.position.y = 0.2
  const rice = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff' }))
  rice.position.y = 0.2
  const steam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }))
  steam.position.y = 0.48
  g.add(cup, rice, steam)
  return g
}

/**
 * 无肠国 — 食而即过. The rich man keeps the fresh rice and serves his servants leftovers. Tang Ao
 * carries the three fresh bowls to the hungry servants, then talks to the miser.
 */
export const wuchang: SceneDef = {
  id: 'wuchang',
  palette: M.palette,
  models: ['duojiugong', 'miser', 'servant', 'granny', 'elder', 'banquet_house', 'house', 'fence_simple', 'food_stove', 'amber_tree', 'stump_round', 'plant_bushLarge', 'mushroom_redGroup', 'canoe', 'pot_large', 'log'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(20, {
      seed: 41, roll: 0.2, wobble: 0.08,
      flats: [{ x: 0, z: -6, r: 4.8 }, { x: -7, z: 4, r: 4 }, { x: -12, z: 7, r: 3.2 }],
      paths: [[[0, 18], [0, 10], [-1, 3], [0, -3.2]], [[-1, 3], [-7, 4], [-11, 7]]],
      foliage: { form: 'scrub', density: 0.62, grassBase: '#746d45', grassTip: '#b09c62', flowers: ['#f3ead7', '#e7bd74'], flowerRatio: 0.06 },
    })
    const saved = ctx.checkpoint
    let talkedMiser = saved.data.talkedMiser === true
    let solved = saved.solved
    let carrying: THREE.Group | null = null
    const fed = new Set<Npc>()

    // The rich dine inside a walled mansion; the servants live down a separate rough lane.
    // Keeping these as two different spatial zones makes the quest readable before any dialogue.
    const mansion = await s.prop('banquet_house', 0, 0, -7.1, { solid: true })
    if (mansion) {
      addRegionalCrown(s.scene, mansion, 'ingot')
      addRegionalBanners(s.scene, mansion, '#9d3e30', '#c6a15a')
    }
    s.box(new THREE.Vector3(0, 0.025, -3.45), new THREE.Vector3(7.6, 0.05, 2.4), '#cbbda3', { collide: false })
    await s.prop('food_stove', -2.4, 0, -5.8, { collider: 0.75, scale: 0.85 })
    await s.prop('house', -12, 0, 6.7, { rotY: -Math.PI / 2, scale: 0.62, solid: true })
    await s.prop('house', -10.8, 0, 10.4, { rotY: -Math.PI * 0.7, scale: 0.46, solid: true })
    for (const [x, z] of [[-9.7, 7.2], [-8.2, 8.2], [-6.7, 8.8]] as const) {
      await s.prop('log', x, 0, z, { scale: 0.7, rotY: Math.PI / 2 })
    }
    // Keep the host on the front terrace rather than buried behind the mansion's banquet table.
    const miser = await ctx.npc({ name: '富翁', model: 'miser', x: 2.4, z: -3.9, yaw: Math.PI, fallback: () => villager('#c9b48a', { hat: '#5b3a26', height: 1.65 }) })

    const bowls: THREE.Group[] = []
    for (let i = 0; i < 3; i += 1) {
      const b = bowl()
      b.position.set(-0.7 + i * 0.7, 0.9, -5.8)
      s.scene.add(b)
      bowls.push(b)
      if (saved.data.carryingBowl === i) {
        carrying = b
        b.removeFromParent()
        b.position.set(0, 0.25, -0.45)
        ctx.player.root.add(b)
      }
      ctx.interact({
        pos: b.position, radius: 1.7, verb: '端起', name: '热饭', enabled: () => talkedMiser && !carrying && b.parent === s.scene,
        run: () => {
          carrying = b
          b.removeFromParent()
          b.position.set(0, 0.25, -0.45)
          ctx.player.root.add(b)
          ctx.sfx('ui')
          ctx.updateCheckpoint({ data: { carryingBowl: bowls.indexOf(b) } })
          plan()
        },
      })
    }
    // Pot of leftovers that keeps being reheated.
    await s.prop('pot_large', 2.2, 0, -5.4, { scale: 0.9 })

    const servants: Npc[] = []
    const spots = [[-7, 2], [-8.5, 4.5], [-5.4, 5.2]] as const
    for (const [i, [x, z]] of spots.entries()) {
      const npc = await ctx.npc({ name: ['小厮阿福', '厨娘', '老仆'][i], model: i === 1 ? 'granny' : i === 2 ? 'elder' : 'servant', x, z, yaw: Math.PI * 0.7, fallback: () => villager(['#8a7a5a', '#a07a6a', '#6a6a5a'][i], { height: [1.4, 1.5, 1.45][i], hatShape: i === 1 ? 'bun' : 'cap' }) })
      servants.push(npc)
      if (Array.isArray(saved.data.fed) && (saved.data.fed as number[]).includes(i)) {
        fed.add(npc)
        const b = bowls[i]
        b.removeFromParent()
        b.position.set(npc.position.x + 0.35, 0.95, npc.position.z - 0.3)
        s.scene.add(b)
      }
      ctx.interact({
        pos: npc.position, radius: 2.2, verb: () => (carrying && !fed.has(npc) ? '送饭' : '交谈'), name: npc.name, enabled: () => true,
        run: async () => {
          if (fed.has(npc)) {
            await ctx.say([{ who: npc.name, text: '饱了饱了，多谢客官！这辈子头一回吃上热饭。' }])
            return
          }
          if (!carrying) {
            await ctx.say([{ who: npc.name, text: talkedMiser ? '老爷的热饭……我们哪敢想。' : '饿……老爷说，剩饭热一热，还能再吃三顿。' }])
            return
          }
          const b = carrying
          carrying = null
          b.removeFromParent()
          b.position.set(npc.position.x + 0.35, 0.95, npc.position.z - 0.3)
          s.scene.add(b)
          fed.add(npc)
          ctx.updateCheckpoint({ data: { carryingBowl: -1, fed: servants.filter(n => fed.has(n)).map(n => servants.indexOf(n)) } })
          ctx.sfx('pickup')
          await ctx.say([{ who: npc.name, text: ['热的！是热的！', '这米真香……', '老朽谢过客官。'][servants.indexOf(npc)] }])
          plan()
        },
      })
    }

    ctx.interact({
      pos: new THREE.Vector3(2.2, 0, -5.4), radius: 2.1, verb: '查看剩饭', name: '食而复取', enabled: () => true,
      run: () => ctx.say([
        { who: NAMES.narrator, text: '锅里的剩饭又热了一遍，米粒已经散了，锅边却刮得干干净净。' },
        { who: '老仆', text: '老爷食过，我们取来再食；我们食过，他又收回去。如此食而复取，一碗饭不知要过多少人的口。' },
        { who: '小厮阿福', text: '什么滋味早不敢问了，能压住饿便好。' },
        { who: NAMES.tang, text: '省下一粒米本是好事，可不能拿别人的饥饱来省。' },
        { who: NAMES.duo, text: '节俭是不糟蹋东西；把别人该得的也扣下，就是刻薄了。' },
      ]),
    })

    ctx.interact({
      pos: miser.position, radius: 2.8, verb: '交谈', name: '富翁', enabled: () => !solved,
      run: async () => {
        if (!talkedMiser) {
          talkedMiser = true
          ctx.updateCheckpoint({ data: { talkedMiser: true } })
          await ctx.say([
            { who: '富翁', text: '客官有所不知，我国之人腹中无肠，饭一入口，转眼便穿肠而过。' },
            { who: '富翁', text: '所以嘛，吃过的饭，热一热，给下人再吃；下人吃过的，再热一热……一粒米能当三顿用！' },
            { who: '富翁', text: '桌上这三碗新饭？那是留着我自己下顿吃的，谁也别动。' },
            { who: NAMES.duo, text: '（低声）唐兄，那边三个下人已饿得站不稳了。' },
          ])
          plan()
          return
        }
        if (fed.size < 3) {
          await ctx.say([{ who: '富翁', text: '你……你端我的饭做什么！' }])
          return
        }
        await ctx.say([{ who: '富翁', text: '三碗新饭全给了下人！我、我岂不是亏大了？' }])
        for (;;) {
          const pick = await ctx.choose(NAMES.tang, '对富翁说——', [
            '饭到你肚里，不过穿肠而过；给了饥饿之人，才算真正用上',
            '你说得对，是我多事了',
            '你这吝啬鬼，活该饿着',
          ])
          if (pick === 0) break
          await ctx.say([{ who: '富翁', text: pick === 1 ? '那你赔我三碗饭来！' : '哼！我偏不听！' }, { who: NAMES.duo, text: '（低声）唐兄，与其责他，不如点醒他。' }])
        }
        solved = true
        ctx.updateCheckpoint({ solved: true })
        await ctx.say([
          { who: '富翁', text: '……穿肠而过，原来我省了一辈子，肚里却什么也没留下。' },
          { who: '富翁', text: '来人，再煮一锅新饭！大家……一起吃。' },
          { who: NAMES.narrator, text: '锅里腾起热气，热气中浮出一枚镜花。' },
        ])
        ctx.spawnFlower(new THREE.Vector3(0, 1.8, -4.6))
        ctx.objective('拾起饭桌前的镜花', new THREE.Vector3(0, 1.8, -4.6))
      },
    })

    const plan = () => {
      if (solved) return
      if (!talkedMiser) ctx.objective('去宴宅中与无肠国富翁交谈', miser.root)
      else if (carrying) ctx.objective(`把热饭送给饥饿的下人（${fed.size}/3）`, servants.find(n => !fed.has(n))?.root ?? null)
      else if (fed.size < 3) ctx.objective(`从桌上端起热饭，送给饥饿的下人（${fed.size}/3）`, bowls.find(b => b.parent === s.scene) ?? null)
      else ctx.objective('回到宴宅中，劝一劝富翁', miser.root)
    }

    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: '无肠国人吃得快，忘得也快。吝啬的人，大抵也是如此——到头来一场空。' }]),
    })
    await lanternPosts(s, [[-3, 2], [3, 2]], '#b0752f')
    await s.scatter(0, 0, 10, 16.5, 20, ['amber_tree', 'stump_round', 'plant_bushLarge', 'mushroom_redGroup', 'log'], 41, [{ x: 0, z: 14, r: 4 }, { x: -7, z: 4, r: 3.4 }], 0, true)
    const returnBoat = await dockAndReturn(ctx, 'wuchang', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.tang, text: '他省下的饭，一粒也没留住；分出去的饭，却换来一屋子笑声。' },
      { who: NAMES.duo, text: `是啊——${M.moral}` },
    ])
    ctx.onUpdate((_, t) => {
      for (const b of bowls) {
        const steam = b.children[2]
        if (steam) steam.position.y = 0.48 + ((t * 0.5 + b.position.x) % 0.3)
      }
    })
    if (solved && !ctx.hasFlower) {
      const at = new THREE.Vector3(0, 1.8, -4.6)
      ctx.spawnFlower(at)
      ctx.objective('拾起饭桌前的镜花', at)
    } else if (ctx.hasFlower) {
      ctx.objective('镜花已在囊中，回到岸边的小舟返航', returnBoat)
    } else {
      plan()
    }
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '无肠国到了。此国人腹中无肠，吃下去的东西，转眼就穿肠而过。' },
      { who: NAMES.tang, text: '那岂不是吃多少都不饱？' },
      { who: NAMES.duo, text: '正是。所以此国的富人，最是吝啬。唐兄去宴宅子里看看便知。' },
    ])
  },
}
