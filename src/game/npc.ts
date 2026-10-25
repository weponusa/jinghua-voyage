import * as THREE from 'three'
import type { Physics } from '../engine/physics'
import { instance, type ModelKey } from './models'
import { villager } from './stage'
import { NpcAnimation, wrappedAngle, type NpcAnimationState, type NpcGesture } from './npc-animation'

export type NpcPatrolPoint = THREE.Vector3 | readonly [x: number, z: number]
export type NpcBehavior = {
  /** World-space route. Patrolling is opt-in; talking temporarily pauses it. */
  patrol?: {
    path: readonly NpcPatrolPoint[]
    speed?: number
    pause?: number
  }
}

export type NpcSpec = {
  name: string
  model?: ModelKey
  /** Procedural stand-in (also used when the generated model is missing). */
  fallback?: () => THREE.Object3D
  x: number
  z: number
  y?: number
  /** Initial facing (radians, 0 = facing -Z). */
  yaw?: number
  /** Turn to face the player when near. */
  lookAt?: boolean
  /** Uniform scale on top of the model's normalised height. */
  scale?: number
  collider?: boolean
  behavior?: NpcBehavior
}

/** A story character: a model on the ground that idles, turns toward Tang Ao and can be talked to. */
export class Npc {
  readonly root = new THREE.Group()
  readonly body = new THREE.Group()
  readonly name: string
  private yaw: number
  private readonly baseYaw: number
  private phase = Math.random() * 10
  private rig?: NpcAnimation
  private readonly patrolPath?: Float32Array
  private patrolIndex = 0
  private patrolPause = 0
  private patrolYaw = 0
  lookAt: boolean
  /** Set by the dialogue system; drives jaw, head and one-hand gestures. */
  talking = false
  /** Suppresses procedural bone motion without disabling explicit patrol routes. */
  reducedMotion = false

  constructor(readonly spec: NpcSpec) {
    this.name = spec.name
    this.yaw = this.baseYaw = spec.yaw ?? 0
    this.lookAt = spec.lookAt ?? true
    this.root.position.set(spec.x, spec.y ?? 0, spec.z)
    this.root.add(this.body)
    const patrol = spec.behavior?.patrol
    if (patrol && patrol.path.length >= 2) {
      const path = new Float32Array(patrol.path.length * 2)
      this.patrolPath = path
      patrol.path.forEach((point, index) => {
        path[index * 2] = point instanceof THREE.Vector3 ? point.x : point[0]
        path[index * 2 + 1] = point instanceof THREE.Vector3 ? point.z : point[1]
      })
      const firstX = path[0]!
      const firstZ = path[1]!
      this.patrolIndex = Math.hypot(firstX - spec.x, firstZ - spec.z) < 0.05 ? 1 : 0
    }
  }

  static async create(spec: NpcSpec, scene: THREE.Scene, physics: Physics): Promise<Npc> {
    const npc = new Npc(spec)
    const model = (spec.model ? await instance(spec.model) : null) ?? spec.fallback?.() ?? villager('#8a6f9e')
    if (spec.scale) model.scale.multiplyScalar(spec.scale)
    npc.body.add(model)
    npc.rig = new NpcAnimation(model, npc.phase)
    scene.add(npc.root)
    // A static cylinder would be left behind by a moving NPC, so patrol routes use no static body.
    if (spec.collider !== false && !npc.patrolPath) physics.addStaticCylinder(new THREE.Vector3(spec.x, (spec.y ?? 0) + 0.9, spec.z), 0.45 * (spec.scale ?? 1), 1.8 * (spec.scale ?? 1))
    return npc
  }

  get position(): THREE.Vector3 {
    return this.root.position
  }

  get animationState(): NpcAnimationState | 'static' {
    return this.rig?.inspect().state ?? 'static'
  }

  /** Read-only diagnostics for scene inspection and automated acceptance. */
  get animationInfo(): { kind: string; state: NpcAnimationState | 'static'; gesture: NpcGesture; bones: number; skinnedMeshes: number } {
    return this.rig?.inspect() ?? { kind: 'static', state: 'static', gesture: 'none', bones: 0, skinnedMeshes: 0 }
  }

  /** Height of the top of the head (for markers). */
  get top(): number {
    const box = new THREE.Box3().setFromObject(this.body)
    return Number.isFinite(box.max.y) ? box.max.y : this.root.position.y + 1.8
  }

  update(dt: number, player: THREE.Vector3): void {
    const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1)
    this.phase += step
    const walking = this.updatePatrol(step)
    const dx = player.x - this.root.position.x
    const dz = player.z - this.root.position.z
    const near = dx * dx + dz * dz < 36
    const playerYaw = Math.atan2(-dx, -dz)
    const target = walking ? this.patrolYaw : this.lookAt && near ? playerYaw : this.baseYaw
    this.yaw += wrappedAngle(target - this.yaw) * (1 - Math.exp(-5 * step))
    this.body.rotation.y = this.yaw
    this.body.position.y = 0
    this.body.rotation.z = 0
    this.rig?.update(step, {
      gaze: near ? wrappedAngle(playerYaw - this.yaw) : 0,
      talking: this.talking,
      walking,
      speed: this.spec.behavior?.patrol?.speed,
      reducedMotion: this.reducedMotion,
    })
  }

  private updatePatrol(dt: number): boolean {
    const path = this.patrolPath
    if (!path || this.talking) return false
    if (this.patrolPause > 0) {
      this.patrolPause = Math.max(0, this.patrolPause - dt)
      return false
    }
    const targetX = path[this.patrolIndex * 2]!
    const targetZ = path[this.patrolIndex * 2 + 1]!
    const dx = targetX - this.root.position.x
    const dz = targetZ - this.root.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.035) {
      this.root.position.x = targetX
      this.root.position.z = targetZ
      this.patrolIndex = (this.patrolIndex + 1) % (path.length / 2)
      this.patrolPause = Math.max(0, this.spec.behavior?.patrol?.pause ?? 1.2)
      return false
    }
    const speed = THREE.MathUtils.clamp(this.spec.behavior?.patrol?.speed ?? 0.65, 0.05, 3)
    const travel = Math.min(distance, speed * dt)
    this.root.position.x += dx / distance * travel
    this.root.position.z += dz / distance * travel
    this.patrolYaw = Math.atan2(-dx, -dz)
    return travel > 0
  }
}
