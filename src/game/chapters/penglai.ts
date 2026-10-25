import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, type SceneDef } from '../chapter'
import { flowerCount } from '../progress'
import { CHAPTERS } from '../story'
import { mirrorFlower, rng, villager, type Stage } from '../stage'
import { addRegionalCrown } from '../regional-architecture'

const M = CHAPTERS.penglai

/** A flight of steps from radius `from` inward along ±X, rising from `base` by 0.3 per step. */
function flight(s: Stage, sign: 1 | -1, from: number, base: number, steps = 8): void {
  for (let i = 0; i < steps; i += 1) {
    const top = base + 0.3 * (i + 1)
    const bottom = base - 0.6
    const r = from - 0.3 - i * 0.6
    s.box(new THREE.Vector3(sign * r, (top + bottom) / 2, 0), new THREE.Vector3(0.62, top - bottom, 2.6), i % 2 ? '#d8cdb6' : '#cfc4ad', { collide: false })
  }
  // Separate treads can trap a capsule on the shared edges, especially at low frame rates. Keep
  // the visible stonework, but give it one continuous walking surface from terrace to terrace.
  const run = steps * 0.6 + 0.02
  const rise = steps * 0.3
  const angle = Math.atan2(rise, run)
  const length = Math.hypot(run, rise)
  const center = new THREE.Vector3(sign * (from - run / 2), base + rise / 2 - 0.1, 0)
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sign * angle)
  s.physics.addStaticBox(center, new THREE.Vector3(length, 0.2, 2.6), rotation)
}

/**
 * 小蓬莱 — the finale. Climb the terraced fairy mountain, set the six mirror flowers on the mirror
 * altar, meet the Hundred-Flower Fairy, and choose how Tang Ao's voyage ends.
 */
export const penglai: SceneDef = {
  id: 'penglai',
  palette: M.palette,
  models: ['duojiugong', 'baihua', 'mirror_terrace', 'peach_tree', 'fairy_tree', 'stone_tallC', 'rock_largeC', 'flower_redA', 'canoe', 'grass_large'],
  spawn: new THREE.Vector3(0, 1.2, 14),
  yaw: -Math.PI / 2,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(20, {
      seed: 71, roll: 0.12, wobble: 0.06,
      paths: [[[0, 18], [5, 13], [12, 5], [15, 0]], [[15, 0], [11, 0]], [[-10, 0], [-5, 0]]],
      foliage: { form: 'fairy', density: 0.86, grassBase: '#679371', grassTip: '#b6d49e', flowers: ['#f4b6c2', '#f7c9d2', '#f3ead7'], flowerRatio: 0.16 },
    })
    s.island(0, 0, 11, 2.4, { sand: false, fence: false })
    s.island(0, 0, 6, 4.8, { sand: false, fence: false })
    flight(s, 1, 15.8, 0)
    flight(s, -1, 10.8, 2.4)
    let placed = ctx.checkpoint.data.placed === true || ctx.checkpoint.solved
    let climbStage = -1
    const lowerSteps = new THREE.Vector3(15.2, 0, 0)
    const upperSteps = new THREE.Vector3(-10.5, 2.4, 0)

    // Generated PBR mirror altar at the summit.
    const altar = await s.prop('mirror_terrace', 0, 4.8, 0, { collider: 1.55 })
    if (altar) addRegionalCrown(s.scene, altar, 'lotus')

    const fairy = await ctx.npc({ name: '百花仙子', model: 'baihua', x: 0, y: 4.8, z: -3.4, yaw: 0, fallback: () => villager('#f4b6c2', { hat: '#d96a8a', hatShape: 'bun', height: 1.9, skin: '#f7e1d3' }) })
    fairy.root.visible = placed

    const ring: THREE.Group[] = []
    const restoreRing = () => {
      if (ring.length > 0) return
      for (let i = 0; i < 6; i += 1) {
        const f = mirrorFlower()
        const a = (i / 6) * Math.PI * 2
        f.position.set(Math.cos(a) * 1.25, 5.8, Math.sin(a) * 1.25)
        f.scale.setScalar(0.6)
        s.scene.add(f)
        s.spin(f, 0.8)
        ring.push(f)
      }
    }
    if (placed) restoreRing()
    ctx.interact({
      pos: new THREE.Vector3(0, 4.8, 1.6), radius: 2.6,
      verb: () => placed ? '照见前尘' : '安放镜花', name: '镜台', enabled: () => true,
      run: async () => {
        const n = flowerCount(ctx.progress)
        if (n < 6) {
          await ctx.say([{ who: NAMES.narrator, text: `镜台上有六处凹痕。唐敖囊中只有${n}枚镜花。` }])
          return
        }
        if (!placed) {
          placed = true
          ctx.updateCheckpoint({ solved: true, data: { placed: true } })
          restoreRing()
          ctx.sfx('win')
          fairy.root.visible = true
          await ctx.say([
            { who: NAMES.narrator, text: '六枚镜花依次落入镜台。镜面泛起涟漪，照出的不是唐敖，而是一路走过的六个国度。' },
            { who: '百花仙子', text: '唐敖，你看镜中——君子国的让，大人国的云，无肠国的饭，黑齿国的灯，白民国的书，两面国的巾。' },
            { who: '百花仙子', text: '还有淑士关内的人、歧舌灯下的药、女儿宫墙内外两颗着急的心。镜花只有六枚，这一路的牵挂却不止六段。' },
          ])
        }
        const pick = await ctx.choose(NAMES.tang, '仙子问：此后，你欲何往？', ['留在小蓬莱，修心问道', '回到船上，与亲人同归'])
        const choice = pick === 0 ? 'stay' : 'return'
        ctx.updateStory({ ending: true, endingChoice: choice, epilogueSeen: false })
        if (choice === 'stay') {
          await ctx.say([
            { who: NAMES.tang, text: '功名如镜花，富贵如水月。我便留在这山中，看花开花落罢。' },
            { who: NAMES.narrator, text: '唐敖在石上题诗，转身入山。林之洋与多九公寻而不见，只得带着书信和航海志归乡。' },
          ])
        } else {
          await ctx.say([
            { who: NAMES.tang, text: '海外诸国走了一遍，我仍惦念家中那盏灯。仙子，容我从归途再慢慢领会这一程。' },
            { who: NAMES.narrator, text: '唐敖向仙子长揖作别，下山与林之洋、多九公同归。唐小山在码头读完了一整本航海志。' },
          ])
        }
        await ctx.ending(choice)
        ctx.updateStory({ epilogueSeen: true })
        ctx.finish()
      },
    })

    // Petals drifting in the air.
    const count = 260
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const rand = rng(77)
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (rand() - 0.5) * 36
      pos[i * 3 + 1] = rand() * 12
      pos[i * 3 + 2] = (rand() - 0.5) * 36
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const petals = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#f4b6c2', size: 0.14, transparent: true, opacity: 0.9 }))
    s.scene.add(petals)

    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2 + 0.2
      const r = i % 2 ? 8.6 : 14.5
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (Math.abs(z) < 2.5 || (z > 10 && Math.abs(x) < 4)) continue
      await s.prop('peach_tree', x, r < 11 ? 2.4 : 0, z, { rotY: rand() * Math.PI * 2, scale: 0.82 + rand() * 0.3 })
      s.physics.addStaticCylinder(new THREE.Vector3(x, (r < 11 ? 2.4 : 0) + 1, z), 0.3, 2)
    }
    await s.scatter(0, 0, 2.5, 5.5, 6, ['flower_redA', 'grass_large'], 81, [{ x: 0, z: 0, r: 2.2 }, { x: -5, z: 0, r: 1.6 }, { x: 0, z: -3.4, r: 1 }], 4.8)
    await s.scatter(0, 0, 13, 16.5, 10, ['stone_tallC', 'rock_largeC', 'fairy_tree'], 82, [{ x: 0, z: 14, r: 4 }, { x: 15, z: 0, r: 3 }], 0, true)

    const herbAt = new THREE.Vector3(8, s.groundHeight(8, 9), 9)
    const herb = new THREE.Group()
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.45, 7), new THREE.MeshStandardMaterial({ color: '#6c8e68' }))
    stem.position.y = 0.22
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: '#c88b77', roughness: 0.75 }))
    cap.scale.y = 0.35
    cap.position.y = 0.5
    herb.add(stem, cap)
    herb.position.copy(herbAt)
    s.scene.add(herb)
    ctx.interact({ pos: herbAt, radius: 1.6, verb: '查看', name: '石畔灵芝', enabled: () => true,
      run: () => ctx.say([{ who: NAMES.narrator, text: '灵芝生在石畔，唐敖俯身细看，却没有随手采去。仙山草木，也有它自己的时节。' }]) })

    const apeAt = new THREE.Vector3(-8, s.groundHeight(-8, 9), 9)
    const ape = new THREE.Group()
    const fur = new THREE.MeshStandardMaterial({ color: '#e5dfcf', roughness: 0.9 })
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), fur)
    body.scale.y = 1.35
    body.position.y = 0.52
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), fur)
    head.position.set(0, 1.02, -0.08)
    ape.add(body, head)
    ape.position.copy(apeAt)
    s.scene.add(ape)
    s.bob(ape, 0.03, 1.2)
    ctx.interact({ pos: apeAt, radius: 1.8, verb: '观察', name: '衔枝白猿', enabled: () => true,
      run: () => ctx.say([{ who: NAMES.narrator, text: '白猿衔着一根枯枝跃上岩石，回头望了唐敖一眼。它不带路，也不讨食，只把仙山留给来人自己走。' }]) })

    const duo = await ctx.npc(duoSpec(2.2, 13, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: '山路从东边石阶上去，再绕到西边上山顶。老夫在此等候。' }]),
    })
    await dockAndReturn(ctx, 'penglai', new THREE.Vector3(0, 0, 21), [{ who: NAMES.duo, text: '唐兄保重。' }])

    const guideClimb = () => {
      const y = ctx.player.root.position.y
      const next = placed || y >= 5.1 ? 2 : y >= 2.8 ? 1 : 0
      if (next === climbStage) return
      climbStage = next
      if (next === 0) ctx.objective('沿东路向前，从石阶登上第一层山台', lowerSteps)
      else if (next === 1) ctx.objective('穿过山台，从西侧石阶登上山顶', upperSteps)
      else ctx.objective(placed ? '到镜台前照见前尘，选择此程归处' : '在山顶镜台安放六枚镜花', altar)
    }
    ctx.onUpdate((dt, t) => {
      guideClimb()
      const arr = geo.attributes.position.array as Float32Array
      for (let i = 0; i < count; i += 1) {
        arr[i * 3 + 1] -= dt * 0.5
        arr[i * 3] += Math.sin(t + i) * dt * 0.3
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 12
      }
      geo.attributes.position.needsUpdate = true
      ring.forEach((f, i) => { f.position.y = 5.8 + Math.sin(t * 2 + i) * 0.08 })
    })
    guideClimb()
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '小蓬莱……老夫行船四十年，第一次见这般仙山。' },
      { who: NAMES.tang, text: '山顶似有一座镜台。九公在此稍候，我上去看看。' },
    ])
  },
}
