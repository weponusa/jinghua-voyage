import * as THREE from 'three'
import { RAPIER, type Physics } from '../engine/physics'
import { CONFIG } from './config'
import { villager } from './stage'
import { tuning } from './tuning'
import { CharacterAnimation } from './character-animation'

/** A kinematic platform the player can ride (none in this game yet, kept for the controller). */
export type MovingPlatform = { body: RAPIER.RigidBody; half: THREE.Vector3; delta: THREE.Vector3 }

export type PlayerIntent = { moveX: number; moveY: number; sprint: boolean; jumpPressed: boolean; jumpHeld: boolean; dashPressed: boolean }
export type PlayerEvent = { type: 'jump' } | { type: 'land'; impact: number } | { type: 'dash' }

const P = CONFIG.player
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Third-person character on Rapier's KinematicCharacterController: the controller resolves
 * collisions, slopes, steps and ground snapping; this class owns the "game feel" (acceleration,
 * coyote time, jump buffering, variable jump height, dash, moving-platform carry).
 */
export class Player {
  readonly root = new THREE.Group()
  readonly body: RAPIER.RigidBody
  readonly collider: RAPIER.Collider
  readonly velocity = new THREE.Vector3()
  grounded = false
  facing = 0
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly model = new THREE.Group()
  private readonly figure = new THREE.Group()
  private readonly shadow: THREE.Mesh
  private coyote = 0
  private jumpBuffer = 0
  private jumping = false
  private dashTime = 0
  private dashCooldown = 0
  private squash = 0
  private animation: CharacterAnimation
  private platform?: MovingPlatform
  /** Last position where the player stood on solid, static ground (respawn point after a fall). */
  readonly safe = new THREE.Vector3()
  private safeTimer = 0
  /** When true the controller ignores movement intent (dialogue, cut-scenes). */
  frozen = false

  constructor(private readonly physics: Physics, spawn: THREE.Vector3, private readonly movers: MovingPlatform[] = []) {
    const world = physics.world
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(P.halfHeight, P.radius).setFriction(0), this.body)
    this.controller = world.createCharacterController(0.02)
    this.controller.enableAutostep(0.4, 0.25, false)
    this.controller.enableSnapToGround(0.35)
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50))
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(35))
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.safe.copy(spawn)

    this.root.position.copy(spawn)
    // Feet sit at the bottom of the capsule.
    this.figure.position.y = -(P.halfHeight + P.radius)
    this.animation = new CharacterAnimation(villager('#3d6fa3', { hat: '#2a2622', height: 1.75, hatShape: 'tall' }))
    this.figure.add(this.animation.root)
    this.model.add(this.figure)
    this.model.rotation.order = 'YXZ'
    this.root.add(this.model)
    physics.bind(this.body, this.root)

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(P.radius * 1.25, 24),
      new THREE.MeshBasicMaterial({ color: '#1d1a2a', transparent: true, opacity: 0.35, depthWrite: false }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.renderOrder = 1
  }

  get shadowMesh(): THREE.Mesh {
    return this.shadow
  }

  /** Swap the stand-in figure for the loaded character model (feet at local y = 0, facing -Z). */
  setModel(obj: THREE.Object3D): void {
    this.animation.dispose()
    this.figure.clear()
    this.animation = new CharacterAnimation(obj)
    this.figure.add(this.animation.root)
  }

  get animationInfo(): ReturnType<CharacterAnimation['inspect']> {
    return this.animation.inspect()
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation()
    return new THREE.Vector3(t.x, t.y, t.z)
  }

  get dashing(): boolean {
    return this.dashTime > 0
  }

  /** One fixed step. `cameraYaw` makes stick/WASD movement camera-relative. */
  step(dt: number, intent: PlayerIntent, cameraYaw: number, events: PlayerEvent[]): void {
    if (this.frozen) intent = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false, dashPressed: false }
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new THREE.Vector3().crossVectors(forward, UP)
    const wish = new THREE.Vector3().addScaledVector(right, intent.moveX).addScaledVector(forward, intent.moveY)
    const wishLen = Math.min(1, wish.length())
    if (wishLen > 0.01) wish.normalize()

    this.coyote = this.grounded ? P.coyoteTime : Math.max(0, this.coyote - dt)
    this.jumpBuffer = intent.jumpPressed ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)

    if (intent.dashPressed && this.dashCooldown <= 0) {
      tuning.activate('dash')
      const dir = wishLen > 0.01 ? wish : new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
      this.facing = Math.atan2(-dir.x, -dir.z)
      this.velocity.set(dir.x * P.dashSpeed, Math.max(this.velocity.y, 0), dir.z * P.dashSpeed)
      this.dashTime = P.dashTime
      this.dashCooldown = P.dashCooldown
      events.push({ type: 'dash' })
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt
      this.velocity.y = Math.max(this.velocity.y, 0)
    } else {
      const speed = (intent.sprint ? P.sprintSpeed : P.walkSpeed) * wishLen
      const control = this.grounded ? 1 : P.airControl
      const target = wish.clone().multiplyScalar(speed)
      const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
      horizontal.lerp(target, 1 - Math.exp(-(P.acceleration / 6) * control * dt))
      this.velocity.x = horizontal.x
      this.velocity.z = horizontal.z

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        tuning.activate('jump')
        this.velocity.y = P.jumpSpeed
        this.jumping = true
        this.jumpBuffer = 0
        this.coyote = 0
        this.grounded = false
        this.platform = undefined
        this.squash = -0.35
        events.push({ type: 'jump' })
      }
      const rising = this.velocity.y > 0
      const gravity = rising && this.jumping && !intent.jumpHeld ? P.lowJumpGravity : P.gravity
      this.velocity.y = Math.max(P.maxFall, this.velocity.y + gravity * dt)
    }

    if (wishLen > 0.1 && this.dashTime <= 0) {
      const targetYaw = Math.atan2(-wish.x, -wish.z)
      this.facing = dampAngle(this.facing, targetYaw, P.turnSpeed, dt)
    }

    const desired = this.velocity.clone().multiplyScalar(dt)
    if (this.platform) desired.add(this.platform.delta)
    this.controller.computeColliderMovement(this.collider, desired)
    const moved = this.controller.computedMovement()
    const wasGrounded = this.grounded
    this.grounded = this.controller.computedGrounded()

    // Bumped a ceiling: stop rising. Hit a wall mid-dash: end the dash.
    if (this.velocity.y > 0 && moved.y < desired.y - 1e-3) this.velocity.y = 0
    if (this.grounded) {
      if (!wasGrounded && this.velocity.y < -6) {
        events.push({ type: 'land', impact: Math.min(1, -this.velocity.y / 30) })
        this.squash = Math.min(0.45, -this.velocity.y / 60)
      }
      if (this.velocity.y < 0) this.velocity.y = -1
      this.jumping = false
    }

    const cur = this.body.translation()
    const next = { x: cur.x + moved.x, y: cur.y + moved.y, z: cur.z + moved.z }
    this.body.setNextKinematicTranslation(next)
    this.platform = this.grounded ? this.findPlatform(next) : undefined

    if (this.grounded && !this.platform) {
      this.safeTimer += dt
      if (this.safeTimer > 0.4) this.safe.set(next.x, next.y + 0.2, next.z)
    } else {
      this.safeTimer = 0
    }
  }

  private findPlatform(pos: { x: number; y: number; z: number }): MovingPlatform | undefined {
    const feet = pos.y - P.halfHeight - P.radius
    return this.movers.find(m => {
      const c = m.body.translation()
      const top = c.y + m.half.y
      return Math.abs(feet - top) < 0.2 && Math.abs(pos.x - c.x) < m.half.x + P.radius * 0.6 && Math.abs(pos.z - c.z) < m.half.z + P.radius * 0.6
    })
  }

  /** Teleport (respawn). Clears velocity and interpolation so the camera does not streak. */
  teleport(to: THREE.Vector3): void {
    this.body.setTranslation(to, true)
    this.body.setNextKinematicTranslation(to)
    this.velocity.set(0, 0, 0)
    this.platform = undefined
    this.dashTime = 0
    this.root.position.copy(to)
    this.physics.snap(this.body)
  }

  /** Knock the player away from a hazard. */
  knockback(from: THREE.Vector3): void {
    const away = this.position.sub(from).setY(0)
    if (away.lengthSq() < 1e-4) away.set(1, 0, 0)
    away.normalize().multiplyScalar(9)
    this.velocity.set(away.x, 7, away.z)
    this.dashTime = 0
    this.grounded = false
    this.platform = undefined
  }

  /** Visual-only animation, once per rendered frame after `physics.sync()`. */
  animate(frameSeconds: number, time: number, invulnerable: boolean, ground: number | null): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    this.model.rotation.y = this.facing
    this.animation.update(frameSeconds, { speed: this.frozen ? 0 : speed, grounded: this.grounded || this.frozen, verticalSpeed: this.velocity.y })
    this.squash = THREE.MathUtils.damp(this.squash, 0, 10, frameSeconds)
    const s = 1 - this.squash * 0.2
    this.model.scale.set(1 / Math.sqrt(Math.max(s, 0.5)), s, 1 / Math.sqrt(Math.max(s, 0.5)))
    this.model.position.y = 0
    this.model.rotation.x = 0
    this.model.rotation.z = 0
    this.model.visible = !invulnerable || Math.floor(time * 16) % 2 === 0

    // Blob shadow: always-on depth cue for platforming, even with real shadows disabled.
    if (ground === null) {
      this.shadow.visible = false
    } else {
      const feet = this.root.position.y - P.halfHeight - P.radius
      const height = Math.max(0, feet - ground)
      this.shadow.visible = height < 14
      this.shadow.position.set(this.root.position.x, ground + 0.03, this.root.position.z)
      const k = THREE.MathUtils.clamp(1 - height / 14, 0.25, 1)
      this.shadow.scale.setScalar(k)
      ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.38 * k
    }
  }
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * (1 - Math.exp(-lambda * dt))
}
