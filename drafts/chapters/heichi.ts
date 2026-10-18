import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, type SceneDef } from '../chapter'
import { CHAPTERS } from '../story'
import { lantern, pavilionFallback, textTexture, villager } from '../stage'

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
  models: ['duojiugong', 'heichi', 'pavilion', 'tree_blocks_fall', 'tree_default', 'lily_large', 'flower_redA', 'canoe', 'bridge_wood', 'rock_smallA'],
  spawn: new THREE.Vector3(0, 1.2, 13),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.island(0, 0, 18)
    let accepted = false
    let solved = false
    const answered = new Set<number>()

    await s.prop('pavilion', 0, 0, -7, { fallback: pavilionFallback })
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('女学塾', { w: 300, h: 100, size: 60, bg: '#2e5e8c', fg: '#f3ead7' }), side: THREE.DoubleSide }))
    plaque.position.set(0, 3.4, -4.9)
    s.scene.add(plaque)
    const hong = await ctx.npc({ name: '黎红薇', model: 'heichi', x: -0.9, z: -7.6, yaw: Math.PI, fallback: () => villager('#2e5e8c', { skin: '#7a5a48', hat: '#2a2622', hatShape: 'bun', height: 1.55 }) })
    const zi = await ctx.npc({ name: '卢紫萱', model: 'heichi', x: 0.9, z: -7.6, yaw: Math.PI, scale: 0.97, fallback: () => villager('#7b5ea7', { skin: '#7a5a48', hat: '#2a2622', hatShape: 'bun', height: 1.5 }) })

    // A pond with lilies and a little bridge, lanterns around the garden.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshLambertMaterial({ color: '#5f8ea3' }))
    pond.rotation.x = -Math.PI / 2
    pond.position.set(7, 0.03, 3)
    s.scene.add(pond)
    for (let i = 0; i < 5; i += 1) await s.prop('lily_large', 7 + Math.cos(i * 1.3) * 2, 0.04, 3 + Math.sin(i * 1.3) * 2)

    const spots = [[-9, 2], [8, -5], [-4, 9]] as const
    spots.forEach(([x, z], i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), new THREE.MeshLambertMaterial({ color: '#4a3a2c' }))
      post.position.set(x, 1.3, z)
      s.scene.add(post)
      s.physics.addStaticCylinder(new THREE.Vector3(x, 1.3, z), 0.15, 2.6)
      const l = lantern('#c8412f')
      l.position.set(x, 2.9, z)
      s.scene.add(l)
      s.spin(l, 0.5)
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('灯谜' + '一二三'[i], { w: 64, h: 192, size: 40, vertical: true, bg: '#f3ead7', fg: '#c8412f' }), side: THREE.DoubleSide }))
      tag.position.set(x, 2.05, z)
      s.scene.add(tag)
      s.spin(tag, 0.5)
      ctx.interact({
        pos: new THREE.Vector3(x, 0, z), radius: 2.2, verb: '猜谜', name: `灯谜${'一二三'[i]}`, enabled: () => accepted && !answered.has(i),
        run: async () => {
          const r = RIDDLES[i]
          const pick = await ctx.choose('灯谜', `「${r.q}」——打一字`, r.options)
          if (pick === r.a) {
            answered.add(i)
            ;(l.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: '#c9a045', emissive: '#c9a045', emissiveIntensity: 1 })
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
        await ctx.say([
          { who: '黎红薇', text: '三谜尽中，客人果然是读书人。' },
          { who: NAMES.duo, text: '惭愧！老夫以貌取人，自以为见多识广，竟不如二位姑娘。' },
          { who: '卢紫萱', text: '老先生肯认，便是好学之人。这枚镜花，赠给二位。' },
        ])
        ctx.spawnFlower(new THREE.Vector3(0, 1.6, -5.6))
        ctx.objective('拾起二位才女面前的镜花', new THREE.Vector3(0, 1.6, -5.6))
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
    await s.scatter(0, 0, 10.5, 16.5, 22, ['tree_blocks_fall', 'tree_default', 'flower_redA', 'rock_smallA'], 61, [{ x: 0, z: 14, r: 4 }, { x: 7, z: 3, r: 4 }, ...spots.map(([x, z]) => ({ x, z, r: 2 }))], 0, true)
    await dockAndReturn(ctx, 'heichi', new THREE.Vector3(0, 0, 21), [
      { who: NAMES.duo, text: '面黑齿黑，腹中却有锦绣文章。老夫这把年纪，还要学一个道理——' },
      { who: NAMES.tang, text: `${M.moral}` },
    ])
    plan()
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '黑齿国到了。此国之人，面色黝黑，连牙齿也是黑的。' },
      { who: NAMES.tang, text: '听说此国有一座女学塾，才女辈出，我们去拜访拜访。' },
    ])
  },
}
