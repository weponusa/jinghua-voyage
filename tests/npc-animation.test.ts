import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { NpcAnimation } from '../src/game/npc-animation'
import { Npc } from '../src/game/npc'
import type { Physics } from '../src/engine/physics'

function figure(): THREE.Group {
  const root = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: '#8799aa' })
  const add = (geometry: THREE.BufferGeometry, x: number, y: number, name: string): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y)
    mesh.name = name
    root.add(mesh)
    return mesh
  }
  add(new THREE.BoxGeometry(0.46, 0.76, 0.28), 0, 1.08, 'robe')
  add(new THREE.BoxGeometry(0.16, 0.72, 0.18), -0.15, 0.36, 'left leg')
  add(new THREE.BoxGeometry(0.16, 0.72, 0.18), 0.15, 0.36, 'right leg')
  add(new THREE.BoxGeometry(0.14, 0.58, 0.14), -0.36, 1.08, 'left sleeve')
  add(new THREE.BoxGeometry(0.14, 0.58, 0.14), 0.36, 1.08, 'right sleeve')
  add(new THREE.SphereGeometry(0.25, 12, 8), 0, 1.75, 'head')
  return root
}

function skinned(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = []
  root.traverse(object => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(object as THREE.SkinnedMesh) })
  return meshes
}

function deformedVertex(mesh: THREE.SkinnedMesh, index: number): THREE.Vector3 {
  let scene: THREE.Object3D = mesh
  while (scene.parent) scene = scene.parent
  scene.updateMatrixWorld(true)
  mesh.skeleton.update()
  return mesh.applyBoneTransform(index, new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index))
}

function deformedWorldVertex(mesh: THREE.SkinnedMesh, index: number): THREE.Vector3 {
  return deformedVertex(mesh, index).applyMatrix4(mesh.matrixWorld)
}

function physicsStub(): Physics {
  return { addStaticCylinder: vi.fn() } as unknown as Physics
}

describe('NpcAnimation', () => {
  it('binds in the exact source shape and creates normalized four-influence skin weights', () => {
    const animation = new NpcAnimation(figure(), 2)
    expect(animation.inspect()).toEqual({ kind: 'skinned-npc', state: 'idle', gesture: 'none', bones: 16, skinnedMeshes: 6 })
    for (const mesh of skinned(animation.root)) {
      const positions = mesh.geometry.getAttribute('position')
      const weights = mesh.geometry.getAttribute('skinWeight')
      const indices = mesh.geometry.getAttribute('skinIndex')
      expect(indices.itemSize).toBe(4)
      expect(weights.count).toBe(positions.count)
      for (let vertex = 0; vertex < weights.count; vertex += 1) {
        const total = weights.getX(vertex) + weights.getY(vertex) + weights.getZ(vertex) + weights.getW(vertex)
        expect(total).toBeCloseTo(1, 5)
      }
      for (let vertex = 0; vertex < positions.count; vertex += 3) {
        const source = new THREE.Vector3().fromBufferAttribute(positions, vertex)
        expect(deformedVertex(mesh, vertex).distanceTo(source)).toBeLessThan(0.000001)
      }
    }
    animation.dispose()
  })

  it('bakes transformed meshes into parent-local coordinates without changing the bind pose', () => {
    const parent = new THREE.Group()
    parent.rotation.y = 0.7
    parent.scale.setScalar(1.4)
    const source = figure()
    source.rotation.y = -0.4
    source.scale.setScalar(0.8)
    source.position.set(0.2, 0.1, -0.1)
    parent.add(source)
    parent.updateMatrixWorld(true)
    const original = source.getObjectByName('robe') as THREE.Mesh
    const sourcePositions = original.geometry.getAttribute('position')
    const expected: THREE.Vector3[] = []
    const inverseParent = parent.matrixWorld.clone().invert()
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      expected.push(new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex).applyMatrix4(original.matrixWorld).applyMatrix4(inverseParent))
    }
    const animation = new NpcAnimation(source)
    const mesh = skinned(animation.root).find(item => item.name === 'robe')!
    for (let vertex = 0; vertex < expected.length; vertex += 1) {
      expect(deformedVertex(mesh, vertex).distanceTo(expected[vertex]!)).toBeLessThan(0.000001)
    }
    animation.dispose()
  })

  it('preserves world-space bind-pose vertices under a translated, rotated and scaled parent', () => {
    const parent = new THREE.Group()
    parent.position.set(3.2, 0.4, -2.1)
    parent.rotation.set(0.15, 0.7, -0.1)
    parent.scale.set(1.4, 1.2, 0.9)
    const source = figure()
    source.position.set(0.2, 0.1, -0.1)
    source.rotation.y = -0.4
    source.scale.setScalar(0.8)
    parent.add(source)
    parent.updateMatrixWorld(true)
    const expected = new Map<string, THREE.Vector3[]>()
    source.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return
      const mesh = object as THREE.Mesh
      const positions = mesh.geometry.getAttribute('position')
      expected.set(mesh.name, Array.from({ length: positions.count }, (_, vertex) =>
        new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld)))
    })

    const animation = new NpcAnimation(source)
    parent.updateMatrixWorld(true)
    for (const mesh of skinned(animation.root)) {
      expect(mesh.bindMatrix.equals(mesh.matrixWorld)).toBe(true)
      mesh.skeleton.bones.forEach((bone, index) => {
        expect(mesh.skeleton.boneInverses[index]!.equals(bone.matrixWorld.clone().invert())).toBe(true)
      })
      const vertices = expected.get(mesh.name)!
      for (let vertex = 0; vertex < vertices.length; vertex += 1) {
        expect(deformedWorldVertex(mesh, vertex).distanceTo(vertices[vertex]!)).toBeLessThan(0.000001)
      }
    }
    animation.dispose()
  })

  it('deforms actual vertices for speech and returns to neutral with reduced motion', () => {
    const animation = new NpcAnimation(figure(), 2)
    const mesh = skinned(animation.root)[0]!
    const before = deformedVertex(mesh, 0)
    animation.update(0.1, { gaze: 0.35, talking: true, walking: false, reducedMotion: false })
    const after = deformedVertex(mesh, 0)
    expect(after.distanceTo(before)).toBeGreaterThan(0.0001)
    expect(animation.inspect().state).toBe('talk')
    for (let frame = 0; frame < 100; frame += 1) animation.update(0.1, { gaze: 0.35, talking: false, walking: false, reducedMotion: true })
    expect(animation.inspect().state).toBe('reduced')
    expect(animation.root.position.length()).toBe(0)
    animation.dispose()
  })

  it('preserves named story parts outside the full-body skin', () => {
    const source = figure()
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial())
    flap.name = 'Hinged浩然巾 back flap'
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial())
    face.name = 'Hidden rear face'
    source.add(flap, face)
    const animation = new NpcAnimation(source)
    expect(source.getObjectByName(flap.name)).toBe(flap)
    expect(source.getObjectByName(face.name)).toBe(face)
    expect(flap.visible).toBe(true)
    expect(face.visible).toBe(true)
    expect(animation.inspect().skinnedMeshes).toBe(6)
    animation.dispose()
  })
})

describe('Npc behavior', () => {
  it('keeps the whole body planted while talking and exposes diagnostics', async () => {
    const npc = await Npc.create({ name: 'test', x: 0, z: 0, fallback: figure }, new THREE.Scene(), physicsStub())
    npc.talking = true
    npc.update(0.1, new THREE.Vector3(1, 0, -2))
    expect(npc.body.position.y).toBe(0)
    expect(npc.body.rotation.z).toBe(0)
    expect(npc.animationState).toBe('talk')
    expect(npc.animationInfo.bones).toBe(16)
    expect(skinned(npc.body).length).toBe(6)
  })

  it('centres freshly baked skin at the Npc interaction root without a pre-updated world matrix', async () => {
    const scene = new THREE.Scene()
    const npc = await Npc.create({ name: 'fresh', x: -0.9, z: -4, fallback: figure }, scene, physicsStub())
    scene.updateMatrixWorld(true)
    const bounds = new THREE.Box3()
    for (const mesh of skinned(npc.body)) {
      mesh.computeBoundingBox()
      bounds.union(mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld))
    }
    const centre = bounds.getCenter(new THREE.Vector3())
    expect(Math.hypot(centre.x - npc.position.x, centre.z - npc.position.z)).toBeLessThan(0.000001)
  })

  it('translates skinned world vertices exactly once when the Npc root moves', async () => {
    const scene = new THREE.Scene()
    const npc = await Npc.create({ name: 'moving', x: -0.9, z: -4, fallback: figure }, scene, physicsStub())
    const mesh = skinned(npc.body).find(item => item.name === 'robe')!
    const before = deformedWorldVertex(mesh, 0)
    npc.root.position.set(2.1, 0, 6)
    const after = deformedWorldVertex(mesh, 0)
    expect(after.sub(before).distanceTo(new THREE.Vector3(3, 0, 10))).toBeLessThan(0.000001)
  })

  it('moves the live interaction position on opt-in patrol and pauses for dialogue', async () => {
    const physics = physicsStub()
    const npc = await Npc.create({
      name: 'patrol', x: 0, z: 0, fallback: figure,
      behavior: { patrol: { path: [[0, 0], [0, -1]], speed: 1, pause: 0 } },
    }, new THREE.Scene(), physics)
    const interactionPosition = npc.position
    npc.update(0.1, new THREE.Vector3(5, 0, 5))
    expect(interactionPosition.z).toBeCloseTo(-0.1)
    expect(npc.position).toBe(interactionPosition)
    expect(npc.animationState).toBe('walk')
    expect(physics.addStaticCylinder).not.toHaveBeenCalled()
    npc.talking = true
    npc.update(0.1, new THREE.Vector3(5, 0, 5))
    expect(npc.position.z).toBeCloseTo(-0.1)
    expect(npc.animationState).toBe('talk')
  })
})
