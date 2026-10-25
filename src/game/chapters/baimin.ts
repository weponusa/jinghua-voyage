import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, type SceneDef } from '../chapter'
import { CHAPTERS } from '../story'
import { textTexture, villager } from '../stage'
import { addRegionalBanners, addRegionalCrown } from '../regional-architecture'

const M = CHAPTERS.baimin

/** The teacher's misreadings. The first two are from chapter 22 of the novel. */
const ROUNDS = [
  { wrong: '切吾切，以反人之切。', right: '幼吾幼，以及人之幼。', src: '《孟子·梁惠王上》', options: ['幼吾幼，以及人之幼。', '切吾切，以及人之切。', '幼吾幼，以反人之幼。'] },
  { wrong: '永之兴柳兴。', right: '求之与，抑与之与？', src: '《论语·学而》', options: ['永之与，柳与之与？', '求之与，抑与之与？', '求之兴，抑兴之兴？'] },
  { wrong: '学而时刁之，不亦说乎。', right: '学而时习之，不亦说乎。', src: '《论语·学而》', options: ['学而时刀之，不亦悦乎。', '学而时习之，不亦说乎。', '学而时刁之，不亦乐乎。'] },
]

/**
 * 白民国 — 衣冠楚楚. A pompous teacher misreads the classics. Tang Ao finds three torn book pages
 * around the island, then corrects the teacher round by round.
 */
export const baimin: SceneDef = {
  id: 'baimin',
  palette: M.palette,
  models: ['duojiugong', 'scholar', 'child', 'academy_hall', 'desk_books', 'scholar_oak', 'flower_yellowA', 'stone_largeB', 'canoe', 'grass', 'stump_round'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(20, {
      seed: 51, roll: 0.2, wobble: 0.07,
      flats: [{ x: 0, z: -5, r: 5 }, { x: -11, z: 3, r: 1.6 }, { x: 10, z: -4, r: 1.6 }, { x: 6, z: 9, r: 1.6 }],
      paths: [[[0, 18], [1, 11], [0, 3], [0, -3.1]], [[0, 5], [-6, 4], [-11, 3]], [[0, 0], [6, -2], [10, -4]], [[1, 11], [6, 9]]],
      foliage: { form: 'academy', density: 0.76, grassBase: '#73927a', grassTip: '#b9cda6', flowers: ['#ffffff', '#f2d36b'] },
    })
    const saved = ctx.checkpoint
    let challenged = saved.data.challenged === true
    let solved = saved.solved
    let round = typeof saved.data.round === 'number' ? Math.max(0, Math.min(ROUNDS.length, Math.floor(saved.data.round))) : 0
    const pages = new Set<number>(Array.isArray(saved.data.pages) ? saved.data.pages.filter((i): i is number => typeof i === 'number' && i >= 0 && i < ROUNDS.length) : [])

    // A three-bay teaching hall and an open forecourt give the academy a clear interior,
    // threshold and outdoor study area instead of another roof on four posts.
    const academy = await s.prop('academy_hall', 0, 0, -6.6, { solid: true })
    if (academy) {
      addRegionalCrown(s.scene, academy, 'book')
      addRegionalBanners(s.scene, academy, '#e6e2d3', '#607e87')
    }
    s.box(new THREE.Vector3(0, 0.02, -2.9), new THREE.Vector3(10.5, 0.04, 3.4), '#ddd5c3', { collide: false })
    const teacher = await ctx.npc({ name: '塾师', model: 'scholar', x: 0, z: -6.6, yaw: Math.PI, fallback: () => villager('#f3f1ea', { hat: '#f3f1ea', hatShape: 'tall', skin: '#fbf3ea', height: 1.75 }) })
    await s.prop('desk_books', 0, 0, -5.6, { collider: 0.75 })
    await s.prop('desk_books', -4.4, 0, -1.5, { collider: 0.65, rotY: 0.25, scale: 0.85 })
    await s.prop('desk_books', 4.4, 0, -1.5, { collider: 0.65, rotY: -0.25, scale: 0.85 })
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('学海书院', { w: 300, h: 100, size: 58, bg: '#2a2622', fg: '#f3ead7' }), side: THREE.DoubleSide }))
    plaque.position.set(0, 3.6, -3.45)
    s.scene.add(plaque)

    const students = []
    for (let i = 0; i < 4; i += 1) {
      const st = await ctx.npc({ name: '学童', model: 'child', x: [-3.3, -1.5, 1.5, 3.3][i], z: -2.4, yaw: 0, scale: 0.88 + i * 0.025, lookAt: false, fallback: () => villager('#f3f1ea', { hat: '#2a2622', hatShape: 'bun', skin: '#fbf3ea', height: 1.1 }) })
      students.push(st)
    }
    ctx.interact({
      pos: students[1].position, radius: 2.4, verb: '交谈', name: '学童', enabled: () => true,
      run: () => ctx.say([{ who: '学童', text: solved ? '原来是「幼吾幼」！先生说明日从头教起。' : '先生教我们念「切吾切，以反人之切」……可是我总念不通。' }]),
    })

    // Three torn pages blowing around the island.
    const spots = [[-11, 3], [10, -4], [6, 9]] as const
    spots.forEach(([x, z], i) => {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshLambertMaterial({ map: textTexture(ROUNDS[i].right.replace(/[，。？]/g, ''), { w: 96, h: 128, size: 18, vertical: true, bg: '#f7f0dc', fg: '#2a2622' }), side: THREE.DoubleSide }))
      page.position.set(x, 0.8, z)
      s.scene.add(page)
      if (pages.has(i)) page.removeFromParent()
      s.spin(page, 1.2)
      ctx.interact({
        pos: page.position, radius: 1.8, verb: '拾起', name: '书页', enabled: () => page.parent !== null,
        run: async () => {
          page.removeFromParent()
          pages.add(i)
          ctx.updateCheckpoint({ data: { pages: [...pages] } })
          ctx.sfx('pickup')
          await ctx.say([{ who: NAMES.narrator, text: `一页残书，出自${ROUNDS[i].src}，上写：「${ROUNDS[i].right}」` }])
          plan()
        },
      })
    })

    ctx.interact({
      pos: teacher.position, radius: 2.8, verb: '请教', name: '塾师', enabled: () => !solved,
      run: async () => {
        if (!challenged) {
          challenged = true
          ctx.updateCheckpoint({ data: { challenged: true } })
          await ctx.say([
            { who: '塾师', text: '（摇头晃脑）切吾切——以反人之切——' },
            { who: NAMES.tang, text: '先生，这句恐怕念错了罢？' },
            { who: '塾师', text: '哼！我白民国衣冠楚楚，礼乐之邦，岂容外邦人指点？你若有本事，拿出书来对证！' },
            { who: NAMES.duo, text: '（低声）方才风大，岛上散落着几页残书，唐兄去寻来。' },
          ])
          plan()
          return
        }
        if (pages.size < 3) {
          await ctx.say([{ who: '塾师', text: `书呢？你才找到${pages.size}页，空口无凭！` }])
          return
        }
        for (const r of ROUNDS.slice(round)) {
          for (;;) {
            await ctx.say([{ who: '塾师', text: `（摇头晃脑）${r.wrong}` }])
            const pick = await ctx.choose(NAMES.tang, `据${r.src}，正文应是——`, r.options)
            if (r.options[pick] === r.right) {
              round += 1
              ctx.updateCheckpoint({ data: { round } })
              await ctx.say([{ who: '塾师', text: '这……这……书上确是如此。' }])
              break
            }
            await ctx.say([{ who: '塾师', text: '哈！你也念错了！' }, { who: NAMES.duo, text: '（低声）唐兄，照拾来的书页念。' }])
          }
        }
        solved = true
        ctx.updateCheckpoint({ solved: true })
        await ctx.say([
          { who: '塾师', text: '惭愧，惭愧。我穿得这般白净，原以为学问也是干干净净的……' },
          { who: NAMES.tang, text: '先生肯认错，便比装懂强百倍。' },
          { who: NAMES.narrator, text: '书案上，一枚镜花悄然显现。' },
        ])
        ctx.spawnFlower(new THREE.Vector3(0, 1.5, -4.6))
        ctx.objective('拾起书案前的镜花', new THREE.Vector3(0, 1.5, -4.6))
      },
    })

    const plan = () => {
      if (solved) return
      if (!challenged) ctx.objective('去书院听塾师讲书', teacher.root)
      else if (pages.size < 3) ctx.objective(`在岛上寻找被风吹散的书页（${pages.size}/3）`, null)
      else ctx.objective('拿着书页，回书院与塾师对证', teacher.root)
    }
    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: '白民国人衣冠如雪，最重体面。体面重了，便不肯认错。' }]),
    })
    await s.scatter(0, 0, 10, 16.5, 22, ['scholar_oak', 'stone_largeB', 'grass', 'stump_round'], 51, [{ x: 0, z: 14, r: 4 }, ...spots.map(([x, z]) => ({ x, z, r: 2 }))], 0, true)
    await s.scatter(0, 0, 3, 9, 8, ['flower_yellowA', 'grass'], 52, [{ x: 0, z: -5, r: 4 }])
    const returnBoat = await dockAndReturn(ctx, 'baimin', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.duo, text: '白民国的先生，衣冠是白的，书却念成了黑的。' },
      { who: NAMES.tang, text: `${M.moral}` },
    ])
    if (solved && !ctx.hasFlower) {
      const at = new THREE.Vector3(0, 1.5, -4.6)
      ctx.spawnFlower(at)
      ctx.objective('拾起书案前的镜花', at)
    } else if (ctx.hasFlower) {
      ctx.objective('镜花已在囊中，回到岸边的小舟返航', returnBoat)
    } else {
      plan()
    }
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '白民国到了。此国之人肤白如玉，衣冠整洁，看着都像饱学之士。' },
      { who: NAMES.duo, text: '书院里正有先生讲书，唐兄是探花出身，不妨去听听。' },
    ])
  },
}
