import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, lanternPosts, type SceneDef } from '../chapter'
import type { Npc } from '../npc'
import { CHAPTERS } from '../story'
import { pavilionFallback, villager } from '../stage'

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
  models: ['duojiugong', 'wuchang', 'pavilion', 'tree_palmTall', 'tree_palmBend', 'plant_bushLarge', 'mushroom_redGroup', 'canoe', 'pot_large', 'log'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.island(0, 0, 18)
    let talkedMiser = false
    let solved = false
    let carrying: THREE.Group | null = null
    const fed = new Set<Npc>()

    await s.prop('pavilion', 0, 0, -6, { fallback: pavilionFallback })
    s.box(new THREE.Vector3(0, 0.45, -6), new THREE.Vector3(2.4, 0.9, 1.2), '#7a5034')
    const miser = await ctx.npc({ name: '富翁', model: 'wuchang', x: 0, z: -7.4, yaw: Math.PI, fallback: () => villager('#c9b48a', { hat: '#5b3a26', height: 1.65 }) })

    const bowls: THREE.Group[] = []
    for (let i = 0; i < 3; i += 1) {
      const b = bowl()
      b.position.set(-0.7 + i * 0.7, 0.9, -5.8)
      s.scene.add(b)
      bowls.push(b)
      ctx.interact({
        pos: b.position, radius: 1.7, verb: '端起', name: '热饭', enabled: () => talkedMiser && !carrying && b.parent === s.scene,
        run: () => {
          carrying = b
          b.removeFromParent()
          b.position.set(0, 0.25, -0.45)
          ctx.player.root.add(b)
          ctx.sfx('ui')
          plan()
        },
      })
    }
    // Pot of leftovers that keeps being reheated.
    await s.prop('pot_large', 2.2, 0, -5.4, { scale: 0.9 })

    const servants: Npc[] = []
    const spots = [[-7, 2], [-8.5, 4.5], [-5.4, 5.2]] as const
    for (const [i, [x, z]] of spots.entries()) {
      const npc = await ctx.npc({ name: ['小厮阿福', '厨娘', '老仆'][i], x, z, yaw: Math.PI * 0.7, fallback: () => villager(['#8a7a5a', '#a07a6a', '#6a6a5a'][i], { height: [1.4, 1.5, 1.45][i], hatShape: i === 1 ? 'bun' : 'cap' }) })
      servants.push(npc)
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
          ctx.sfx('pickup')
          await ctx.say([{ who: npc.name, text: ['热的！是热的！', '这米真香……', '老朽谢过客官。'][servants.indexOf(npc)] }])
          plan()
        },
      })
    }

    ctx.interact({
      pos: miser.position, radius: 2.8, verb: '交谈', name: '富翁', enabled: () => !solved,
      run: async () => {
        if (!talkedMiser) {
          talkedMiser = true
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
      if (!talkedMiser) ctx.objective('去亭中与无肠国富翁交谈', miser.root)
      else if (carrying) ctx.objective(`把热饭送给饥饿的下人（${fed.size}/3）`, servants.find(n => !fed.has(n))?.root ?? null)
      else if (fed.size < 3) ctx.objective(`从桌上端起热饭，送给饥饿的下人（${fed.size}/3）`, bowls.find(b => b.parent === s.scene) ?? null)
      else ctx.objective('回到亭中，劝一劝富翁', miser.root)
    }

    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: '无肠国人吃得快，忘得也快。吝啬的人，大抵也是如此——到头来一场空。' }]),
    })
    await lanternPosts(s, [[-3, 2], [3, 2]], '#b0752f')
    await s.scatter(0, 0, 10, 16.5, 20, ['tree_palmTall', 'tree_palmBend', 'plant_bushLarge', 'mushroom_redGroup', 'log'], 41, [{ x: 0, z: 14, r: 4 }, { x: -7, z: 4, r: 3.4 }], 0, true)
    await dockAndReturn(ctx, 'wuchang', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.tang, text: '他省下的饭，一粒也没留住；分出去的饭，却换来一屋子笑声。' },
      { who: NAMES.duo, text: `是啊——${M.moral}` },
    ])
    ctx.onUpdate((_, t) => {
      for (const b of bowls) {
        const steam = b.children[2]
        if (steam) steam.position.y = 0.48 + ((t * 0.5 + b.position.x) % 0.3)
      }
    })
    plan()
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '无肠国到了。此国人腹中无肠，吃下去的东西，转眼就穿肠而过。' },
      { who: NAMES.tang, text: '那岂不是吃多少都不饱？' },
      { who: NAMES.duo, text: '正是。所以此国的富人，最是吝啬。唐兄去亭子里看看便知。' },
    ])
  },
}
