import * as THREE from 'three'

/** Motion values supplied by the character controller each rendered frame. */
export type CharacterMotion = { speed: number; grounded: boolean; verticalSpeed: number }

type CharacterState = 'idle' | 'walk' | 'fast-walk' | 'jump' | 'fall'
type EulerTuple = readonly [number, number, number]

const BONE_NAMES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftThigh', 'LeftShin', 'LeftFoot',
  'RightThigh', 'RightShin', 'RightFoot',
  'LeftUpperArm', 'LeftForearm', 'LeftHand',
  'RightUpperArm', 'RightForearm', 'RightHand',
] as const

type BoneName = (typeof BONE_NAMES)[number]
type BoneMap = Record<BoneName, THREE.Bone>
type BakedMesh = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }

const ZERO: EulerTuple = [0, 0, 0]

/**
 * Retargets the project character meshes to a small, intentionally conservative humanoid rig.
 * It is an automatic spatial weighting pass, not authored skin weights or motion capture: long
 * robes deliberately blend through both legs to make the limited stride read softly.
 */
export class CharacterAnimation {
  readonly root = new THREE.Group()
  readonly mixer: THREE.AnimationMixer

  private readonly skeleton: THREE.Skeleton
  private readonly actions: Record<CharacterState, THREE.AnimationAction>
  private readonly skinnedMeshes: THREE.SkinnedMesh[] = []
  private readonly derivedGeometries = new Set<THREE.BufferGeometry>()
  private readonly sourceGeometries = new Set<THREE.BufferGeometry>()
  private readonly sourceMaterials = new Set<THREE.Material>()
  private readonly sourceTextures = new Set<THREE.Texture>()
  private current: THREE.AnimationAction
  private state: CharacterState = 'idle'
  private disposed = false

  constructor(source: THREE.Object3D) {
    this.root.name = 'CharacterAnimationRoot'
    this.root.userData.disposeCharacter = () => this.dispose()

    const baked = this.bakeMeshes(source)
    const bounds = boundsFor(baked.map(entry => entry.geometry))
    const bones = createBones(bounds)
    this.skeleton = new THREE.Skeleton(BONE_NAMES.map(name => bones[name]))

    // Bones and every SkinnedMesh share the same neutral, baked coordinate system.
    this.root.add(bones.Hips)
    for (const entry of baked) {
      addSkinAttributes(entry.geometry, bounds, bones, this.root)
      const mesh = new THREE.SkinnedMesh(entry.geometry, entry.material)
      mesh.name = 'RetargetedSkinnedMesh'
      mesh.castShadow = true
      mesh.receiveShadow = true
      // The material may be borrowed from a cached GLB; disposeScene must not release it.
      mesh.userData.sharedModel = true
      this.skinnedMeshes.push(mesh)
      this.root.add(mesh)
    }
    this.root.updateMatrixWorld(true)
    this.skeleton.calculateInverses()
    for (const mesh of this.skinnedMeshes) mesh.bind(this.skeleton, new THREE.Matrix4())

    this.mixer = new THREE.AnimationMixer(this.root)
    const clips = createClips()
    this.actions = {
      idle: this.mixer.clipAction(clips.idle),
      walk: this.mixer.clipAction(clips.walk),
      'fast-walk': this.mixer.clipAction(clips['fast-walk']),
      jump: this.mixer.clipAction(clips.jump),
      fall: this.mixer.clipAction(clips.fall),
    }
    this.actions.jump.setLoop(THREE.LoopOnce, 1)
    this.actions.jump.clampWhenFinished = true
    this.actions.idle.play()
    this.current = this.actions.idle
  }

  /** Advance the AnimationMixer and select an action from real movement/airborne state. */
  update(dt: number, motion: CharacterMotion): void {
    if (this.disposed) return
    const next = motion.grounded
      ? motion.speed < 0.12 ? 'idle' : motion.speed < 6.1 ? 'walk' : 'fast-walk'
      : motion.verticalSpeed > 0.15 ? 'jump' : 'fall'
    this.transition(next)

    // A one-second gait is scaled to the actual controller speed, so slow input does not moonwalk.
    if (next === 'walk') this.current.setEffectiveTimeScale(THREE.MathUtils.clamp(motion.speed / 4.6, 0.35, 1.2))
    else if (next === 'fast-walk') this.current.setEffectiveTimeScale(THREE.MathUtils.clamp(motion.speed / 7.5, 0.72, 1.45))
    else this.current.setEffectiveTimeScale(1)

    this.mixer.update(THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1))
    this.root.updateMatrixWorld(true)
  }

  /** A compact runtime assertion surface for tests and scene diagnostics. */
  inspect(): { kind: string; state: string; bones: number; skinnedMeshes: number } {
    return { kind: 'skinned-humanoid', state: this.state, bones: this.skeleton.bones.length, skinnedMeshes: this.skinnedMeshes.length }
  }

  /** Releases only resources created or owned by this retargeter; cached GLB resources remain intact. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
    this.skeleton.boneTexture?.dispose()
    this.skeleton.boneTexture = null
    this.derivedGeometries.forEach(geometry => geometry.dispose())
    // Procedural villagers are passed in as one-off source objects, so their original resources
    // are ours to release after the borrowed material is no longer rendered.
    this.sourceTextures.forEach(texture => texture.dispose())
    this.sourceMaterials.forEach(material => material.dispose())
    this.sourceGeometries.forEach(geometry => geometry.dispose())
    this.root.clear()
  }

  private transition(next: CharacterState): void {
    if (next === this.state) return
    const previous = this.current
    const target = this.actions[next]
    target.enabled = true
    target.reset()
    target.setEffectiveWeight(1)
    target.play()
    previous.crossFadeTo(target, next === 'fall' ? 0.08 : 0.14, false)
    this.current = target
    this.state = next
  }

  /** Clone geometry and bake every source-node transform before it becomes a SkinnedMesh. */
  private bakeMeshes(source: THREE.Object3D): BakedMesh[] {
    source.updateMatrixWorld(true)
    const baked: BakedMesh[] = []
    source.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry.getAttribute('position')) return
      const shared = object.userData.sharedModel === true || source.userData.sharedModel === true
      const geometry = mesh.geometry.clone()
      // Meshopt GLBs may keep normalized integer attributes. Baking metre-scale transforms
      // into those arrays wraps values outside [-1,1]/[0,1], so dequantize first.
      for (const name of ['position', 'normal', 'tangent']) {
        const attribute = geometry.getAttribute(name)
        if (!attribute) continue
        const values = new Float32Array(attribute.count * attribute.itemSize)
        for (let vertex = 0; vertex < attribute.count; vertex++) {
          const offset = vertex * attribute.itemSize
          values[offset] = attribute.getX(vertex)
          values[offset + 1] = attribute.getY(vertex)
          values[offset + 2] = attribute.getZ(vertex)
          if (attribute.itemSize === 4) values[offset + 3] = attribute.getW(vertex)
        }
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize))
      }
      geometry.applyMatrix4(mesh.matrixWorld)
      geometry.computeBoundingBox()
      this.derivedGeometries.add(geometry)
      baked.push({ geometry, material: mesh.material })
      if (!shared) this.rememberOwnedSource(mesh)
    })
    return baked
  }

  private rememberOwnedSource(mesh: THREE.Mesh): void {
    this.sourceGeometries.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      this.sourceMaterials.add(material)
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.sourceTextures.add(value)
      const uniforms = (material as THREE.ShaderMaterial).uniforms
      if (uniforms) for (const uniform of Object.values(uniforms)) if (uniform.value instanceof THREE.Texture) this.sourceTextures.add(uniform.value)
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
  const bone = (name: BoneName): THREE.Bone => {
    const result = new THREE.Bone()
    result.name = name
    return result
  }
  const bones = Object.fromEntries(BONE_NAMES.map(name => [name, bone(name)])) as BoneMap
  const y = (fraction: number) => min.y + height * fraction

  bones.Hips.position.set(centreX, y(0.47), centreZ)
  bones.Spine.position.set(0, height * 0.14, 0)
  bones.Chest.position.set(0, height * 0.15, 0)
  bones.Neck.position.set(0, height * 0.11, 0)
  bones.Head.position.set(0, height * 0.075, 0)
  bones.Hips.add(bones.Spine)
  bones.Spine.add(bones.Chest)
  bones.Chest.add(bones.Neck)
  bones.Neck.add(bones.Head)

  const legX = Math.min(halfWidth * 0.52, height * 0.15)
  for (const [side, sign] of [['Left', -1], ['Right', 1]] as const) {
    const thigh = bones[`${side}Thigh` as BoneName]
    const shin = bones[`${side}Shin` as BoneName]
    const foot = bones[`${side}Foot` as BoneName]
    thigh.position.set(sign * legX, -height * 0.045, 0)
    shin.position.set(0, -height * 0.20, 0)
    foot.position.set(0, -height * 0.185, -height * 0.025)
    bones.Hips.add(thigh)
    thigh.add(shin)
    shin.add(foot)
  }

  const shoulderX = Math.min(Math.max(halfWidth * 0.82, height * 0.15), height * 0.29)
  for (const [side, sign] of [['Left', -1], ['Right', 1]] as const) {
    const upper = bones[`${side}UpperArm` as BoneName]
    const forearm = bones[`${side}Forearm` as BoneName]
    const hand = bones[`${side}Hand` as BoneName]
    upper.position.set(sign * shoulderX, height * 0.005, 0)
    forearm.position.set(0, -height * 0.19, 0)
    hand.position.set(0, -height * 0.17, 0)
    bones.Chest.add(upper)
    upper.add(forearm)
    forearm.add(hand)
  }
  return bones
}

/** Assign four normalized influences using distance to body segments plus a softly split robe. */
function addSkinAttributes(geometry: THREE.BufferGeometry, bounds: THREE.Box3, bones: BoneMap, root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const starts = new Map<BoneName, THREE.Vector3>()
  for (const name of BONE_NAMES) starts.set(name, bones[name].getWorldPosition(new THREE.Vector3()))
  const height = safeHeight(bounds)
  const centreX = (bounds.min.x + bounds.max.x) * 0.5
  const halfWidth = Math.max((bounds.max.x - bounds.min.x) * 0.5, height * 0.13)
  const end = (name: BoneName, fallback: THREE.Vector3): THREE.Vector3 => starts.get(name)?.clone() ?? fallback
  const segments: Record<BoneName, { a: THREE.Vector3; b: THREE.Vector3; radius: number }> = {
    Hips: { a: end('Hips', new THREE.Vector3()), b: end('Spine', new THREE.Vector3()), radius: height * 0.20 },
    Spine: { a: end('Spine', new THREE.Vector3()), b: end('Chest', new THREE.Vector3()), radius: height * 0.22 },
    Chest: { a: end('Chest', new THREE.Vector3()), b: end('Neck', new THREE.Vector3()), radius: height * 0.25 },
    Neck: { a: end('Neck', new THREE.Vector3()), b: end('Head', new THREE.Vector3()), radius: height * 0.13 },
    Head: { a: end('Head', new THREE.Vector3()), b: end('Head', new THREE.Vector3()).add(new THREE.Vector3(0, height * 0.12, 0)), radius: height * 0.20 },
    LeftThigh: { a: end('LeftThigh', new THREE.Vector3()), b: end('LeftShin', new THREE.Vector3()), radius: height * 0.17 },
    LeftShin: { a: end('LeftShin', new THREE.Vector3()), b: end('LeftFoot', new THREE.Vector3()), radius: height * 0.14 },
    LeftFoot: { a: end('LeftFoot', new THREE.Vector3()), b: end('LeftFoot', new THREE.Vector3()).add(new THREE.Vector3(0, -height * 0.04, -height * 0.12)), radius: height * 0.13 },
    RightThigh: { a: end('RightThigh', new THREE.Vector3()), b: end('RightShin', new THREE.Vector3()), radius: height * 0.17 },
    RightShin: { a: end('RightShin', new THREE.Vector3()), b: end('RightFoot', new THREE.Vector3()), radius: height * 0.14 },
    RightFoot: { a: end('RightFoot', new THREE.Vector3()), b: end('RightFoot', new THREE.Vector3()).add(new THREE.Vector3(0, -height * 0.04, -height * 0.12)), radius: height * 0.13 },
    LeftUpperArm: { a: end('LeftUpperArm', new THREE.Vector3()), b: end('LeftForearm', new THREE.Vector3()), radius: height * 0.13 },
    LeftForearm: { a: end('LeftForearm', new THREE.Vector3()), b: end('LeftHand', new THREE.Vector3()), radius: height * 0.115 },
    LeftHand: { a: end('LeftHand', new THREE.Vector3()), b: end('LeftHand', new THREE.Vector3()).add(new THREE.Vector3(0, -height * 0.09, 0)), radius: height * 0.11 },
    RightUpperArm: { a: end('RightUpperArm', new THREE.Vector3()), b: end('RightForearm', new THREE.Vector3()), radius: height * 0.13 },
    RightForearm: { a: end('RightForearm', new THREE.Vector3()), b: end('RightHand', new THREE.Vector3()), radius: height * 0.115 },
    RightHand: { a: end('RightHand', new THREE.Vector3()), b: end('RightHand', new THREE.Vector3()).add(new THREE.Vector3(0, -height * 0.09, 0)), radius: height * 0.11 },
  }
  const positions = geometry.getAttribute('position')
  const indices = new Uint16Array(positions.count * 4)
  const weights = new Float32Array(positions.count * 4)
  const point = new THREE.Vector3()

  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    point.fromBufferAttribute(positions, vertex)
    const scores = BONE_NAMES.map(name => {
      const segment = segments[name]
      return 1 / (0.035 + distanceSqToSegment(point, segment.a, segment.b) / (segment.radius * segment.radius))
    })
    const relativeY = THREE.MathUtils.clamp((point.y - bounds.min.y) / height, 0, 1)
    const side = THREE.MathUtils.clamp(0.5 + (point.x - centreX) / (halfWidth * 2.4), 0, 1)
    const robe = 1 - THREE.MathUtils.smoothstep(relativeY, 0.38, 0.67)
    const calf = 1 - THREE.MathUtils.smoothstep(relativeY, 0.16, 0.42)
    const thigh = 1 - calf
    // This explicit bilateral blend keeps a single connected robe from creasing at centre line.
    addScore(scores, 'LeftThigh', robe * thigh * (1 - side) * 2.2)
    addScore(scores, 'RightThigh', robe * thigh * side * 2.2)
    addScore(scores, 'LeftShin', robe * calf * (1 - side) * 2.0)
    addScore(scores, 'RightShin', robe * calf * side * 2.0)
    const foot = 1 - THREE.MathUtils.smoothstep(relativeY, 0.04, 0.16)
    addScore(scores, 'LeftFoot', foot * (1 - side) * 1.5)
    addScore(scores, 'RightFoot', foot * side * 1.5)

    const outer = THREE.MathUtils.smoothstep(Math.abs(point.x - centreX) / halfWidth, 0.48, 0.92)
    const armBand = THREE.MathUtils.smoothstep(relativeY, 0.34, 0.57) * (1 - THREE.MathUtils.smoothstep(relativeY, 0.78, 0.92))
    const forearm = 1 - THREE.MathUtils.smoothstep(relativeY, 0.42, 0.67)
    if (point.x < centreX) {
      addScore(scores, 'LeftUpperArm', outer * armBand * (1 - forearm) * 1.6)
      addScore(scores, 'LeftForearm', outer * armBand * forearm * 1.6)
      addScore(scores, 'LeftHand', outer * armBand * forearm * 0.65)
    } else {
      addScore(scores, 'RightUpperArm', outer * armBand * (1 - forearm) * 1.6)
      addScore(scores, 'RightForearm', outer * armBand * forearm * 1.6)
      addScore(scores, 'RightHand', outer * armBand * forearm * 0.65)
    }

    const strongest = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score).slice(0, 4)
    const total = strongest.reduce((sum, influence) => sum + influence.score, 0) || 1
    for (let influence = 0; influence < 4; influence += 1) {
      const item = strongest[influence]
      indices[vertex * 4 + influence] = item?.index ?? 0
      weights[vertex * 4 + influence] = item ? item.score / total : 0
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
}

function addScore(scores: number[], name: BoneName, amount: number): void {
  scores[BONE_NAMES.indexOf(name)] += amount
}

function distanceSqToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const direction = new THREE.Vector3().subVectors(b, a)
  const lengthSq = direction.lengthSq()
  if (lengthSq < 1e-8) return point.distanceToSquared(a)
  const t = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(point, a).dot(direction) / lengthSq, 0, 1)
  return point.distanceToSquared(direction.multiplyScalar(t).add(a))
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

function createClips(): Record<CharacterState, THREE.AnimationClip> {
  return {
    idle: makeClip('idle', [0, 1.25, 2.5], (bone, time) => idlePose(bone, time)),
    walk: makeClip('walk', [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], (bone, time) => gaitPose(bone, time, 0.34)),
    'fast-walk': makeClip('fast-walk', [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], (bone, time) => gaitPose(bone, time / 0.8, 0.48)),
    jump: makeClip('jump', [0, 0.18, 0.48], (bone, time) => jumpPose(bone, time)),
    fall: makeClip('fall', [0, 0.24, 0.5], (bone, time) => fallPose(bone, time)),
  }
}

function makeClip(name: string, times: number[], poseAt: (bone: BoneName, time: number) => EulerTuple): THREE.AnimationClip {
  const tracks = BONE_NAMES.map(bone => {
    const values: number[] = []
    for (const time of times) {
      const [x, y, z] = poseAt(bone, time)
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'))
      values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
    }
    return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values)
  })
  return new THREE.AnimationClip(name, times.at(-1) ?? 0, tracks)
}

function idlePose(bone: BoneName, time: number): EulerTuple {
  const breath = Math.sin((time / 2.5) * Math.PI * 2)
  if (bone === 'Chest') return [0.016 * breath, 0, 0]
  if (bone === 'Spine') return [-0.009 * breath, 0, 0]
  if (bone === 'Neck') return [-0.006 * breath, 0, 0]
  if (bone === 'LeftUpperArm') return [0.018 * breath, 0, -0.012]
  if (bone === 'RightUpperArm') return [-0.018 * breath, 0, 0.012]
  return ZERO
}

function gaitPose(bone: BoneName, phaseTime: number, amplitude: number): EulerTuple {
  const phase = Math.sin(phaseTime * Math.PI * 2)
  const bendLeft = Math.max(0, -phase)
  const bendRight = Math.max(0, phase)
  switch (bone) {
    case 'Hips': return [0.025, phase * 0.035, phase * 0.022]
    case 'Spine': return [-0.02, -phase * 0.025, -phase * 0.016]
    case 'Chest': return [0.012, -phase * 0.04, -phase * 0.012]
    case 'Neck': return [0, phase * 0.012, 0]
    case 'Head': return [-0.01, -phase * 0.01, 0]
    case 'LeftThigh': return [phase * amplitude, 0, 0]
    case 'RightThigh': return [-phase * amplitude, 0, 0]
    case 'LeftShin': return [-bendLeft * amplitude * 0.68, 0, 0]
    case 'RightShin': return [-bendRight * amplitude * 0.68, 0, 0]
    case 'LeftFoot': return [-phase * amplitude * 0.24 - bendLeft * 0.07, 0, 0]
    case 'RightFoot': return [phase * amplitude * 0.24 - bendRight * 0.07, 0, 0]
    case 'LeftUpperArm': return [-phase * amplitude * 0.82, 0, -0.035]
    case 'RightUpperArm': return [phase * amplitude * 0.82, 0, 0.035]
    case 'LeftForearm': return [bendRight * amplitude * 0.42, 0, 0]
    case 'RightForearm': return [bendLeft * amplitude * 0.42, 0, 0]
    case 'LeftHand': return [phase * amplitude * 0.13, 0, 0]
    case 'RightHand': return [-phase * amplitude * 0.13, 0, 0]
    default: return ZERO
  }
}

function jumpPose(bone: BoneName, time: number): EulerTuple {
  const tuck = THREE.MathUtils.smoothstep(time, 0, 0.18)
  switch (bone) {
    case 'Hips': return [-0.08 * tuck, 0, 0]
    case 'Spine': return [0.055 * tuck, 0, 0]
    case 'Chest': return [0.035 * tuck, 0, 0]
    case 'LeftThigh':
    case 'RightThigh': return [0.25 * tuck, 0, 0]
    case 'LeftShin':
    case 'RightShin': return [-0.36 * tuck, 0, 0]
    case 'LeftFoot':
    case 'RightFoot': return [0.12 * tuck, 0, 0]
    case 'LeftUpperArm': return [-0.3 * tuck, 0, -0.04]
    case 'RightUpperArm': return [-0.3 * tuck, 0, 0.04]
    case 'LeftForearm':
    case 'RightForearm': return [-0.08 * tuck, 0, 0]
    default: return ZERO
  }
}

function fallPose(bone: BoneName, time: number): EulerTuple {
  const brace = 0.7 + 0.3 * Math.sin((time / 0.5) * Math.PI)
  switch (bone) {
    case 'Hips': return [0.045 * brace, 0, 0]
    case 'Spine': return [-0.035 * brace, 0, 0]
    case 'LeftThigh':
    case 'RightThigh': return [0.18 * brace, 0, 0]
    case 'LeftShin':
    case 'RightShin': return [-0.28 * brace, 0, 0]
    case 'LeftFoot':
    case 'RightFoot': return [0.11 * brace, 0, 0]
    case 'LeftUpperArm': return [-0.18 * brace, 0, -0.05]
    case 'RightUpperArm': return [-0.18 * brace, 0, 0.05]
    case 'LeftForearm':
    case 'RightForearm': return [-0.08 * brace, 0, 0]
    default: return ZERO
  }
}
