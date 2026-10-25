import * as THREE from 'three'
import { NAMES, dockAndReturn, duoSpec, type SceneDef } from '../chapter'
import { textTexture, villager } from '../stage'

/**
 * 淑士国 — 咬文嚼字. A narrow street of wine shops, tea stalls and academies ends at a side gate.
 * Tang Ao exposes a pedant's false etymology, then helps Xu Chengzhi find two ways through the gate.
 * This is a story chapter: completing the escape, rather than collecting a mirror flower, ends it.
 */
export const shushi: SceneDef = {
  id: 'shushi',
  palette: {
    sky: '#91a8b2', horizon: '#d2d8d2', fog: '#b5c2bd', water: '#456b73',
    grass: '#64766a', sand: '#b7b1a1', accent: '#8a7452',
  },
  models: ['duojiugong', 'seller', 'scholar', 'servant', 'banquet_house', 'market_stall', 'academy_hall', 'desk_books', 'stern_cypress', 'canoe', 'grass', 'stump_round', 'rock_smallA'],
  spawn: new THREE.Vector3(0, 1.2, 14),
  yaw: 0,
  async build(ctx) {
    const s = ctx.stage
    s.terrain(22, {
      seed: 73, roll: 0.12, wobble: 0.055,
      flats: [
        { x: 0, z: 12, r: 4 }, { x: -4, z: 6, r: 5 }, { x: 4, z: 0, r: 4.5 },
        { x: -4, z: -7, r: 5 }, { x: 0, z: -12, r: 4 },
      ],
      paths: [
        [[0, 20], [0, 13], [0, 7], [0, 1], [0, -5], [0, -12]],
        [[0, 8], [-2.2, 6.8], [-4.5, 8.3]], [[0, 2], [3, 2], [6.5, 0.4]],
        [[0, -4], [-3, -4.8], [-6, -4.8]], [[0, -8], [0, -11.5], [-1.8, -11.7]],
      ],
      foliage: { form: 'academy', density: 0.5, grassBase: '#52675f', grassTip: '#9daa92', flowers: ['#d7d0ae', '#87998a'], flowerRatio: 0.025 },
    })

    const saved = ctx.checkpoint
    let waiterHeard = saved.data.waiterHeard === true
    let pedantSolved = saved.data.pedantSolved === true
    let metXu = saved.data.metXu === true
    let wallChecked = saved.data.wallChecked === true
    let solved = saved.solved
    const clues = new Set<string>(Array.isArray(saved.data.clues)
      ? saved.data.clues.filter((v): v is string => typeof v === 'string' && (v === 'watch' || v === 'pass'))
      : [])
    if (solved) {
      waiterHeard = true
      pedantSolved = true
      metXu = true
      wallChecked = true
      clues.add('watch')
      clues.add('pass')
    }

    const addSign = (text: string, x: number, y: number, z: number) => {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 0.55),
        new THREE.MeshBasicMaterial({ map: textTexture(text, { w: 300, h: 90, size: 48, bg: '#394d4b', fg: '#ddd8bd' }), side: THREE.DoubleSide }),
      )
      sign.position.set(x, y, z)
      s.scene.add(sign)
    }

    // The three small venues face one another across a narrow, unobstructed street.
    await s.prop('banquet_house', -4.5, 0, 5.2, { solid: true, rotY: Math.PI / 2 })
    addSign('一味酒楼', -1.75, 2.8, 6.1)
    s.box(new THREE.Vector3(-3.2, 0.02, 8.1), new THREE.Vector3(5.8, 0.04, 2.4), '#aaa99a', { collide: false })
    await s.prop('desk_books', -5.5, 0, 7.2, { collider: 0.55, scale: 0.8 })

    await s.prop('market_stall', 4.3, 0, -0.7, { solid: true, rotY: -Math.PI / 2 })
    addSign('吃茶去', 2.05, 2.35, 0.2)
    s.box(new THREE.Vector3(4.3, 0.02, 1.7), new THREE.Vector3(5.5, 0.04, 2.6), '#a6aa9b', { collide: false })

    await s.prop('academy_hall', -4.2, 0, -8.2, { solid: true, rotY: Math.PI / 2 })
    addSign('淑士书院', -1.45, 3.25, -6.9)
    await s.prop('desk_books', -3.8, 0, -5.3, { collider: 0.55, scale: 0.8 })

    const waiter = await ctx.npc({
      name: '酒保', model: 'seller', x: -2.2, z: 6.8, yaw: Math.PI * 0.7,
      fallback: () => villager('#657a73', { hat: '#d2ccb5', height: 1.68 }),
    })
    const pedant = await ctx.npc({
      name: '腐儒', model: 'scholar', x: -4.5, z: 8.3, yaw: Math.PI,
      fallback: () => villager('#77745f', { hat: '#d7d2bc', hatShape: 'tall', height: 1.78 }),
    })
    const xu = await ctx.npc({
      name: '徐承志', model: 'servant', x: 3, z: 2, yaw: Math.PI,
      fallback: () => villager('#596f70', { hat: '#343f3d', height: 1.72 }),
    })

    // The notice and the old pass are separate world objects, not rewards from Xu's dialogue.
    const noticePos = new THREE.Vector3(-6, 0, -4.8)
    const noticeBoard = s.box(new THREE.Vector3(-6, 1.05, -5.55), new THREE.Vector3(1.45, 1.25, 0.12), '#56645a', { collide: false })
    const notice = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.9),
      new THREE.MeshBasicMaterial({ map: textTexture('二更换岗', { w: 160, h: 128, size: 34, bg: '#d5cfb4', fg: '#3d4942' }), side: THREE.DoubleSide }),
    )
    notice.position.set(-6, 1.08, -5.48)
    s.scene.add(notice)
    if (clues.has('watch')) (noticeBoard.material as THREE.MeshStandardMaterial).color.set('#879082')

    const passPos = new THREE.Vector3(6.5, 0, 0.4)
    s.box(new THREE.Vector3(6.5, 0.35, -0.35), new THREE.Vector3(1.05, 0.7, 0.8), '#6c6654', { collide: false })
    const oldPass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.68),
      new THREE.MeshLambertMaterial({ map: textTexture('旧关牒', { w: 96, h: 128, size: 26, vertical: true, bg: '#d6cba9', fg: '#544c3c' }), side: THREE.DoubleSide }),
    )
    oldPass.position.set(6.5, 0.78, -0.1)
    oldPass.rotation.x = -Math.PI / 3
    s.scene.add(oldPass)
    if (clues.has('pass')) oldPass.removeFromParent()

    // The side wall closes the northern end. The door is visual only so its interaction is never
    // hidden inside a collider; after the escape it stays open on subsequent visits.
    for (const x of [-4.6, 4.6]) {
      s.box(new THREE.Vector3(x, 1.25, -13.2), new THREE.Vector3(6.8, 2.5, 0.55), '#758079')
      s.box(new THREE.Vector3(x, 2.62, -13.2), new THREE.Vector3(7.1, 0.25, 0.8), '#4c605d', { collide: false })
    }
    const gatePanel = s.box(new THREE.Vector3(0, 1.2, -13.15), new THREE.Vector3(2.35, 2.4, 0.18), '#52635d', { collide: false })
    gatePanel.visible = !solved
    const wallCheckPos = new THREE.Vector3(-1.8, 0, -11.7)
    const gatePos = new THREE.Vector3(0, 0, -11.5)

    ctx.interact({
      pos: waiter.position, radius: 2.4, verb: '询问', name: '酒保', enabled: () => !waiterHeard,
      run: async () => {
        waiterHeard = true
        ctx.updateCheckpoint({ data: { waiterHeard: true } })
        await ctx.say([
          { who: '酒保', text: '客官，快来评评理！那位先生喝了本地酒，偏说酒里有个「酉」，酉属西方，所以这酒定从西海来。' },
          { who: '腐儒', text: '字有方位，物有本源。你只收本地酒钱，岂非不识字的缘故？' },
          { who: '酒保', text: '他越说越玄，如今连酒钱也不肯付了。唐客官是读书人，还请与他分辨。' },
        ])
        plan()
      },
    })

    ctx.interact({
      pos: pedant.position, radius: 2.5, verb: '辨伪', name: '腐儒', enabled: () => waiterHeard && !pedantSolved,
      run: async () => {
        await ctx.say([{ who: '腐儒', text: '「酉」在十二支中正属西方。此酒既有「酉」，必自西海而来，这还有假么？' }])
        for (;;) {
          const pick = await ctx.choose(NAMES.tang, '如何指出这番字说的谬处？', [
            '酉在这里只是声旁，地支方位不能证明酒的来路。',
            '酉既然属西，把酒坛朝西摆便算账了。',
            '酒字还有三点水，想必掺的是西海之水。',
          ])
          if (pick === 0) break
          await ctx.say([{ who: '腐儒', text: '妙啊，这才算顺着字理！' }, { who: '酒保', text: '客官，别陪他胡缠了，单说字形与酒从哪里来有何相干。' }])
        }
        pedantSolved = true
        ctx.updateCheckpoint({ data: { pedantSolved: true } })
        await ctx.say([
          { who: NAMES.tang, text: '「酒」从水、酉声。借地支方位穿凿字义，不能拿来当酒钱的凭据。' },
          { who: '腐儒', text: '这……我不过借字助兴，何曾要赖账！酒保，算账便是。' },
          { who: NAMES.duo, text: '字句本是帮人达意的，硬拿来装点门面，倒把正事忘了。' },
        ])
        plan()
      },
    })

    ctx.interact({
      pos: xu.position, radius: 2.5, verb: '交谈', name: '徐承志', enabled: () => pedantSolved && !solved,
      run: async () => {
        if (!metXu) {
          metXu = true
          ctx.updateCheckpoint({ data: { metXu: true } })
          await ctx.say([
            { who: '徐承志', text: '在下徐承志，欲出淑士关寻亲，却被守卒以字句不合为由扣在此地。唐兄若能相助，感激不尽。' },
            { who: '徐承志', text: '北面侧墙守备较松。书院外贴着巡关时刻；我先前用的旧关牒，慌乱中落在茶肆东边的箱篓上了。' },
            { who: NAMES.tang, text: '徐兄稍候，我去把时刻与关牒找齐。' },
          ])
        } else if (clues.size < 2) {
          await ctx.say([{ who: '徐承志', text: `还差${2 - clues.size}样。书院外查巡关时刻，茶肆东边寻旧关牒，两处都去看过便齐了。` }])
        } else if (!wallChecked) {
          await ctx.say([{ who: '徐承志', text: '东西齐了！沿直街往北，先察看侧墙，再从关门出去。' }])
        } else {
          await ctx.say([{ who: '徐承志', text: '守卒二更换岗，门闩已经看明。唐兄，趁此刻潜出关门！' }])
        }
        plan()
      },
    })

    ctx.interact({
      pos: noticePos, radius: 1.8, verb: '查看', name: '巡关告示', enabled: () => metXu && !clues.has('watch'),
      run: async () => {
        clues.add('watch')
        ctx.updateCheckpoint({ data: { clues: [...clues] } })
        ;(noticeBoard.material as THREE.MeshStandardMaterial).color.set('#879082')
        ctx.sfx('pickup')
        await ctx.say([{ who: NAMES.narrator, text: '告示小字写着：「侧关二更换岗，旧牒仍许验行。」徐承志要的出关时刻找到了。' }])
        plan()
      },
    })

    ctx.interact({
      pos: passPos, radius: 1.7, verb: '拾取', name: '旧关牒', enabled: () => metXu && !clues.has('pass'),
      run: async () => {
        clues.add('pass')
        oldPass.removeFromParent()
        ctx.updateCheckpoint({ data: { clues: [...clues] } })
        ctx.sfx('pickup')
        await ctx.say([{ who: NAMES.narrator, text: '箱篓上压着一张旧关牒，姓名正是徐承志，关防印验尚清晰可用。' }])
        plan()
      },
    })

    ctx.interact({
      pos: wallCheckPos, radius: 1.55, verb: '查探', name: '北侧墙', enabled: () => metXu && clues.size === 2 && !wallChecked && !solved,
      run: async () => {
        wallChecked = true
        ctx.updateCheckpoint({ data: { wallChecked: true } })
        await ctx.say([
          { who: NAMES.narrator, text: '侧墙下没有暗沟，惟有单扇关门可通。门闩在内，换岗时有片刻无人盘问。' },
          { who: NAMES.tang, text: '时刻与关牒都对得上。等二更守卒换岗，便能从此潜出。' },
        ])
        plan()
      },
    })

    ctx.interact({
      pos: gatePos, radius: 1.55, verb: '潜出', name: '淑士关侧门', enabled: () => wallChecked && !solved,
      run: async () => {
        solved = true
        gatePanel.visible = false
        ctx.updateCheckpoint({ solved: true, data: { escaped: true } })
        ctx.sfx('ui')
        await ctx.say([
          { who: NAMES.narrator, text: '二更梆子一响，守卒交岗离去。唐敖与徐承志拨开侧门，沿墙影悄然而出。' },
          { who: '徐承志', text: '过了此关，前方便是生路。唐兄不以酸文误事，反以实据助人，徐某谨记此恩。' },
          { who: NAMES.duo, text: '关已出，人也安顿妥了。咱们回南岸登舟罢。' },
        ])
        plan()
      },
    })

    const duo = await ctx.npc(duoSpec(2.2, 12, Math.PI))
    ctx.interact({
      pos: duo.position, radius: 2.4, verb: '交谈', name: NAMES.duo, enabled: () => true,
      run: () => ctx.say([{ who: NAMES.duo, text: solved ? '徐承志已经脱困，不必再与关门纠缠，回舟罢。' : pedantSolved ? '淑士国满街都是字眼，出关却要看时刻、找关牒。唐兄，办正事要紧。' : '前面酒楼争得热闹。先问酒保，再听听那腐儒如何曲解字义。' }]),
    })

    await s.scatter(0, 0, 12, 18, 20, ['stern_cypress', 'grass', 'stump_round', 'rock_smallA'], 73, [
      { x: 0, z: 15, r: 4 }, { x: -4, z: 6, r: 5 }, { x: 4, z: 0, r: 5 },
      { x: -4, z: -7, r: 5 }, { x: 0, z: -12, r: 6 },
    ], 0, true, [0.65, 1])

    const returnBoat = await dockAndReturn(ctx, 'shushi', new THREE.Vector3(0, 0, 22), [
      { who: '徐承志', text: '今日得以出关，全仗唐兄辨明虚言、寻得实据。他日相逢，再报此恩。' },
      { who: NAMES.tang, text: '咬文嚼字若只为自炫，纵有满腹词句，也解不得眼前之困。' },
      { who: NAMES.duo, text: '淑士国这一关，不靠镜花，只靠把人实实在在送出去。扬帆罢。' },
    ])
    const plan = () => {
      if (solved) ctx.objective('徐承志已脱困，回南岸小舟返航', returnBoat)
      else if (!waiterHeard) ctx.objective('去一味酒楼询问酒保', waiter.root)
      else if (!pedantSolved) ctx.objective('与酒楼外的腐儒论辩，拆穿字说', pedant.root)
      else if (!metXu) ctx.objective('去茶肆寻找受困的徐承志', xu.root)
      else if (clues.size < 2) ctx.objective(`找齐出关信息／物件（${clues.size}/2）：书院巡关告示、茶肆旧关牒`, null)
      else if (!wallChecked) ctx.objective('沿直街向北，查探淑士关侧墙', wallCheckPos)
      else ctx.objective('趁二更换岗，从侧门潜出淑士关', gatePos)
    }
    plan()
  },
  async start(ctx) {
    await ctx.say([
      { who: NAMES.duo, text: '淑士国到了。这里书院挨着酒楼，人人说话都要绕几个字弯，只怕办事不容易。' },
      { who: NAMES.tang, text: '前面酒楼似有人争执。且去听听，莫被几句酸文绕住了。' },
    ])
  },
}
