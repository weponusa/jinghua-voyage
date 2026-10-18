import * as THREE from 'three'
import type { Physics } from '../engine/physics'
import { instance, type ModelKey } from './models'
import { villager } from './stage'

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
}

/** A story character: a model on the ground that idles, turns toward Tang Ao and can be talked to. */
export class Npc {
  readonly root = new THREE.Group()
  readonly body = new THREE.Group()
  readonly name: string
  private yaw: number
  private readonly baseYaw: number
  private phase = Math.random() * 10
  lookAt: boolean
  /** Talking bounce, set by the dialogue system. */
  talking = false

  constructor(readonly spec: NpcSpec) {
    this.name = spec.name
    this.yaw = this.baseYaw = spec.yaw ?? 0
    this.lookAt = spec.lookAt ?? true
    this.root.position.set(spec.x, spec.y ?? 0, spec.z)
    this.root.add(this.body)
  }

  static async create(spec: NpcSpec, scene: THREE.Scene, physics: Physics): Promise<Npc> {
    const npc = new Npc(spec)
    const model = (spec.model ? await instance(spec.model) : null) ?? spec.fallback?.() ?? villager('#8a6f9e')
    if (spec.scale) model.scale.multiplyScalar(spec.scale)
    npc.body.add(model)
    scene.add(npc.root)
    if (spec.collider !== false) physics.addStaticCylinder(new THREE.Vector3(spec.x, (spec.y ?? 0) + 0.9, spec.z), 0.45 * (spec.scale ?? 1), 1.8 * (spec.scale ?? 1))
    return npc
  }

  get position(): THREE.Vector3 {
    return this.root.position
  }

  /** Height of the top of the head (for markers). */
  get top(): number {
    const box = new THREE.Box3().setFromObject(this.body)
    return Number.isFinite(box.max.y) ? box.max.y : this.root.position.y + 1.8
  }

  update(dt: number, player: THREE.Vector3): void {
    this.phase += dt
    const dx = player.x - this.root.position.x
    const dz = player.z - this.root.position.z
    const near = dx * dx + dz * dz < 36
    const target = this.lookAt && near ? Math.atan2(-dx, -dz) : this.baseYaw
    let d = (target - this.yaw) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    this.yaw += d * (1 - Math.exp(-5 * dt))
    this.body.rotation.y = this.yaw
    // Breathing idle; a livelier bob while speaking.
    const amp = this.talking ? 0.05 : 0.015
    const speed = this.talking ? 9 : 2
    this.body.position.y = Math.abs(Math.sin(this.phase * speed)) * amp
    this.body.rotation.z = Math.sin(this.phase * speed * 0.5) * (this.talking ? 0.04 : 0.012)
  }
}
