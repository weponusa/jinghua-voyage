import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CharacterAnimation } from '../src/game/character-animation'

function sourceFigure(): THREE.Group {
  const figure = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: '#7996b9' })
  const add = (geometry: THREE.BufferGeometry, x: number, y: number, z = 0): void => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    figure.add(mesh)
  }
  add(new THREE.BoxGeometry(0.46, 0.76, 0.28), 0, 1.08)
  add(new THREE.BoxGeometry(0.16, 0.72, 0.18), -0.15, 0.36)
  add(new THREE.BoxGeometry(0.16, 0.72, 0.18), 0.15, 0.36)
  add(new THREE.BoxGeometry(0.14, 0.58, 0.14), -0.36, 1.08)
  add(new THREE.BoxGeometry(0.14, 0.58, 0.14), 0.36, 1.08)
  add(new THREE.SphereGeometry(0.25, 12, 8), 0, 1.75)
  return figure
}

function skinned(root: THREE.Object3D): THREE.SkinnedMesh {
  let result: THREE.SkinnedMesh | undefined
  root.traverse(object => { if ((object as THREE.SkinnedMesh).isSkinnedMesh && !result) result = object as THREE.SkinnedMesh })
  if (!result) throw new Error('expected a skinned mesh')
  return result
}

function deformedVertex(mesh: THREE.SkinnedMesh, index: number): THREE.Vector3 {
  mesh.updateMatrixWorld(true)
  mesh.skeleton.update()
  return mesh.applyBoneTransform(index, new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index))
}

describe('CharacterAnimation', () => {
  it('dequantizes compressed vertex attributes before baking transforms', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Int16BufferAttribute([0, 16384, 0, 16384, -16384, 0, -16384, 0, 16384], 3, true))
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
    mesh.position.y = 1
    mesh.scale.setScalar(2)
    mesh.updateMatrixWorld(true)
    const expected = Array.from({ length: 3 }, (_, index) => new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), index).applyMatrix4(mesh.matrixWorld))
    const animation = new CharacterAnimation(mesh)
    const positions = skinned(animation.root).geometry.getAttribute('position')
    expect(positions.array).toBeInstanceOf(Float32Array)
    expected.forEach((point, index) => expect(new THREE.Vector3().fromBufferAttribute(positions, index).distanceTo(point)).toBeLessThan(0.000001))
    animation.dispose()
  })

  it('preserves the baked source shape in its neutral bind pose', () => {
    const animation = new CharacterAnimation(sourceFigure())
    animation.root.traverse(object => {
      const mesh = object as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const positions = mesh.geometry.getAttribute('position')
      for (let index = 0; index < positions.count; index += 3) {
        const source = new THREE.Vector3().fromBufferAttribute(positions, index)
        expect(deformedVertex(mesh, index).distanceTo(source)).toBeLessThan(0.000001)
      }
    })
    animation.dispose()
  })

  it('creates a stable humanoid skeleton with four normalized skin influences per vertex', () => {
    const animation = new CharacterAnimation(sourceFigure())
    expect(animation.inspect()).toEqual({ kind: 'skinned-humanoid', state: 'idle', bones: 17, skinnedMeshes: 6 })
    const mesh = skinned(animation.root)
    const indices = mesh.geometry.getAttribute('skinIndex')
    const weights = mesh.geometry.getAttribute('skinWeight')
    const indexValues = indices.array as Uint16Array
    const weightValues = weights.array as Float32Array
    expect(indices.itemSize).toBe(4)
    expect(weights.itemSize).toBe(4)
    expect(indices.count).toBe(weights.count)
    for (let vertex = 0; vertex < weights.count; vertex += 1) {
      let total = 0
      for (let influence = 0; influence < 4; influence += 1) {
        total += weightValues[vertex * 4 + influence]!
        expect(indexValues[vertex * 4 + influence]!).toBeGreaterThanOrEqual(0)
        expect(indexValues[vertex * 4 + influence]!).toBeLessThan(17)
      }
      expect(total).toBeCloseTo(1, 5)
    }
    expect(typeof animation.root.userData.disposeCharacter).toBe('function')
    animation.dispose()
  })

  it('moves a genuinely skinned vertex through the AnimationMixer rather than moving the whole object', () => {
    const animation = new CharacterAnimation(sourceFigure())
    const mesh = skinned(animation.root)
    const thigh = mesh.skeleton.bones.findIndex(bone => bone.name === 'LeftThigh')
    const indices = mesh.geometry.getAttribute('skinIndex')
    const indexValues = indices.array as Uint16Array
    const vertex = Array.from({ length: indices.count }, (_, index) => index).find(index =>
      [0, 1, 2, 3].some(slot => indexValues[index * 4 + slot] === thigh),
    )
    expect(vertex).toBeDefined()
    const before = deformedVertex(mesh, vertex!)
    animation.update(0.1, { speed: 4.6, grounded: true, verticalSpeed: 0 })
    const after = deformedVertex(mesh, vertex!)
    expect(animation.root.position.length()).toBe(0)
    expect(after.distanceTo(before)).toBeGreaterThan(0.001)
    animation.dispose()
  })

  it('stops stepping at idle and selects jump and falling clips from airborne motion', () => {
    const animation = new CharacterAnimation(sourceFigure())
    animation.update(0.1, { speed: 4.6, grounded: true, verticalSpeed: 0 })
    expect(animation.inspect().state).toBe('walk')
    animation.update(0.1, { speed: 0, grounded: true, verticalSpeed: 0 })
    expect(animation.inspect().state).toBe('idle')
    animation.update(0.1, { speed: 0, grounded: false, verticalSpeed: 5 })
    expect(animation.inspect().state).toBe('jump')
    animation.update(0.1, { speed: 0, grounded: false, verticalSpeed: -4 })
    expect(animation.inspect().state).toBe('fall')
    animation.dispose()
  })

  it('owns each rig and mixer independently and has idempotent disposal', () => {
    const first = new CharacterAnimation(sourceFigure())
    const second = new CharacterAnimation(sourceFigure())
    first.update(0.1, { speed: 7.5, grounded: true, verticalSpeed: 0 })
    second.update(0.1, { speed: 0, grounded: true, verticalSpeed: 0 })
    const firstThigh = skinned(first.root).skeleton.getBoneByName('LeftThigh')!
    const secondThigh = skinned(second.root).skeleton.getBoneByName('LeftThigh')!
    expect(firstThigh.quaternion.angleTo(secondThigh.quaternion)).toBeGreaterThan(0.001)
    first.dispose()
    first.dispose()
    expect(first.root.children).toHaveLength(0)
    second.update(0.1, { speed: 4.6, grounded: true, verticalSpeed: 0 })
    expect(second.inspect().state).toBe('walk')
    second.dispose()
  })
})
