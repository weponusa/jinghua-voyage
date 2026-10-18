import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CONFIG, DEFAULT_CONFIG } from '../src/game/config'
import { tuning } from '../src/game/tuning'
import { initPhysics, Physics } from '../src/engine/physics'
import { Player, type PlayerIntent } from '../src/game/player'
import { FollowCamera } from '../src/game/camera'

const defaults = Object.fromEntries(tuning.controls.map(control => [control.id, control.default]))
afterEach(() => {
  tuning.apply(defaults)
  tuning.activate('jump')
})

describe('Three.js tuning', () => {
  it('exposes only controls this exploration game uses', () => {
    const ids = tuning.controls.map(c => c.id)
    expect(ids).not.toContain('player.dashSpeed')
    expect(ids.some(id => id.startsWith('run.'))).toBe(false)
  })

  it('validates the entire patch before committing and preserves source defaults', () => {
    const before = tuning.read()
    for (const patch of [{ 'player.walkSpeed': 6, 'camera.fov': 999 }, { 'player.walkSpeed': 13 },
      { 'player.walkSpeed': 5.1 }, { 'player.walkSpeed': '6' }, { 'camera.fov': Infinity }, { unknown: 4 }]) {
      expect(() => tuning.apply(patch)).toThrow()
      expect(tuning.read()).toEqual(before)
    }
    tuning.apply({ 'player.walkSpeed': 12, 'player.sprintSpeed': 14 })
    expect(CONFIG.player.walkSpeed).toBe(12)
    expect(CONFIG.player.sprintSpeed).toBe(14)
    expect(DEFAULT_CONFIG.player.walkSpeed).toBe(4.6)
    const applied = tuning.read(); tuning.apply({ 'player.walkSpeed': 12 }); expect(tuning.read()).toEqual(applied)
  })

  it('keeps next-jump values pending until the next jump', () => {
    tuning.apply({ 'player.jumpSpeed': 14 })
    expect(CONFIG.player.jumpSpeed).toBe(DEFAULT_CONFIG.player.jumpSpeed)
    tuning.activate('jump')
    expect(CONFIG.player.jumpSpeed).toBe(14)
  })

  it('changes real player movement and the next jump without replacing physics', async () => {
    await initPhysics()
    const physics = new Physics()
    const player = new Player(physics, new THREE.Vector3(0, 5, 0))
    const intent: PlayerIntent = { moveX: 1, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: true, dashPressed: false }
    try {
      player.grounded = true; player.step(1 / 60, intent, 0, [])
      const oldSpeed = player.velocity.x
      player.teleport(new THREE.Vector3(0, 5, 0)); player.grounded = true
      tuning.apply({ 'player.walkSpeed': 6 })
      player.step(1 / 60, intent, 0, [])
      expect(player.velocity.x).toBeGreaterThan(oldSpeed)
      player.grounded = true
      tuning.apply({ 'player.jumpSpeed': 14 })
      player.step(1 / 60, { ...intent, moveX: 0, jumpPressed: true }, 0, [])
      expect(player.velocity.y).toBeCloseTo(14 + CONFIG.player.gravity / 60)
      tuning.apply({ 'player.jumpSpeed': 16 })
      player.step(1 / 60, { ...intent, moveX: 0 }, 0, [])
      expect(tuning.read().active['player.jumpSpeed']).toBe(14)
      expect(player.velocity.y).toBeLessThan(14)
    } finally { physics.dispose() }
  })

  it('updates the actual camera projection without replacing the camera', async () => {
    await initPhysics()
    const physics = new Physics()
    const player = new Player(physics, new THREE.Vector3(0, 5, 0))
    const camera = new FollowCamera(physics, player.collider)
    try {
      const before = camera.camera.projectionMatrix.clone()
      tuning.apply({ 'camera.fov': 90, 'camera.distance': 9 })
      camera.update(new THREE.Vector3(0, 5, 0), { x: 0, y: 0 }, 1, true)
      expect(camera.camera.fov).toBe(90)
      expect(camera.camera.projectionMatrix.equals(before)).toBe(false)
      expect(camera.camera.position.distanceTo(new THREE.Vector3(0, 5 + CONFIG.camera.height * 0.45, 0))).toBeCloseTo(9)
    } finally { physics.dispose() }
  })
})
