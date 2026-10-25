import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, type SceneDef } from '../chapter'
import { CHAPTERS } from '../story'
import { textTexture, villager } from '../stage'
import { addRegionalBanners, addRegionalCrown } from '../regional-architecture'

const M = CHAPTERS.heichi

const RIDDLES = [
  { q: '一口咬掉牛尾巴', options: ['告', '吉', '舌'], a: 0, why: '「牛」字去了尾巴，下面添一个「口」，正是「告」。' },
  { q: '半个月亮', options: ['朋', '胖', '望'], a: 1, why: '「月」加一个「半」，便是「胖」。' },
  { q: '一人一张口，口下长只手', options: ['拿', '合', '哈'], a: 0, why: '「人」「一」「口」合为「合」，下面一只「手」，便是「拿」。' },
]

/**
 * 黑齿国 — 才女如云. Duo Jiugong looks down on the dark-toothed people; the talented girls of the
 * academy set three lantern riddles. Solve them all to earn their respect.
 */
export const heichi: SceneDef = {
  id: 'heichi',
  palette: M.palette,
  models: ['duojiugong', 'heichi_red', 'heichi_purple', 'library_tower', 'riddle_rack', 'arch_bridge', 'willow', 'plant_bush', 'lily_large', 'flower_redA', 'canoe', 'rock_smallA'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(20, {
      seed: 61, roll: 0.2, wobble: 0.08,
      flats: [{ x: 0, z: -7, r: 4.5 }, { x: -9, z: 2, r: 1.8 }, { x: 8, z: -5, r: 1.8 }, { x: -4, z: 9, r: 1.8 }, { x: 7, z: 3, r: 3.6 }],
      paths: [[[0, 18], [-2, 11], [0, 3], [0, -4.7]], [[0, 4], [-9, 2]], [[0, 0], [8, -5]], [[-2, 11], [-4, 9]]],
      foliage: { form: 'wetland', density: 0.68, grassBase: '#3f715d', grassTip: '#83ae8f', flowers: ['#f3ead7', '#e48d8d'], flowerRatio: 0.07 },
    })
    const saved = ctx.checkpoint
    let accepted = saved.data.accepted === true
    let solved = saved.solved
    const answered = new Set<number>(Array.isArray(saved.data.answered) ? saved.data.answered.filter((i): i is number => typeof i === 'number' && i >= 0 && i < RIDDLES.length) : [])

    // The two-storey library dominates the north skyline; a small stele garden closes the west
    // path, while the pond and bridge own the east. Each route now ends in a different place.
    const library = await s.prop('library_tower', 0, 0, -8.2, { solid: true })
    if (library) {
      addRegionalCrown(s.scene, library, 'scroll')
      addRegionalBanners(s.scene, library, '#284f55', '#a58a54')
    }
    s.box(new THREE.Vector3(0, 0.02, -4.7), new THREE.Vector3(7.6, 0.04, 2.2), '#bcb6aa', { collide: false })
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('女学塾', { w: 300, h: 100, size: 60, bg: '#2e5e8c', fg: '#f3ead7' }), side: THREE.DoubleSide }))
    plaque.position.set(0, 3.4, -5.05)
    s.scene.add(plaque)
    for (let i = 0; i < 5; i += 1) {
      const x = -11 + (i % 3) * 1.65
      const z = 1.1 + Math.floor(i / 3) * 1.8
      s.box(new THREE.Vector3(x, 0.8, z), new THREE.Vector3(0.85, 1.6, 0.2), '#77766f')
      const inscription = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.15), new THREE.MeshBasicMaterial({ map: textTexture(['学', '思', '问', '辨', '行'][i], { w: 96, h: 160, size: 62, vertical: true, bg: '#77766f', fg: '#eee5cf' }) }))
      inscription.position.set(x, 0.88, z + 0.106)
      s.scene.add(inscription)
    }
    const hong = await ctx.npc({ name: '黎红薇', model: 'heichi_red', x: -0.9, z: -4.0, yaw: Math.PI, fallback: () => villager('#2e5e8c', { skin: '#bd9073', hat: '#2a2622', hatShape: 'bun', height: 1.55 }) })
    const zi = await ctx.npc({ name: '卢紫萱', model: 'heichi_purple', x: 0.9, z: -4.0, yaw: Math.PI, scale: 0.97, fallback: () => villager('#7b5ea7', { skin: '#b78a70', hat: '#2a2622', hatShape: 'bun', height: 1.5 }) })
    const academyFill = new THREE.PointLight('#fff0df', 30, 10, 2)
    academyFill.position.set(0, 2.5, -1.8)
    s.scene.add(academyFill)

    // A pond with lilies and a little bridge, lanterns around the garden.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshLambertMaterial({ color: '#5f8ea3' }))
    pond.rotation.x = -Math.PI / 2
    pond.position.set(7, 0.03, 3)
    s.scene.add(pond)
    for (let i = 0; i < 5; i += 1) await s.prop('lily_large', 7 + Math.cos(i * 1.3) * 2, 0.04, 3 + Math.sin(i * 1.3) * 2)
    await s.prop('arch_bridge', 7, 0, 3, { solid: true })

    // One crafted rack carries all three riddles; each lantern keeps its own interaction and saved state.
    await s.prop('riddle_rack', 0, 0, 0, { collider: 1.15 })
    const spots = [-0.77, 0, 0.77] as const
    spots.forEach((x, i) => {
      const glowMaterial = new THREE.MeshBasicMaterial({ color: answered.has(i) ? '#ffd76a' : '#a92f28' })
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glowMaterial)
      glow.position.set(x, 2.25, 0.34)
      s.scene.add(glow)
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.34), new THREE.MeshBasicMaterial({ map: textTexture('灯谜' + '一二三'[i], { w: 96, h: 128, size: 34, vertical: true, bg: '#f3ead7', fg: '#c8412f' }), side: THREE.DoubleSide }))
      tag.position.set(x, 1.23, 0.04)
      s.scene.add(tag)
      ctx.interact({
        // Interaction belongs in front of the lantern, never inside the rack's solid collider.
        pos: new THREE.Vector3(x, 0, 1.35), radius: 1.3, verb: '猜谜', name: `灯谜${'一二三'[i]}`, enabled: () => accepted && !answered.has(i),
        run: async () => {
          const r = RIDDLES[i]
          const pick = await ctx.choose('灯谜', `「${r.q}」——打一字`, r.options)
          if (pick === r.a) {
            answered.add(i)
            glowMaterial.color.set('#ffd76a')
            ctx.updateCheckpoint({ data: { answered: [...answered] } })
            ctx.sfx('pickup')
            await ctx.say([{ who: NAMES.narrator, text: `猜中了！${r.why}` }])
          } else {
            ctx.sfx('hurt')
            await ctx.say([{ who: NAMES.narrator, text: '灯笼轻轻一晃，似乎在说：不对。再想想字形如何拼合。' }])
          }
          plan()
        },
      })
    })

    ctx.interact({
      pos: hong.position, radius: 3, verb: '拜访', name: '二位才女', enabled: () => !solved,
      run: async () => {
        if (!accepted) {
          accepted = true
          ctx.updateCheckpoint({ data: { accepted: true } })
          await ctx.say([
            { who: NAMES.duo, text: '（小声）唐兄，此国人面黑齿黑，想来也没读过几本书，随意应付便是。' },
            { who: '黎红薇', text: '老先生方才的话，我们可都听见了。' },
            { who: '卢紫萱', text: '园中挂着三盏灯谜，客人若能尽数猜中，再来与我们谈学问不迟。' },
          ])
          plan()
          return
        }
        if (answered.size < 3) {
          await ctx.say([{ who: '卢紫萱', text: `三盏灯谜，客人才猜中${answered.size}盏呢。` }])
          return
        }
        solved = true
        ctx.updateCheckpoint({ solved: true })
        await ctx.say([
          { who: '黎红薇', text: '三谜尽中，客人果然是读书人。' },
          { who: NAMES.duo, text: '惭愧！老夫以貌取人，自以为见多识广，竟不如二位姑娘。' },
          { who: '卢紫萱', text: '老先生肯认，便是好学之人。这枚镜花，赠给二位。' },
        ])
        ctx.spawnFlower(new THREE.Vector3(0, 1.6, -3.5))
        ctx.objective('拾起二位才女面前的镜花', new THREE.Vector3(0, 1.6, -3.5))
      },
    })
    ctx.interact({
      pos: zi.position, radius: 1.6, verb: '交谈', name: '卢紫萱', enabled: () => solved,
      run: () => ctx.say([{ who: '卢紫萱', text: '学问不分男女，也不看黑白。愿客人一路顺风。' }]),
    })

    const plan = () => {
      if (solved) return
      if (!accepted) ctx.objective('去女学塾拜访才女', hong.root)
      else if (answered.size < 3) ctx.objective(`在园中找到灯谜，逐一猜中（${answered.size}/3）`, null)
      else ctx.objective('回女学塾见二位才女', hong.root)
    }
    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: solved ? '老夫这回是心服口服了。' : '猜字谜，要看字形拼合，不能只听字面。' }]),
    })
    await s.scatter(0, 0, 10.5, 16.5, 22, ['willow', 'plant_bush', 'flower_redA', 'rock_smallA'], 61, [{ x: 0, z: 14, r: 4 }, { x: 7, z: 3, r: 5 }, { x: 0, z: 0, r: 3 }], 0, true, [0.65, 1])
    const returnBoat = await dockAndReturn(ctx, 'heichi', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.duo, text: '面黑齿黑，腹中却有锦绣文章。老夫这把年纪，还要学一个道理——' },
      { who: NAMES.tang, text: `${M.moral}` },
    ])
    if (solved && !ctx.hasFlower) {
      const at = new THREE.Vector3(0, 1.6, -3.5)
      ctx.spawnFlower(at)
      ctx.objective('拾起二位才女面前的镜花', at)
    } else if (ctx.hasFlower) {
      ctx.objective('镜花已在囊中，回到岸边的小舟返航', returnBoat)
    } else {
      plan()
    }
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '黑齿国到了。此国之人，面色黝黑，连牙齿也是黑的。' },
      { who: NAMES.tang, text: '听说此国有一座女学塾，才女辈出，我们去拜访拜访。' },
    ])
  },
}
