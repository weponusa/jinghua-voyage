import * as THREE from 'three'
import type { Sfx } from '../engine/audio'
import type { Physics } from '../engine/physics'
import type { ModelKey } from './models'
import type { Npc, NpcSpec } from './npc'
import type { Player } from './player'
import type { ChapterId, Progress, JunziProgress } from './progress'
import { CHAPTERS } from './story'
import { villager, type Palette, type Stage } from './stage'
import { WATER_Y } from './terrain'

export type Line = { who: string; text: string }

export type Interactable = {
  /** Live position (may be an object's position vector). */
  pos: THREE.Vector3
  radius: number
  /** Verb shown on the prompt, e.g. 交谈 / 拾取 / 查看. */
  verb: string | (() => string)
  /** Target name shown on the prompt. */
  name: string
  enabled: () => boolean
  run: () => void | Promise<void>
}

/** Services the voyage gives each chapter script. */
export interface Ctx {
  readonly stage: Stage
  readonly scene: THREE.Scene
  readonly physics: Physics
  readonly player: Player
  readonly progress: Progress
  /** True once this visit's mirror flower has been picked up. */
  readonly hasFlower: boolean
  /** Save a first-chapter checkpoint without losing previously visited landmarks. */
  updateJunzi(patch: Partial<JunziProgress>): void
  say(lines: Line[]): Promise<void>
  choose(who: string, text: string, options: string[]): Promise<number>
  /** Set the bottom quest line and (optionally) the world marker target. */
  objective(text: string, target?: THREE.Object3D | THREE.Vector3 | null): void
  toast(text: string): void
  sfx(name: Sfx): void
  npc(spec: NpcSpec): Promise<Npc>
  interact(spec: Interactable): Interactable
  onUpdate(fn: (dt: number, time: number) => void): void
  /** Show a mirror flower at a spot; walking into it collects it. */
  spawnFlower(pos: THREE.Vector3): void
  /** Chapter finished: award the flower, show the seal, sail back to the ship. */
  finish(): void
  /** Leave the island without finishing. */
  leave(): void
  /** Open the sea chart (hub only). */
  openChart(): void
  /** Show the ending scroll (finale only). */
  ending(): Promise<void>
  /** Override where Tang Ao appears (default: def.spawn placed on the ground). */
  setSpawn(pos: THREE.Vector3): void
}

export type SceneDef = {
  id: ChapterId | 'hub'
  palette: Palette
  models: ModelKey[]
  spawn: THREE.Vector3
  /** Initial camera yaw (0 = camera south of the player, looking north). */
  yaw: number
  build(ctx: Ctx): Promise<void>
  /** Runs after the fade-in (intro dialogue). */
  start?(ctx: Ctx): Promise<void>
}

export const NAMES = { tang: '唐敖', lin: '林之洋', duo: '多九公', narrator: '' } as const

/** Duo Jiugong, the old helmsman, who comes ashore with Tang Ao on every island. */
export function duoSpec(x: number, z: number, yaw = 0): NpcSpec {
  return { name: NAMES.duo, model: 'duojiugong', x, z, yaw, fallback: () => villager('#8a9a7a', { hat: '#c9a66b', hatShape: 'straw', height: 1.7 }) }
}

export function linSpec(x: number, z: number, yaw = 0): NpcSpec {
  return { name: NAMES.lin, model: 'linzhiyang', x, z, yaw, fallback: () => villager('#b0652f', { hat: '#2a2622', height: 1.7 }) }
}

/**
 * Standard landing: a timber jetty runs from the beach out to a moored boat in the direction of
 * `at` (seen from the island centre). Tang Ao arrives at the landward end of the jetty, facing
 * inland. Before the flower is found the boat offers to leave anyway; after, Duo Jiugong sums
 * up the moral and the chapter completes.
 */
export async function dockAndReturn(ctx: Ctx, id: ChapterId, at: THREE.Vector3, moralLines: Line[]): Promise<THREE.Object3D> {
  const s = ctx.stage
  const g = s.ground
  const angle = Math.atan2(at.z - (g?.cz ?? 0), at.x - (g?.cx ?? 0))
  const coast = g ? g.coast(angle) : Math.hypot(at.x, at.z)
  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
  const c0 = new THREE.Vector3(g?.cx ?? 0, 0, g?.cz ?? 0)
  const pt = (r: number) => c0.clone().addScaledVector(dir, r)
  // Jetty: planks with posts, from the upper beach out past the surf.
  const jetty = new THREE.Group()
  const deckY = WATER_Y + 0.5
  const wood = new THREE.MeshStandardMaterial({ color: '#9b7a55', roughness: 0.9 })
  const dark = new THREE.MeshStandardMaterial({ color: '#5f4632', roughness: 0.9 })
  const r0 = coast * 0.86
  const r1 = coast + 5.5
  for (let r = r0; r < r1; r += 0.42) {
    const p = pt(r)
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 2.1), wood)
    plank.position.set(p.x, Math.max(deckY, (g ? s.groundHeight(p.x, p.z) : deckY) + 0.05), p.z)
    plank.rotation.y = -angle
    plank.rotation.z = (Math.sin(r * 7.3) * 0.02)
    plank.material = (Math.round(r * 2.4) % 5 === 0 ? dark : wood)
    jetty.add(plank)
  }
  for (let r = coast * 0.95; r < r1; r += 1.6) {
    for (const side of [-1.05, 1.05]) {
      const p = pt(r).addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), side)
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 7), dark)
      post.position.set(p.x, deckY - 0.45, p.z)
      jetty.add(post)
    }
  }
  jetty.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  s.scene.add(jetty)
  const bp = pt(r1 + 1.2).addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), 2)
  const boat = (await s.prop('small_boat', bp.x, WATER_Y - 0.15, bp.z, { rotY: -angle })) ?? (await s.prop('canoe', bp.x, WATER_Y + 0.05, bp.z, { rotY: -angle + Math.PI / 2, scale: 1.8 }))
  if (boat) s.bob(boat, 0.07, 1.1)
  // Arrive on the beach at the head of the jetty, looking inland.
  const spawn = pt(coast * 0.74)
  ctx.setSpawn(spawn.setY(s.groundHeight(spawn.x, spawn.z) + 0.9))
  const spot = pt(coast * 0.87)
  spot.y = s.groundHeight(spot.x, spot.z)
  ctx.interact({
    pos: spot, radius: 2.2, verb: '登船', name: '小舟',
    enabled: () => true,
    run: async () => {
      if (!ctx.hasFlower) {
        const pick = await ctx.choose(NAMES.duo, `${CHAPTERS[id].name}的镜花还未寻得，唐兄要先回船上么？`, ['再看看', '先回船上'])
        if (pick === 1) ctx.leave()
        return
      }
      await ctx.say(moralLines)
      ctx.finish()
    },
  })
  return boat ?? jetty
}

/** Lantern posts along a path (generated model, or a simple post and lamp). */
export async function lanternPosts(stage: Stage, points: [number, number][], color = '#c8412f'): Promise<void> {
  for (const [x, z] of points) {
    const y = stage.groundHeight(x, z)
    const m = await stage.prop('lantern_post', x, y, z, { rotY: Math.atan2(x, z) })
    if (m) continue
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), new THREE.MeshLambertMaterial({ color: '#5a4636' }))
    post.position.set(x, y + 0.8, z)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }))
    lamp.scale.y = 1.25
    lamp.position.set(x, y + 1.75, z)
    stage.scene.add(post, lamp)
  }
}
