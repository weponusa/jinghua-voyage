export type MapPoint = { x: number; z: number }
export type Landmark = MapPoint & { id: string; name: string; note: string; kind: 'dock' | 'story' | 'quest' | 'view' }
export type SceneMap = {
  id: string; title: string
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  coast: MapPoint[]; paths: MapPoint[][]; landmarks: Landmark[]
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
export const JUNZI_PATHS = [
  points([[0, 21], [0.6, 15], [-0.4, 11], [0, 8.5], [0, 2], [0, -9], [0, -11]]),
  points([[0, 3], [-4, 2.8], [-8.5, 2.5]]),
  points([[2, 1], [6, 0], [9, -2], [10.7, -3.5]]),
  points([[-2, -6], [-6.5, -8.5]]),
  points([[2, -6], [6.8, -10]]),
]
export const JUNZI_MAP: SceneMap = {
  id: 'junzi', title: '君子国 · 山海舆图',
  bounds: { minX: -25, maxX: 25, minZ: -24, maxZ: 30 }, coast: [], paths: JUNZI_PATHS,
  landmarks: [
    { id: 'dock', name: '归舟渡', x: 0, z: 19, note: '镜花到手后，由此登舟返航。', kind: 'dock' },
    { id: 'arch', name: '惟善为宝', x: 0, z: 8.5, note: '读一读国门上的四字，方知此地风俗。', kind: 'story' },
    { id: 'market', name: '让利集', x: 0, z: -2, note: '买家偏要加价，卖家偏要少收；上前替二人评理。', kind: 'quest' },
    { id: 'courtesy', name: '礼让巷', x: -8.5, z: 2.5, note: '两人相让不休，请教老者可记一则见闻。', kind: 'story' },
    { id: 'pavilion', name: '听涛亭', x: 10.7, z: -3.5, note: '循东侧山路登高，望海记游。', kind: 'view' },
  ],
}

export function mapPercent(point: MapPoint, map: SceneMap): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(100, (point.x - map.bounds.minX) / (map.bounds.maxX - map.bounds.minX) * 100)),
    y: Math.max(0, Math.min(100, (point.z - map.bounds.minZ) / (map.bounds.maxZ - map.bounds.minZ) * 100)),
  }
}
export const distanceTo = (a: MapPoint, b: MapPoint): number => Math.hypot(a.x - b.x, a.z - b.z)
