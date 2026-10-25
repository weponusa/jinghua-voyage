import * as THREE from 'three'

const BONE_NAMES = [
  'Pelvis', 'Spine', 'Head', 'Jaw',
  'LeftUpperArm', 'LeftForearm', 'LeftHand',
  'RightUpperArm', 'RightForearm', 'RightHand',
  'LeftThigh', 'LeftShin', 'LeftFoot',
  'RightThigh', 'RightShin', 'RightFoot',
] as const

type BoneName = (typeof BONE_NAMES)[number]
type BoneMap = Record<BoneName, THREE.Bone>
type BakedMesh = {
  source: THREE.Mesh
  geometry: THREE.BufferGeometry
  shared: boolean
}
type Segment = { a: THREE.Vector3; b: THREE.Vector3; radius: number }

export type NpcAnimationState = 'idle' | 'talk' | 'walk' | 'reduced'
export type NpcGesture = 'sleeve' | 'salute' | 'nod' | 'guide' | 'none'
export type NpcAnimationFrame = {
  /** Desired head yaw relative to the body, already wrapped to [-PI, PI]. */
  gaze: number
  talking: boolean
  walking: boolean
  speed?: number
  reducedMotion: boolean
}

const PROTECTED_PARTS = new Set(['Hinged浩然巾 back flap', 'Hidden rear face'])
const GESTURES = ['sleeve', 'salute', 'nod', 'guide'] as const
const TAU = Math.PI * 2

/**
 * Converts a static, normalised character into a compact runtime rig. Geometry and weights are
 * created once; the frame loop only writes bone transforms. This is spatial auto-rigging rather
 * than authored skinning, so deliberately small amplitudes keep unfamiliar GLB silhouettes stable.
 */
export class NpcAnimation {
  readonly root = new THREE.Group()

  private readonly skeleton: THREE.Skeleton
  private readonly bones: BoneMap
  private readonly skinnedMeshes: THREE.SkinnedMesh[] = []
  private readonly derivedGeometries = new Set<THREE.BufferGeometry>()
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>()
  private readonly ownedMaterials = new Set<THREE.Material>()
  private readonly ownedTextures = new Set<THREE.Texture>()
  private readonly height: number
  private readonly phase: number
  private time = 0
  private idleTime: number
  private gait = 0
  private headYaw = 0
  private talkBlend = 0
  private walkBlend = 0
  private state: NpcAnimationState = 'idle'
  private gesture: NpcGesture = 'none'
  private readonly diagnostics: { kind: string; state: NpcAnimationState; gesture: NpcGesture; bones: number; skinnedMeshes: number }
  private disposed = false

  constructor(source: THREE.Object3D, phase = 0) {
    this.phase = phase
    this.idleTime = phase % 5
    this.root.name = 'NpcAnimationRoot'
    this.root.userData.disposeCharacter = () => this.dispose()

    const parent = source.parent
    const baked = this.bakeMeshes(source, parent)
    const bounds = boundsFor(baked.map(entry => entry.geometry))
    this.height = safeHeight(bounds)
    this.bones = createBones(bounds)
    this.skeleton = new THREE.Skeleton(BONE_NAMES.map(name => this.bones[name]))
    this.root.add(this.bones.Pelvis)

    // Baked vertices and bone rest positions are both expressed in parent-local coordinates.
    for (const entry of baked) {
      addSkinAttributes(entry.geometry, bounds, this.bones, this.root)
      const sourceMesh = entry.source
      const mesh = new THREE.SkinnedMesh(entry.geometry, sourceMesh.material)
      mesh.name = sourceMesh.name
      mesh.castShadow = sourceMesh.castShadow
      mesh.receiveShadow = sourceMesh.receiveShadow
      mesh.frustumCulled = false
      mesh.userData.sharedModel = entry.shared
      this.skinnedMeshes.push(mesh)
      this.root.add(mesh)
    }
    // Bind in the final hierarchy so vertices, bones and mesh binding share one world space.
    parent?.add(this.root)
    this.root.updateMatrixWorld(true)
    this.skeleton.calculateInverses()
    for (const mesh of this.skinnedMeshes) mesh.bind(this.skeleton, mesh.matrixWorld)
    this.diagnostics = { kind: 'skinned-npc', state: 'idle', gesture: 'none', bones: this.skeleton.bones.length, skinnedMeshes: this.skinnedMeshes.length }

    // Keep special story meshes in their original hierarchy. Any other children are reattached
    // before removing a baked source mesh, preserving their world transforms.
    for (const entry of baked) {
      const mesh = entry.source
      const host = mesh.parent
      if (!host) continue
      for (const child of [...mesh.children]) host.attach(child)
      mesh.removeFromParent()
    }
  }

  /** Advance layered motion without allocating vectors, arrays or animation actions per frame. */
  update(dt: number, frame: NpcAnimationFrame): void {
    if (this.disposed) return
    const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1)
    const motion = frame.reducedMotion ? 0 : 1
    this.time += step * motion
    if (!frame.talking && !frame.walking) this.idleTime += step * motion
    this.talkBlend = THREE.MathUtils.damp(this.talkBlend, frame.talking ? motion : 0, 8, step)
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, frame.walking ? motion : 0, 10, step)
    this.headYaw = THREE.MathUtils.damp(this.headYaw, THREE.MathUtils.clamp(frame.gaze, -0.72, 0.72) * motion, 5, step)
    this.gait += step * (5.2 + Math.min(frame.speed ?? 0, 2.5) * 1.4) * this.walkBlend
    this.state = frame.reducedMotion ? 'reduced' : frame.walking ? 'walk' : frame.talking ? 'talk' : 'idle'

    const breath = Math.sin(this.time * 1.55 + this.phase) * 0.009 * motion
    const shift = Math.sin(this.time * 0.48 + this.phase) * (1 - this.walkBlend) * motion
    const stride = Math.sin(this.gait) * this.walkBlend
    const leftKnee = Math.max(0, -stride)
    const rightKnee = Math.max(0, stride)
    const talk = this.talkBlend
    const gestureWeight = this.idleGestureWeight() * (1 - talk) * (1 - this.walkBlend) * motion
    const h = this.height
    const b = this.bones

    b.Pelvis.position.x = b.Pelvis.userData.restX + shift * h * 0.009
    b.Pelvis.position.y = b.Pelvis.userData.restY + Math.abs(stride) * h * 0.006
    b.Pelvis.rotation.set(0, stride * 0.025, shift * 0.012)
    b.Spine.rotation.set(breath - this.walkBlend * 0.025, -stride * 0.035, -shift * 0.016)
    b.Head.rotation.set(breath * -0.5 + Math.sin(this.time * 3.4) * talk * 0.026, this.headYaw - stride * 0.018, 0)
    b.Jaw.rotation.set(talk * (0.045 + (Math.sin(this.time * 12.3) * 0.5 + 0.5) * 0.085), 0, 0)

    b.LeftThigh.rotation.set(stride * 0.38, 0, -shift * 0.018)
    b.RightThigh.rotation.set(-stride * 0.38, 0, shift * 0.018)
    b.LeftShin.rotation.set(-leftKnee * 0.5, 0, 0)
    b.RightShin.rotation.set(-rightKnee * 0.5, 0, 0)
    b.LeftFoot.rotation.set(-stride * 0.08 + leftKnee * 0.1, 0, 0)
    b.RightFoot.rotation.set(stride * 0.08 + rightKnee * 0.1, 0, 0)

    b.LeftUpperArm.rotation.set(-stride * 0.24 + breath, 0, -0.012)
    b.RightUpperArm.rotation.set(stride * 0.24 - breath, 0, 0.012)
    b.LeftForearm.rotation.set(-rightKnee * 0.15, 0, 0)
    b.RightForearm.rotation.set(-leftKnee * 0.15, 0, 0)
    b.LeftHand.rotation.set(0, 0, 0)
    b.RightHand.rotation.set(0, 0, 0)

    // A single hand accompanies speech; the other remains quiet instead of full-body bouncing.
    const speechWave = Math.sin(this.time * 4.6)
    b.RightUpperArm.rotation.x += talk * (-0.3 + speechWave * 0.06)
    b.RightUpperArm.rotation.z += talk * 0.12
    b.RightForearm.rotation.x += talk * (-0.62 + speechWave * 0.12)
    b.RightHand.rotation.z = talk * speechWave * 0.16
    this.applyIdleGesture(gestureWeight)
    this.root.updateMatrixWorld(true)
  }

  inspect(): Readonly<{ kind: string; state: NpcAnimationState; gesture: NpcGesture; bones: number; skinnedMeshes: number }> {
    this.diagnostics.state = this.state
    this.diagnostics.gesture = this.gesture
    return this.diagnostics
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.skeleton.boneTexture?.dispose()
    this.skeleton.boneTexture = null
    this.derivedGeometries.forEach(geometry => geometry.dispose())
    this.ownedGeometries.forEach(geometry => geometry.dispose())
    this.ownedTextures.forEach(texture => texture.dispose())
    this.ownedMaterials.forEach(material => material.dispose())
    this.root.clear()
  }

  private idleGestureWeight(): number {
    const cycle = Math.floor(this.idleTime / 8)
    const local = this.idleTime - cycle * 8
    const kind = GESTURES[(cycle + Math.floor(this.phase)) % GESTURES.length]!
    const active = local > 1.4 && local < 4.4
    this.gesture = active && this.state === 'idle' ? kind : 'none'
    if (!active) return 0
    const t = (local - 1.4) / 3
    return Math.sin(t * Math.PI) ** 2
  }

  private applyIdleGesture(weight: number): void {
    if (weight <= 0) return
    const b = this.bones
    switch (this.gesture) {
      case 'sleeve':
        b.LeftUpperArm.rotation.x -= weight * 0.2
        b.LeftForearm.rotation.x -= weight * 0.58
        b.RightUpperArm.rotation.x -= weight * 0.16
        b.RightUpperArm.rotation.y += weight * 0.18
        b.RightForearm.rotation.x -= weight * 0.48
        b.RightHand.rotation.z -= weight * 0.12
        break
      case 'salute':
        b.LeftUpperArm.rotation.x -= weight * 0.28
        b.RightUpperArm.rotation.x -= weight * 0.28
        b.LeftUpperArm.rotation.z += weight * 0.1
        b.RightUpperArm.rotation.z -= weight * 0.1
        b.LeftForearm.rotation.x -= weight * 0.72
        b.RightForearm.rotation.x -= weight * 0.72
        b.Head.rotation.x += weight * 0.045
        break
      case 'nod':
        b.Head.rotation.x += weight * 0.13
        b.Spine.rotation.x += weight * 0.018
        break
      case 'guide':
        b.RightUpperArm.rotation.x -= weight * 0.46
        b.RightUpperArm.rotation.z -= weight * 0.24
        b.RightForearm.rotation.x -= weight * 0.16
        b.RightHand.rotation.y += weight * 0.16
        b.Head.rotation.y -= weight * 0.1
        break
      case 'none':
        break
    }
  }

  private bakeMeshes(source: THREE.Object3D, parent: THREE.Object3D | null): BakedMesh[] {
    // Npc.create sets the root position immediately before this constructor. Refresh ancestors
    // before reading mesh.matrixWorld, or inverseParent would bake a spurious -root translation.
    source.updateWorldMatrix(true, true)
    const inverseParent = parent ? new THREE.Matrix4().copy(parent.matrixWorld).invert() : new THREE.Matrix4()
    const baked: BakedMesh[] = []
    const visit = (object: THREE.Object3D): void => {
      if (PROTECTED_PARTS.has(object.name)) return
      const mesh = object as THREE.Mesh
      if (mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && mesh.geometry.getAttribute('position')) {
        const shared = mesh.userData.sharedModel === true || source.userData.sharedModel === true
        const geometry = mesh.geometry.clone()
        // Meshopt attributes can be normalized integers; dequantize before applying metre transforms.
        for (const name of ['position', 'normal', 'tangent']) {
          const attribute = geometry.getAttribute(name)
          if (!attribute) continue
          const values = new Float32Array(attribute.count * attribute.itemSize)
          for (let vertex = 0; vertex < attribute.count; vertex += 1) {
            const offset = vertex * attribute.itemSize
            values[offset] = attribute.getX(vertex)
            values[offset + 1] = attribute.getY(vertex)
            values[offset + 2] = attribute.getZ(vertex)
            if (attribute.itemSize === 4) values[offset + 3] = attribute.getW(vertex)
          }
          geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize))
        }
        geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseParent, mesh.matrixWorld))
        geometry.computeBoundingBox()
        this.derivedGeometries.add(geometry)
        baked.push({ source: mesh, geometry, shared })
        if (!shared) this.rememberOwnedSource(mesh)
      }
      for (const child of object.children) visit(child)
    }
    visit(source)
    return baked
  }

  private rememberOwnedSource(mesh: THREE.Mesh): void {
    this.ownedGeometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      this.ownedMaterials.add(material)
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.ownedTextures.add(value)
      const uniforms = (material as THREE.ShaderMaterial).uniforms
      if (uniforms) for (const uniform of Object.values(uniforms)) if (uniform.value instanceof THREE.Texture) this.ownedTextures.add(uniform.value)
    }
  }
}

function createBones(bounds: THREE.Box3): BoneMap {
  const min = bounds.min
  const max = bounds.max
  const height = safeHeight(bounds)
  const centreX = (min.x + max.x) * 0.5
  const centreZ = (min.z + max.z) * 0.5
  const halfWidth = Math.max((max.x - min.x) * 0.5, height * 0.13)
  const bones = Object.fromEntries(BONE_NAMES.map(name => {
    const bone = new THREE.Bone()
    bone.name = name
    return [name, bone]
  })) as BoneMap
  const y = (fraction: number) => min.y + height * fraction

  bones.Pelvis.position.set(centreX, y(0.48), centreZ)
  bones.Spine.position.set(0, height * 0.16, 0)
  bones.Head.position.set(0, height * 0.19, 0)
  bones.Jaw.position.set(0, -height * 0.035, -height * 0.025)
  bones.Pelvis.add(bones.Spine)
  bones.Spine.add(bones.Head)
  bones.Head.add(bones.Jaw)

  const legX = Math.min(halfWidth * 0.48, height * 0.14)
  for (const [side, sign] of [['Left', -1], ['Right', 1]] as const) {
    const thigh = bones[`${side}Thigh` as BoneName]
    const shin = bones[`${side}Shin` as BoneName]
    const foot = bones[`${side}Foot` as BoneName]
    thigh.position.set(sign * legX, -height * 0.025, 0)
    shin.position.set(0, -height * 0.205, 0)
    foot.position.set(0, -height * 0.2, -height * 0.025)
    bones.Pelvis.add(thigh)
    thigh.add(shin)
    shin.add(foot)
  }

  const shoulderX = THREE.MathUtils.clamp(halfWidth * 0.78, height * 0.15, height * 0.27)
  for (const [side, sign] of [['Left', -1], ['Right', 1]] as const) {
    const upper = bones[`${side}UpperArm` as BoneName]
    const forearm = bones[`${side}Forearm` as BoneName]
    const hand = bones[`${side}Hand` as BoneName]
    upper.position.set(sign * shoulderX, height * 0.12, 0)
    forearm.position.set(0, -height * 0.18, 0)
    hand.position.set(0, -height * 0.17, 0)
    bones.Spine.add(upper)
    upper.add(forearm)
    forearm.add(hand)
  }
  bones.Pelvis.userData.restX = bones.Pelvis.position.x
  bones.Pelvis.userData.restY = bones.Pelvis.position.y
  return bones
}

function addSkinAttributes(geometry: THREE.BufferGeometry, bounds: THREE.Box3, bones: BoneMap, root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const starts = new Map<BoneName, THREE.Vector3>()
  for (const name of BONE_NAMES) starts.set(name, bones[name].getWorldPosition(new THREE.Vector3()))
  const at = (name: BoneName): THREE.Vector3 => starts.get(name)!
  const height = safeHeight(bounds)
  const centreX = (bounds.min.x + bounds.max.x) * 0.5
  const centreZ = (bounds.min.z + bounds.max.z) * 0.5
  const halfWidth = Math.max((bounds.max.x - bounds.min.x) * 0.5, height * 0.13)
  const halfDepth = Math.max((bounds.max.z - bounds.min.z) * 0.5, height * 0.08)
  const end = (name: BoneName, y: number, z = 0): THREE.Vector3 => at(name).clone().add(new THREE.Vector3(0, height * y, height * z))
  const segments: Record<BoneName, Segment> = {
    Pelvis: { a: at('Pelvis'), b: at('Spine'), radius: height * 0.22 },
    Spine: { a: at('Spine'), b: at('Head'), radius: height * 0.24 },
    Head: { a: at('Head'), b: end('Head', 0.13), radius: height * 0.18 },
    Jaw: { a: at('Jaw'), b: end('Jaw', 0.035, -0.025), radius: height * 0.1 },
    LeftUpperArm: { a: at('LeftUpperArm'), b: at('LeftForearm'), radius: height * 0.13 },
    LeftForearm: { a: at('LeftForearm'), b: at('LeftHand'), radius: height * 0.115 },
    LeftHand: { a: at('LeftHand'), b: end('LeftHand', -0.08), radius: height * 0.1 },
    RightUpperArm: { a: at('RightUpperArm'), b: at('RightForearm'), radius: height * 0.13 },
    RightForearm: { a: at('RightForearm'), b: at('RightHand'), radius: height * 0.115 },
    RightHand: { a: at('RightHand'), b: end('RightHand', -0.08), radius: height * 0.1 },
    LeftThigh: { a: at('LeftThigh'), b: at('LeftShin'), radius: height * 0.17 },
    LeftShin: { a: at('LeftShin'), b: at('LeftFoot'), radius: height * 0.14 },
    LeftFoot: { a: at('LeftFoot'), b: end('LeftFoot', -0.035, -0.11), radius: height * 0.12 },
    RightThigh: { a: at('RightThigh'), b: at('RightShin'), radius: height * 0.17 },
    RightShin: { a: at('RightShin'), b: at('RightFoot'), radius: height * 0.14 },
    RightFoot: { a: at('RightFoot'), b: end('RightFoot', -0.035, -0.11), radius: height * 0.12 },
  }
  const positions = geometry.getAttribute('position')
  const indices = new Uint16Array(positions.count * 4)
  const weights = new Float32Array(positions.count * 4)
  const scores = new Float64Array(BONE_NAMES.length)
  const bestIndices = new Int32Array(4)
  const bestScores = new Float64Array(4)
  const point = new THREE.Vector3()

  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    point.fromBufferAttribute(positions, vertex)
    for (let bone = 0; bone < BONE_NAMES.length; bone += 1) {
      const segment = segments[BONE_NAMES[bone]!]
      scores[bone] = 1 / (0.04 + distanceSqToSegment(point, segment.a, segment.b) / (segment.radius * segment.radius))
    }
    const relativeY = THREE.MathUtils.clamp((point.y - bounds.min.y) / height, 0, 1)
    const side = THREE.MathUtils.clamp(0.5 + (point.x - centreX) / (halfWidth * 2.4), 0, 1)
    const robe = 1 - THREE.MathUtils.smoothstep(relativeY, 0.38, 0.67)
    const calf = 1 - THREE.MathUtils.smoothstep(relativeY, 0.16, 0.42)
    addScore(scores, 'LeftThigh', robe * (1 - calf) * (1 - side) * 2.2)
    addScore(scores, 'RightThigh', robe * (1 - calf) * side * 2.2)
    addScore(scores, 'LeftShin', robe * calf * (1 - side) * 2)
    addScore(scores, 'RightShin', robe * calf * side * 2)
    const foot = 1 - THREE.MathUtils.smoothstep(relativeY, 0.035, 0.14)
    addScore(scores, 'LeftFoot', foot * (1 - side) * 1.6)
    addScore(scores, 'RightFoot', foot * side * 1.6)

    const outer = THREE.MathUtils.smoothstep(Math.abs(point.x - centreX) / halfWidth, 0.48, 0.92)
    const armBand = THREE.MathUtils.smoothstep(relativeY, 0.32, 0.55) * (1 - THREE.MathUtils.smoothstep(relativeY, 0.78, 0.91))
    const forearm = 1 - THREE.MathUtils.smoothstep(relativeY, 0.42, 0.67)
    const armSide = point.x < centreX ? 'Left' : 'Right'
    addScore(scores, `${armSide}UpperArm` as BoneName, outer * armBand * (1 - forearm) * 1.7)
    addScore(scores, `${armSide}Forearm` as BoneName, outer * armBand * forearm * 1.7)
    addScore(scores, `${armSide}Hand` as BoneName, outer * armBand * forearm * 0.65)

    const head = THREE.MathUtils.smoothstep(relativeY, 0.76, 0.87)
    addScore(scores, 'Head', head * 4)
    const jawBand = THREE.MathUtils.smoothstep(relativeY, 0.735, 0.79) * (1 - THREE.MathUtils.smoothstep(relativeY, 0.835, 0.88))
    const front = 1 - THREE.MathUtils.smoothstep((point.z - centreZ) / halfDepth, -0.25, 0.25)
    addScore(scores, 'Jaw', head * jawBand * front * 4.5)

    bestIndices.fill(0)
    bestScores.fill(0)
    for (let bone = 0; bone < scores.length; bone += 1) {
      const score = scores[bone]!
      for (let slot = 0; slot < 4; slot += 1) {
        if (score <= bestScores[slot]!) continue
        for (let move = 3; move > slot; move -= 1) {
          bestScores[move] = bestScores[move - 1]!
          bestIndices[move] = bestIndices[move - 1]!
        }
        bestScores[slot] = score
        bestIndices[slot] = bone
        break
      }
    }
    const total = bestScores[0]! + bestScores[1]! + bestScores[2]! + bestScores[3]! || 1
    for (let slot = 0; slot < 4; slot += 1) {
      indices[vertex * 4 + slot] = bestIndices[slot]!
      weights[vertex * 4 + slot] = bestScores[slot]! / total
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
}

function addScore(scores: Float64Array, name: BoneName, amount: number): void {
  scores[BONE_NAMES.indexOf(name)] += amount
}

function distanceSqToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  const lengthSq = dx * dx + dy * dy + dz * dz
  if (lengthSq < 1e-8) return point.distanceToSquared(a)
  const t = THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengthSq, 0, 1)
  const x = point.x - (a.x + dx * t)
  const y = point.y - (a.y + dy * t)
  const z = point.z - (a.z + dz * t)
  return x * x + y * y + z * z
}

function boundsFor(geometries: THREE.BufferGeometry[]): THREE.Box3 {
  const bounds = new THREE.Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    if (geometry.boundingBox) bounds.union(geometry.boundingBox)
  }
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-0.22, 0, -0.16), new THREE.Vector3(0.22, 1.7, 0.16))
  return bounds
}

function safeHeight(bounds: THREE.Box3): number {
  return Math.max(bounds.max.y - bounds.min.y, 0.5)
}

export function wrappedAngle(angle: number): number {
  let result = angle % TAU
  if (result > Math.PI) result -= TAU
  if (result < -Math.PI) result += TAU
  return result
}
