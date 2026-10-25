import type { ChapterId } from './progress'

export type MapPoint = { x: number; z: number }
export type Landmark = MapPoint & { id: string; name: string; note: string; kind: 'dock' | 'story' | 'quest' | 'view' }
export type SceneMap = {
  id: string; title: string
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  coast: MapPoint[]; paths: MapPoint[][]; landmarks: Landmark[]
  illustration?: string
}
export type NavigationSnapshot = {
  map: SceneMap
  player: MapPoint & { yaw: number }
  objective: (MapPoint & { text: string; distance: number }) | null
  tracked: (Landmark & { distance: number }) | null
  visited: string[]
  chapter: { solved: boolean; collected: boolean; completed: boolean }
}

const points = (arr: number[][]): MapPoint[] => arr.map(([x, z]) => ({ x, z }))
const paths = (arr: number[][][]): MapPoint[][] => arr.map(points)
const dock = (): Landmark => ({ id: 'dock', name: '归舟渡', x: 0, z: 19, note: '本章已了后，由此登舟返航；也可提前回船。', kind: 'dock' })
const storyDock = (): Landmark => ({ ...dock(), note: '本章见闻已了后，由此登舟返航；也可提前回船。' })
const bounds = { minX: -24, maxX: 24, minZ: -24, maxZ: 30 }

export const JUNZI_PATHS = paths([
  [[0, 21], [0.6, 15], [-0.4, 11], [0, 8.5], [0, 2], [0, -9], [0, -11]],
  [[0, 3], [-4, 2.8], [-8.5, 2.5]],
  [[2, 1], [6, 0], [9, -2], [10.7, -3.5]],
  [[-2, -6], [-6.5, -8.5]],
  [[2, -6], [6.8, -10]],
])
export const JUNZI_MAP: SceneMap = {
  id: 'junzi', title: '君子国 · 山海舆图', bounds: { minX: -25, maxX: 25, minZ: -24, maxZ: 30 }, coast: [], paths: JUNZI_PATHS,
  landmarks: [
    { id: 'dock', name: '归舟渡', x: 0, z: 19, note: '镜花到手后，由此登舟返航。', kind: 'dock' },
    { id: 'arch', name: '惟善为宝', x: 0, z: 8.5, note: '读一读国门上的四字，方知此地风俗。', kind: 'story' },
    { id: 'market', name: '让利集', x: 0, z: -2, note: '买家偏要加价，卖家偏要少收；上前替二人评理。', kind: 'quest' },
    { id: 'courtesy', name: '礼让巷', x: -8.5, z: 2.5, note: '两人相让不休，请教老者可记一则见闻。', kind: 'story' },
    { id: 'pavilion', name: '听涛亭', x: 10.7, z: -3.5, note: '循东侧山路登高，望海记游。', kind: 'view' },
  ],
}

export const SCENE_MAPS: Record<ChapterId, SceneMap> = {
  junzi: JUNZI_MAP,
  daren: {
    id: 'daren', title: '大人国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [0, 11], [-2, 4], [-3, -1], [0, -5]], [[-2, 4], [-8, 4]], [[0, 10], [6, 9]], [[-3, -1], [-11, -5]], [[-2, 2], [7, -2]]]),
    landmarks: [dock(),
      { id: 'granny', name: '拾果坡', x: -8, z: 4, note: '老婆婆的果子散了一地，蹲下帮她拾起。', kind: 'quest' },
      { id: 'child', name: '风筝树', x: 6.2, z: 8.6, note: '孩童的风筝挂在树上，帮他取下来。', kind: 'quest' },
      { id: 'owner', name: '寻袋人', x: -11, z: -5, note: '卖油郎正在寻找遗失的钱袋。', kind: 'story' },
      { id: 'official', name: '红绫坡', x: 7, z: -2, note: '官员用红绫遮住足下云彩，上前问问究竟。', kind: 'story' },
      { id: 'elder', name: '彩云门', x: 0, z: -8.6, note: '三件善事让灰云化为彩云，穿过云门拜见长者。', kind: 'view' }],
  },
  liangmian: {
    id: 'liangmian', title: '两面国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [0, 12], [0, 9.5], [0, 3], [0, -7.2]], [[-3, 7.5], [-6, 3], [-4, -2]], [[0, 1], [5, -1]], [[-5, 1], [-6, -5]], [[5, 1], [6, -5]]]),
    landmarks: [dock(),
      { id: 'gate', name: '浩然坊', x: 0, z: 9.5, note: '穿过牌坊，便是人人笑脸相迎的广场。', kind: 'story' },
      { id: 'screen', name: '双面照壁', x: 0, z: -9.4, note: '照壁正反两副面容，与广场四人的浩然巾相映。', kind: 'view' },
      { id: 'keeper', name: '守门老者', x: -3, z: 7.5, note: '看清广场四人的巾后，再回报哪两位是两面人。', kind: 'quest' },
      { id: 'wang', name: '王员外', x: -4.2, z: -1.5, note: '绕到身后，看看浩然巾下藏着什么。', kind: 'story' },
      { id: 'zhao', name: '赵掌柜', x: -1.4, z: -4.6, note: '别只听殷勤话，巾后才是另一副面孔。', kind: 'story' },
      { id: 'qian', name: '钱秀才', x: 2.2, z: -4.2, note: '从背后悄悄看清他的真面目。', kind: 'story' },
      { id: 'sun', name: '孙郎中', x: 4.6, z: -0.8, note: '笑脸之后，未必还有另一张脸。', kind: 'story' }],
  },
  wuchang: {
    id: 'wuchang', title: '无肠国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [0, 10], [-1, 3], [0, -3.2]], [[-1, 3], [-7, 4], [-11, 7]]]),
    landmarks: [dock(),
      { id: 'miser', name: '富翁宴宅', x: 0, z: -6, note: '富翁守着三碗新饭，却叫下人吃反复加热的剩饭。', kind: 'quest' },
      { id: 'servant-lane', name: '仆人陋巷', x: -11, z: 7, note: '穿过西侧小路，把热饭送到仆人住处。', kind: 'view' },
      { id: 'afu', name: '小厮阿福', x: -7, z: 2, note: '把一碗热饭送给阿福。', kind: 'story' },
      { id: 'cook', name: '厨娘', x: -8.5, z: 4.5, note: '厨娘也没吃上刚出锅的热饭。', kind: 'story' },
      { id: 'servant', name: '老仆', x: -5.4, z: 5.2, note: '给老仆留一碗热饭。', kind: 'story' }],
  },
  baimin: {
    id: 'baimin', title: '白民国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [1, 11], [0, 3], [0, -3.1]], [[0, 5], [-6, 4], [-11, 3]], [[0, 0], [6, -2], [10, -4]], [[1, 11], [6, 9]]]),
    landmarks: [dock(),
      { id: 'school', name: '学海书院', x: 0, z: -5, note: '塾师衣冠楚楚，书却念错了；找齐书页再来对证。', kind: 'quest' },
      { id: 'page-west', name: '西路残页', x: -11, z: 3, note: '被风吹落的一页《孟子》。', kind: 'story' },
      { id: 'page-east', name: '东路残页', x: 10, z: -4, note: '拾起残页，与塾师所读相互印证。', kind: 'story' },
      { id: 'page-south', name: '南岸残页', x: 6, z: 9, note: '最后一页《论语》，别让风刮走了。', kind: 'story' }],
  },
  heichi: {
    id: 'heichi', title: '黑齿国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [-2, 11], [0, 3], [0, -4.7]], [[0, 4], [-9, 2]], [[0, 0], [8, -5]], [[-2, 11], [-4, 9]]]),
    landmarks: [dock(),
      { id: 'academy', name: '双层藏书楼', x: 0, z: -7, note: '二位才女设下三道灯谜，猜中后再来谈学问。', kind: 'quest' },
      { id: 'stele-garden', name: '学思碑林', x: -9, z: 2, note: '学、思、问、辨、行，五通石碑立在西路尽头。', kind: 'view' },
      { id: 'riddle-rack', name: '三灯谜架', x: 0, z: 0, note: '三盏灯笼各藏一道字谜，猜中后再去藏书楼。', kind: 'story' },
      { id: 'pond', name: '莲池', x: 7, z: 3, note: '池上莲叶田田，可在此稍歇赏景。', kind: 'view' }],
  },
  shushi: {
    id: 'shushi', title: '淑士国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [0, 10], [0, 4], [1.5, -1]], [[1.5, -1], [-4, -6], [-3, -9.5], [-5.1, -11.8]], [[-1.1, -10.9], [1.1, -11.1]]]),
    landmarks: [storyDock(),
      { id: 'tavern', name: '咬文酒楼', x: 1.5, z: -1, note: '酒保满口雅言，问清他到底肯不肯卖酒。', kind: 'quest' },
      { id: 'scholar', name: '腐儒茶座', x: 0, z: -4.6, note: '听一段迂谈，辨别言辞与行事。', kind: 'story' },
      { id: 'xu', name: '徐承志', x: -4, z: -6, note: '被淑士关所困的人，知道侧墙的秘密。', kind: 'quest' },
      { id: 'check', name: '关防封条', x: 1.1, z: -11.1, note: '查看封条，找出守卒换岗的空隙。', kind: 'quest' },
      { id: 'ladder', name: '短梯', x: -1.1, z: -10.9, note: '茶肆后墙的短梯，可助徐承志越关。', kind: 'quest' },
      { id: 'wall', name: '淑士侧关', x: -5.1, z: -11.8, note: '备齐短梯与换岗信息后，送徐承志出关。', kind: 'view' }],
  },
  qishe: {
    id: 'qishe', title: '歧舌国 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 19], [0, 11], [0, 5], [0, -3]], [[0, 8], [-4, 7], [-8, 5], [-12, 5.8]], [[-8, 5], [-9.2, 9]], [[-5, 6], [-4.8, 5.5]], [[0, 4], [5, 2], [8.5, 0], [9, -4.4], [7.2, -7.2]]]),
    landmarks: [storyDock(),
      { id: 'medicine', name: '济世药圃', x: -8, z: 5, note: '寻找青蒿、金银花和药方，交给多九公救世子。', kind: 'quest' },
      { id: 'prince', name: '世子', x: -9.4, z: 3.9, note: '药方齐备后，回来看看世子的病情。', kind: 'story' },
      { id: 'phonics', name: '音韵台', x: 0, z: -4.15, note: '听音、辨调、排字，各有一关。', kind: 'quest' },
      { id: 'lanterns', name: '花灯巷', x: 9, z: -4.4, note: '画谜、果谜与哑谜，解开后找多九公谈灯。', kind: 'quest' }],
  },
  nver: {
    id: 'nver', title: '女儿国 · 山海舆图', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 36 }, coast: [],
    paths: paths([[[0, 27], [0, 18], [-4, 12], [-5, 7], [-2, 1], [1, -3]], [[-5, 7], [-8, 1], [-8, -6], [-12, -9], [-12, -12], [-18, -12]], [[-12, -12], [-15, -14], [-18, -16]], [[1, -3], [6, -7], [11, -5], [14, 0], [11, 5], [5, 7], [-5, 7]]]),
    landmarks: [storyDock(),
      { id: 'market', name: '女儿国街市', x: -5, z: 7, note: '与林之洋察看街市分工，故事由此入宫。', kind: 'quest' },
      { id: 'palace', name: '宫院织房', x: -12, z: -12, note: '林之洋在此寻找竹管、货账与黄榜三条线索。', kind: 'quest' },
      { id: 'notice', name: '治河黄榜', x: 1, z: -3, note: '唐敖揭榜，依次开启源水、分水、归漕三闸。', kind: 'quest' },
      { id: 'sluices', name: '三闸河工', x: 11, z: -5, note: '源水闸 → 分水闸 → 归漕闸，错序会全部落闸。', kind: 'quest' },
      { id: 'west-gate', name: '西水门', x: -19, z: -12, note: '双线信息会合后，林之洋由这里亲自出宫。', kind: 'view' }],
  },
  penglai: {
    id: 'penglai', title: '小蓬莱 · 山海舆图', bounds, coast: [],
    paths: paths([[[0, 18], [5, 13], [12, 5], [15, 0]], [[15, 0], [11, 0]], [[-10, 0], [-5, 0]]]),
    landmarks: [dock(),
      { id: 'lower-steps', name: '东路石阶', x: 15.2, z: 0, note: '从这里登上第一层山台。', kind: 'quest' },
      { id: 'upper-steps', name: '西路石阶', x: -10.5, z: 0, note: '穿过山台，从西侧继续登顶。', kind: 'quest' },
      { id: 'altar', name: '镜花台', x: 0, z: 1.6, note: '六枚镜花集齐后，安放在山顶镜台。', kind: 'view' },
      { id: 'fairy', name: '百花仙子', x: 0, z: -3.4, note: '镜花水月，一路所悟都留在心里。', kind: 'story' }],
  },
}

export function mapPercent(point: MapPoint, map: SceneMap): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(100, (point.x - map.bounds.minX) / (map.bounds.maxX - map.bounds.minX) * 100)),
    y: Math.max(0, Math.min(100, (point.z - map.bounds.minZ) / (map.bounds.maxZ - map.bounds.minZ) * 100)),
  }
}
export const distanceTo = (a: MapPoint, b: MapPoint): number => Math.hypot(a.x - b.x, a.z - b.z)
