import * as THREE from 'three'
import { NAMES, dockAndReturn, lanternPosts, type SceneDef } from '../chapter'
import { CHAPTERS } from '../story'
import { lantern, textTexture, villager } from '../stage'

const M = CHAPTERS.qishe

const MEDICINE = [
  { name: '青蒿', verb: '采药', note: '叶背泛白，正是方中所需的青蒿。' },
  { name: '金银花', verb: '采药', note: '黄白相间的金银花，还带着药圃的香气。' },
  { name: '药方', verb: '拾取', note: '失落的药方找到了，剂量与煎法都写在背面。' },
] as const
const MEDICINE_SPOTS = [[-12, 5.8], [-9.2, 9], [-4.8, 5.5]] as const

const PHONICS = [
  {
    mark: '听', verb: '听音', name: '音韵台·听音',
    question: '听先生念「坡（pō）」。哪一个字的声母与它相同？',
    options: ['八（bā）', '泼（pō）', '妈（mā）'], answer: 1,
    right: '「坡」与「泼」的声母都是 p。先听声母，再辨字音。',
    hint: '把三个字的起音分开念，听听哪一个也是 p。',
  },
  {
    mark: '调', verb: '辨调', name: '音韵台·辨调',
    question: '同一串字母，声调不同，字义也不同。哪一个是去声？',
    options: ['mā（妈）', 'má（麻）', 'mǎ（马）', 'mà（骂）'], answer: 3,
    right: '去声由高落下，「mà」正是去声。',
    hint: '阴平、阳平、上声、去声，逐一听它的升降。',
  },
  {
    mark: '排', verb: '排字', name: '音韵台·排字',
    question: '把声母与带调韵母排好，怎样拼出「花（huā）」？',
    options: ['h — uā', 'uā — h', 'h — áu'], answer: 0,
    right: '先排声母 h，再接带调韵母 uā，便读作 huā。',
    hint: '先找声母，再接带调韵母，顺序不能颠倒。',
  },
] as const
const PHONIC_X = [-2.2, 0, 2.2] as const

const RIDDLES = [
  {
    tag: '画谜', name: '花灯·画谜', question: '远看山有色，近听水无声。春去花还在，人来鸟不惊。',
    options: ['画', '诗', '梦'], answer: 0, right: '山水花鸟都停在眼前，却是一幅「画」。',
  },
  {
    tag: '果谜', name: '花灯·果谜', question: '麻屋子，红帐子，里面住着白胖子。打一食物。',
    options: ['莲子', '花生', '核桃'], answer: 1, right: '麻壳是屋子，红衣是帐子，白胖子正是「花生」。',
  },
  {
    tag: '哑谜', name: '花灯·哑谜', question: '灯上不题字，只画一人把自己的灯递给后来人。打二字。',
    options: ['借光', '传灯', '灭火'], answer: 1, right: '把灯递下去，是「传灯」；把学问教下去，也是传灯。',
  },
] as const
const LANTERN_SPOTS = [[7.2, -1.6], [10, -4.4], [7.2, -7.2]] as const

function herbPlant(leafColor: string): THREE.Group {
  const g = new THREE.Group()
  const stemMat = new THREE.MeshLambertMaterial({ color: '#57734a' })
  const leafMat = new THREE.MeshLambertMaterial({ color: leafColor })
  for (let i = 0; i < 5; i += 1) {
    const a = i / 5 * Math.PI * 2
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.55, 5), stemMat)
    stem.position.set(Math.cos(a) * 0.12, 0.28, Math.sin(a) * 0.12)
    stem.rotation.z = Math.cos(a) * 0.18
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 5), leafMat)
    leaf.scale.set(1.5, 0.28, 0.65)
    leaf.position.set(Math.cos(a) * 0.24, 0.46, Math.sin(a) * 0.24)
    leaf.rotation.y = -a
    g.add(stem, leaf)
  }
  return g
}

/** 歧舌国：医药、音韵与灯市三段轻量谜题；本章不设镜花。 */
export const qishe: SceneDef = {
  id: 'qishe',
  palette: M.palette,
  models: [
    'duojiugong', 'child', 'scholar', 'market_stall', 'paifang', 'desk_books', 'pot_large',
    'lantern_post', 'flower_yellowA', 'flower_purpleA', 'flower_redA', 'plant_bush',
    'plant_bushLarge', 'amber_tree', 'stern_cypress', 'rock_smallA', 'grass', 'grass_large',
    'small_boat', 'canoe',
  ],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(22, {
      seed: 71, roll: 0.18, wobble: 0.075,
      flats: [
        { x: -8, z: 5, r: 5.2 }, { x: 0, z: -4, r: 4.6 },
        { x: 9, z: -4, r: 5.2 }, { x: 0, z: 12, r: 2.4 },
      ],
      paths: [
        [[0, 19], [0, 11], [0, 5], [0, -3]],
        [[0, 8], [-4, 7], [-8, 5], [-12, 5.8]],
        [[-8, 5], [-9.2, 9]], [[-5, 6], [-4.8, 5.5]],
        [[0, 4], [5, 2], [8.5, 0], [9, -4.4], [7.2, -7.2]],
      ],
      foliage: { form: 'academy', density: 0.68, grassBase: '#738357', grassTip: '#b3b879', flowers: ['#f5d88a', '#e99b72', '#f3ead7'], flowerRatio: 0.08 },
    })

    const saved = ctx.checkpoint
    let solved = saved.solved
    let healed = saved.data.healed === true
    let accepted = saved.data.accepted === true || healed
    let phonics = typeof saved.data.phonics === 'number'
      ? THREE.MathUtils.clamp(Math.floor(saved.data.phonics), 0, PHONICS.length)
      : 0
    const medicine = new Set<number>(Array.isArray(saved.data.medicine)
      ? saved.data.medicine.filter((i): i is number => typeof i === 'number' && i >= 0 && i < MEDICINE.length)
      : [])
    const answered = new Set<number>(Array.isArray(saved.data.answered)
      ? saved.data.answered.filter((i): i is number => typeof i === 'number' && i >= 0 && i < RIDDLES.length)
      : [])
    accepted ||= medicine.size > 0
    let returnBoat: THREE.Object3D | null = null

    // 西侧药圃：药床、药棚与问诊处集中在同一暖色空间，采集点均留在道路旁。
    const yard = new THREE.Mesh(new THREE.CircleGeometry(5, 40), new THREE.MeshLambertMaterial({ color: '#c7ae7b' }))
    yard.rotation.x = -Math.PI / 2
    yard.position.set(-8, 0.025, 5)
    yard.receiveShadow = true
    s.scene.add(yard)
    await s.prop('market_stall', -8, 0, 1.8, { rotY: Math.PI, collider: 0.8 })
    await s.prop('pot_large', -10.4, 0, 2.7, { scale: 0.8 })
    await s.prop('desk_books', -4.8, 0, 5.5, { collider: 0.45 })
    for (const [x, z] of [[-11.8, 7.8], [-7.2, 9.4], [-5.4, 7.8]] as const) {
      s.box(new THREE.Vector3(x, 0.06, z), new THREE.Vector3(2.1, 0.12, 1.25), '#775b3d', { collide: false })
      for (let j = 0; j < 4; j += 1) {
        const plant = herbPlant(j % 2 ? '#79945d' : '#94a96b')
        plant.position.set(x - 0.72 + j * 0.48, 0.13, z)
        s.scene.add(plant)
      }
    }
    const pharmacySign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.65),
      new THREE.MeshBasicMaterial({ map: textTexture('济世药圃', { w: 320, h: 100, size: 58, bg: '#70452d', fg: '#ffe2a1' }), side: THREE.DoubleSide }),
    )
    pharmacySign.position.set(-8, 2.45, 2.45)
    s.scene.add(pharmacySign)
    const medicineLight = new THREE.PointLight('#ffc477', 26, 11, 2)
    medicineLight.position.set(-8, 3.1, 4.2)
    s.scene.add(medicineLight)

    const prince = await ctx.npc({
      name: '世子', model: 'child', x: -9.4, z: 3.9, yaw: Math.PI * 0.8, scale: 0.92,
      fallback: () => villager('#a65d45', { height: 1.15, hatShape: 'bun', skin: '#edc39f' }),
    })
    ctx.interact({
      pos: prince.position, radius: 2.1, verb: '探望', name: '世子', enabled: () => true,
      run: () => ctx.say([{ who: '世子', text: healed ? '我已经不热了。先生说，日后也要学着辨草木、正字音。' : '头很烫……那位老先生说，还缺几味药。' }]),
    })

    const duo = await ctx.npc({
      name: NAMES.duo, model: 'duojiugong', x: -6.8, z: 3.9, yaw: Math.PI, collider: false,
      fallback: () => villager('#8a9a7a', { hat: '#c9a66b', hatShape: 'straw', height: 1.7 }),
    })
    const placeDuo = () => {
      const [x, z] = !healed ? [-6.8, 3.9] : phonics < PHONICS.length ? [3.3, -2.6] : [5, -4.2]
      duo.position.set(x, s.groundHeight(x, z), z)
    }
    placeDuo()

    const items: THREE.Object3D[] = []
    MEDICINE_SPOTS.forEach(([x, z], i) => {
      const recipe = i === 2
      const item = recipe
        ? new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.78), new THREE.MeshLambertMaterial({ map: textTexture('退热方', { w: 96, h: 128, size: 28, vertical: true, bg: '#f7edce', fg: '#70452d' }), side: THREE.DoubleSide }))
        : herbPlant(i === 0 ? '#8ca572' : '#d8c76c')
      item.position.set(x, s.groundHeight(x, z) + (recipe ? 1.12 : 0.12), z)
      s.scene.add(item)
      if (medicine.has(i)) item.removeFromParent()
      if (recipe) s.spin(item, 0.65)
      items.push(item)
      ctx.interact({
        pos: item.position, radius: 1.7, verb: MEDICINE[i].verb, name: MEDICINE[i].name,
        enabled: () => accepted && !healed && !medicine.has(i),
        run: async () => {
          item.removeFromParent()
          medicine.add(i)
          ctx.updateCheckpoint({ data: { medicine: [...medicine] } })
          ctx.sfx('pickup')
          await ctx.say([{ who: NAMES.narrator, text: MEDICINE[i].note }])
          plan()
        },
      })
    })

    // 中央音韵台：三块字碑依次开放，每次答对立即推进并保存。
    const phonologyFloor = new THREE.Mesh(new THREE.CircleGeometry(4.1, 48), new THREE.MeshStandardMaterial({ color: '#c9b992', roughness: 0.95 }))
    phonologyFloor.rotation.x = -Math.PI / 2
    phonologyFloor.position.set(0, 0.035, -4)
    phonologyFloor.receiveShadow = true
    s.scene.add(phonologyFloor)
    const phonicRing = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.08, 48), new THREE.MeshLambertMaterial({ color: '#9b7650', side: THREE.DoubleSide }))
    phonicRing.rotation.x = -Math.PI / 2
    phonicRing.position.set(0, 0.045, -4)
    s.scene.add(phonicRing)
    const phonicTargets: THREE.Vector3[] = []
    PHONIC_X.forEach((x, i) => {
      const z = -5.5
      const y = s.groundHeight(x, z)
      s.box(new THREE.Vector3(x, y + 0.75, z), new THREE.Vector3(1.05, 1.5, 0.22), '#756b5b', { collide: false })
      const inscription = new THREE.Mesh(
        new THREE.PlaneGeometry(0.76, 1.15),
        new THREE.MeshBasicMaterial({ map: textTexture(PHONICS[i].mark, { w: 96, h: 144, size: 76, bg: '#756b5b', fg: '#ffe09a' }), side: THREE.DoubleSide }),
      )
      inscription.position.set(x, y + 0.8, z + 0.116)
      s.scene.add(inscription)
      const target = new THREE.Vector3(x, s.groundHeight(x, -4.15), -4.15)
      phonicTargets.push(target)
      ctx.interact({
        pos: target, radius: 1.35, verb: PHONICS[i].verb, name: PHONICS[i].name,
        enabled: () => healed && !solved && phonics === i,
        run: async () => {
          const r = PHONICS[i]
          const pick = await ctx.choose('司音先生', r.question, [...r.options])
          if (pick !== r.answer) {
            ctx.sfx('hurt')
            await ctx.say([{ who: '司音先生', text: r.hint }])
            return
          }
          phonics += 1
          ctx.updateCheckpoint({ data: { phonics } })
          ctx.sfx('pickup')
          placeDuo()
          await ctx.say([{ who: '司音先生', text: r.right }])
          plan()
        },
      })
    })
    const teacher = await ctx.npc({
      name: '司音先生', model: 'scholar', x: -3.4, z: -3.1, yaw: Math.PI * 0.7, collider: false,
      fallback: () => villager('#607e87', { hat: '#2a2622', hatShape: 'tall', height: 1.72 }),
    })
    ctx.interact({
      pos: teacher.position, radius: 2.1, verb: '请教', name: '司音先生', enabled: () => healed && !solved,
      run: () => ctx.say([{ who: '司音先生', text: phonics < 3 ? '字音不必死背。听清起音，辨明声调，再把字母排回去。' : '三关都过了。花灯巷里还有几盏谜灯，正等着客人。' }]),
    })

    // 东侧花灯巷：每盏灯独立作答，题数不超过三盏，正确状态会保留到刷新后。
    await s.prop('paifang', 8.5, 0, 1.3, { scale: 0.62 })
    await s.prop('market_stall', 12.6, 0, -1.7, { rotY: -Math.PI / 2, scale: 0.82, collider: 0.65 })
    await s.prop('market_stall', 12.4, 0, -6.8, { rotY: -Math.PI / 2, scale: 0.78, collider: 0.65 })
    const laneSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.58),
      new THREE.MeshBasicMaterial({ map: textTexture('花灯巷', { w: 280, h: 96, size: 58, bg: '#9a4935', fg: '#ffe18a' }), side: THREE.DoubleSide }),
    )
    laneSign.position.set(8.5, 2.85, 0.95)
    s.scene.add(laneSign)
    await lanternPosts(s, [[5.5, 0.8], [8.5, 0.8], [11.4, 0.6], [11.5, -8.3]], '#e99a4b')
    const lanternLight = new THREE.PointLight('#ffb45f', 34, 13, 2)
    lanternLight.position.set(8.7, 3.4, -4.2)
    s.scene.add(lanternLight)
    const lanternTargets: THREE.Vector3[] = []
    LANTERN_SPOTS.forEach(([x, z], i) => {
      const y = s.groundHeight(x, z)
      s.box(new THREE.Vector3(x + 0.43, y + 1.15, z), new THREE.Vector3(0.09, 2.3, 0.09), '#69462f', { collide: false })
      s.box(new THREE.Vector3(x + 0.04, y + 2.25, z), new THREE.Vector3(0.86, 0.08, 0.08), '#69462f', { collide: false })
      const lamp = lantern(i === 2 ? '#d68a3d' : '#c65b3d')
      lamp.position.set(x - 0.25, y + 1.72, z)
      s.scene.add(lamp)
      s.bob(lamp, 0.035, 0.9 + i * 0.12)
      const tagMaterial = new THREE.MeshBasicMaterial({
        map: textTexture(RIDDLES[i].tag, { w: 96, h: 128, size: 34, vertical: true, bg: '#f6dfb3', fg: '#8d3c2e' }),
        color: answered.has(i) ? '#ffd76a' : '#ffffff', side: THREE.DoubleSide,
      })
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), tagMaterial)
      tag.position.set(x - 0.25, y + 0.92, z + 0.03)
      s.scene.add(tag)
      const target = new THREE.Vector3(x, y, z + 1.15)
      lanternTargets.push(target)
      ctx.interact({
        pos: target, radius: 1.35, verb: '猜谜', name: RIDDLES[i].name,
        enabled: () => healed && phonics >= PHONICS.length && !solved && !answered.has(i),
        run: async () => {
          const r = RIDDLES[i]
          const pick = await ctx.choose('灯谜', r.question, [...r.options])
          if (pick !== r.answer) {
            ctx.sfx('hurt')
            await ctx.say([{ who: NAMES.narrator, text: '灯谜尚未解开。换个思路，再试一次。' }])
            return
          }
          answered.add(i)
          tagMaterial.color.set('#ffd76a')
          ctx.updateCheckpoint({ data: { answered: [...answered] } })
          ctx.sfx('pickup')
          await ctx.say([{ who: NAMES.narrator, text: r.right }])
          plan()
        },
      })
    })

    ctx.interact({
      pos: duo.position, radius: 2.5,
      verb: () => solved ? '交谈' : !healed && medicine.size === MEDICINE.length ? '交药' : !solved && phonics >= 3 && answered.size === 3 ? '谈灯' : '交谈',
      name: NAMES.duo, enabled: () => true,
      run: async () => {
        if (solved) {
          await ctx.say([{ who: NAMES.duo, text: '世上有听不完的字音，也有学不完的道理。老夫愿慢慢学。' }])
          return
        }
        if (!healed) {
          if (!accepted) {
            accepted = true
            ctx.updateCheckpoint({ data: { accepted: true } })
            await ctx.say([
              { who: NAMES.duo, text: '世子发热不退。我有一张退热方，还缺青蒿、金银花，方才药方也被风吹走了。' },
              { who: NAMES.tang, text: '九公先照看世子，我去药圃把两样药草和药方找齐。' },
            ])
            plan()
            return
          }
          if (medicine.size < MEDICINE.length) {
            await ctx.say([{ who: NAMES.duo, text: `还差${MEDICINE.length - medicine.size}样。药草在药圃里，药方落在东侧矮书案上。` }])
            return
          }
          healed = true
          ctx.updateCheckpoint({ data: { healed: true } })
          await ctx.say([
            { who: NAMES.duo, text: '药齐了。按方煎服，这一帖下去，热便能退了。' },
            { who: '世子', text: '我好多了。多谢九公，也多谢唐兄。' },
            { who: NAMES.duo, text: '前面音韵台正讲字母。唐兄，我们也去听听。' },
          ])
          placeDuo()
          plan()
          return
        }
        if (phonics < PHONICS.length) {
          await ctx.say([{ who: NAMES.duo, text: '这些字母看着简单，合起来却另有门道。先过听音、辨调、排字三关罢。' }])
          return
        }
        if (answered.size < RIDDLES.length) {
          await ctx.say([{ who: NAMES.duo, text: `花灯巷还有${RIDDLES.length - answered.size}盏谜灯未解。第三盏不写字，要看画中意思。` }])
          return
        }
        solved = true
        ctx.updateCheckpoint({ solved: true })
        await ctx.say([
          { who: NAMES.duo, text: '在黑齿国受挫，我还只当自己一时失手。今日面对这些字母，才知老夫不懂的还多。' },
          { who: NAMES.tang, text: '九公肯承认未知，便又进了一步。' },
          { who: NAMES.duo, text: '正是。医术能救人，虚心才能教人继续往前走。' },
        ])
        plan()
      },
    })

    function plan() {
      if (solved) {
        ctx.objective('歧舌国事已了，回到岸边的小舟返航', returnBoat)
      } else if (!accepted) {
        ctx.objective('去西侧药圃找多九公问诊', duo.root)
      } else if (!healed && medicine.size < MEDICINE.length) {
        ctx.objective(`寻找青蒿、金银花与药方（${medicine.size}/3）`, items.find(item => item.parent === s.scene) ?? null)
      } else if (!healed) {
        ctx.objective('把药草和药方交给多九公', duo.root)
      } else if (phonics < PHONICS.length) {
        ctx.objective(`在音韵台听音、辨调、排字（${phonics}/3）`, phonicTargets[phonics])
      } else if (answered.size < RIDDLES.length) {
        ctx.objective(`去东侧花灯巷解开谜灯（${answered.size}/3）`, lanternTargets.find((_, i) => !answered.has(i)) ?? null)
      } else {
        ctx.objective('在花灯巷与多九公谈谈', duo.root)
      }
    }

    await s.scatter(0, 0, 11, 18, 24, ['amber_tree', 'stern_cypress', 'plant_bushLarge', 'rock_smallA', 'grass_large'], 71, [
      { x: 0, z: 14, r: 4 }, { x: -8, z: 5, r: 5.4 }, { x: 0, z: -4, r: 5 }, { x: 9, z: -4, r: 5.4 },
    ], 0, true, [0.65, 1])
    await s.scatter(-8, 5, 2.8, 5, 10, ['flower_yellowA', 'flower_purpleA', 'flower_redA', 'plant_bush'], 72, [
      { x: -9.2, z: 9, r: 1.4 }, { x: -12, z: 5.8, r: 1.4 }, { x: -4.8, z: 5.5, r: 1.4 },
    ])
    returnBoat = await dockAndReturn(ctx, 'qishe', new THREE.Vector3(0, 0, 23), [
      { who: NAMES.duo, text: '歧舌国的字母音韵，老夫回去还要好好练。' },
      { who: NAMES.tang, text: `${M.moral}` },
    ])
    plan()
  },
  async start(ctx) {
    if (ctx.checkpoint.solved) return
    await ctx.say([
      { who: NAMES.duo, text: '歧舌国到了。这里的人善用字母辨音，街头处处能听见新奇的读法。' },
      { who: NAMES.duo, text: '只是世子病了。我先去西侧药圃问诊，唐兄随后来帮我找药。' },
    ])
  },
}
