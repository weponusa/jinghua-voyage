import * as THREE from 'three'
import { hasModel, instance, type ModelKey } from '../game/models'
import { CHAPTER_ORDER, type ChapterId } from '../game/progress'

/** Transparent PNG portraits keyed by the sea-chart chapter IDs. */
export type IslandPortraits = Partial<Record<ChapterId, string>>

type PortraitModelKey = Extract<ModelKey, 'paifang' | 'market_stall' | 'peach_tree' | 'pavilion' | 'house' | 'tree_pineRoundA' | 'rock_smallA'>
type PortraitModels = Partial<Record<PortraitModelKey, THREE.Object3D>>
type OwnedResources = { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> }
type IslandColors = { grass: string; sand: string; cliff: string; path: string; accent: string }
type ModelPlacement = { x: number; y: number; z: number; yaw?: number; height?: number; span?: number }

const PORTRAIT_SIZE = 384
const MODEL_KEYS: readonly PortraitModelKey[] = ['paifang', 'market_stall', 'peach_tree', 'pavilion', 'house', 'tree_pineRoundA', 'rock_smallA']

// These deliberately uneven outlines give each kingdom a recognisable coastline rather than a
// reused circular pedestal. They contain no random input, so captures are stable across visits.
const OUTLINES: Record<ChapterId, readonly number[]> = {
  junzi: [1.02, 1.1, 1.02, 0.96, 1.12, 1.03, 0.94, 1.08, 1.17, 1.04, 0.91, 0.98],
  daren: [0.95, 1.18, 0.94, 1.2, 0.9, 1.08, 0.97, 1.22, 0.88, 1.1, 1.0, 1.15, 0.92, 1.12],
  liangmian: [0.82, 1.06, 1.22, 0.91, 0.74, 1.02, 1.24, 0.88, 0.76, 1.08, 1.2, 0.9],
  wuchang: [1.1, 1.16, 1.02, 0.93, 0.98, 1.12, 1.2, 1.04, 0.9, 0.98, 1.13, 1.08],
  baimin: [1.22, 1.1, 0.92, 0.84, 0.95, 1.1, 1.23, 1.08, 0.91, 0.82, 0.94, 1.12],
  heichi: [0.9, 1.19, 0.83, 1.24, 0.85, 1.16, 0.91, 1.22, 0.82, 1.17, 0.88, 1.23],
  penglai: [1.1, 0.98, 1.17, 0.91, 1.08, 1.2, 0.94, 1.08, 1.2, 0.92, 1.13, 1.03],
}

const COLORS: Record<ChapterId, IslandColors> = {
  junzi: { grass: '#6f9f78', sand: '#c89150', cliff: '#3c7370', path: '#d9b878', accent: '#d27672' },
  daren: { grass: '#86ad82', sand: '#cfa25f', cliff: '#4f8583', path: '#dec58a', accent: '#8f72c4' },
  liangmian: { grass: '#84966d', sand: '#bd8755', cliff: '#546d70', path: '#d7be8e', accent: '#b84c3d' },
  wuchang: { grass: '#9aa85e', sand: '#c68e43', cliff: '#42766d', path: '#d8b56d', accent: '#c99935' },
  baimin: { grass: '#9bbd9d', sand: '#d0aa72', cliff: '#5d8c88', path: '#e5d6b4', accent: '#f6f0de' },
  heichi: { grass: '#3d625d', sand: '#9b724e', cliff: '#253f46', path: '#b89564', accent: '#d6a84b' },
  penglai: { grass: '#77a487', sand: '#ca9966', cliff: '#417d7a', path: '#d4c79e', accent: '#82bfc0' },
}

let portraitPromise: Promise<IslandPortraits> | undefined

/**
 * Render the seven miniature islands once. The off-DOM, transparent canvas is intentionally
 * independent from the game renderer: it has no animation loop and is disposed as soon as its
 * PNGs have been read. A failed capture remains non-fatal for the chart menu.
 */
export function createIslandPortraits(): Promise<IslandPortraits> {
  portraitPromise ??= renderPortraits()
  return portraitPromise
}

async function renderPortraits(): Promise<IslandPortraits> {
  if (typeof document === 'undefined') return {}

  let renderer: THREE.WebGLRenderer | undefined
  try {
    const canvas = document.createElement('canvas')
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(1)
    renderer.setSize(PORTRAIT_SIZE, PORTRAIT_SIZE, false)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Load every available reusable landmark in one batch. The model registry itself caches the
    // underlying GLTF request; this avoids serial downloads when seven scenes ask for one prop.
    const models = await loadPortraitModels()
    const portraits: IslandPortraits = {}
    for (const id of CHAPTER_ORDER) {
      const owned: OwnedResources = { geometries: new Set(), materials: new Set() }
      const scene = new THREE.Scene()
      try {
        buildPortrait(scene, id, models, owned)
        const camera = portraitCamera()
        renderer.render(scene, camera)
        portraits[id] = canvas.toDataURL('image/png')
      } finally {
        // Only our low-poly helpers are tracked here. GLTF clone geometry/material/texture is
        // shared with the game model cache and is deliberately neither changed nor disposed.
        scene.clear()
        disposeOwned(owned)
      }
    }
    return portraits
  } catch {
    return {}
  } finally {
    if (renderer) {
      renderer.renderLists.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }
}

async function loadPortraitModels(): Promise<PortraitModels> {
  const entries = await Promise.all(MODEL_KEYS.map(async key => {
    if (!hasModel(key)) return [key, null] as const
    try {
      return [key, await instance(key)] as const
    } catch {
      return [key, null] as const
    }
  }))
  const loaded: PortraitModels = {}
  for (const [key, model] of entries) if (model) loaded[key] = model
  return loaded
}

function portraitCamera(): THREE.OrthographicCamera {
  const extent = 7.7
  const camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.1, 80)
  camera.position.set(10.5, 11.5, 12.5)
  camera.lookAt(0, 0.4, 0)
  camera.updateProjectionMatrix()
  return camera
}

function buildPortrait(scene: THREE.Scene, id: ChapterId, models: PortraitModels, owned: OwnedResources): void {
  const colors = COLORS[id]
  addLightRig(scene)
  const island = makeIsland(id, colors, owned)
  scene.add(island)

  switch (id) {
    case 'junzi':
      buildJunzi(island, colors, models, owned)
      break
    case 'daren':
      buildDaren(island, colors, models, owned)
      break
    case 'liangmian':
      buildLiangmian(island, colors, models, owned)
      break
    case 'wuchang':
      buildWuchang(island, colors, models, owned)
      break
    case 'baimin':
      buildBaimin(island, colors, models, owned)
      break
    case 'heichi':
      buildHeichi(island, colors, models, owned)
      break
    case 'penglai':
      buildPenglai(island, colors, models, owned)
      break
  }
}

function addLightRig(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#fff7df', '#4e8881', 1.9))
  const sun = new THREE.DirectionalLight('#ffe4b2', 3.2)
  sun.position.set(-7, 12, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(512, 512)
  sun.shadow.camera.left = -9
  sun.shadow.camera.right = 9
  sun.shadow.camera.top = 9
  sun.shadow.camera.bottom = -9
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 30
  sun.shadow.bias = -0.0012
  sun.shadow.normalBias = 0.04
  scene.add(sun, sun.target)
}

function makeIsland(id: ChapterId, colors: IslandColors, owned: OwnedResources): THREE.Group {
  const group = new THREE.Group()
  const outline = pointsFor(id, 4.85, 3.7)
  const shore = makeIslandShell(outline, -0.13, -1.55, colors.sand, colors.cliff, owned)
  group.add(shore)

  // An inset green cap leaves a visible ochre shore, while the taller cap makes the cliff edge
  // read clearly at thumbnail scale.
  const grass = makeTop(pointsFor(id, 4.06, 3.03), 0.035, colors.grass, owned)
  group.add(grass)
  addCliffStrata(group, outline, colors.cliff, owned)
  addRoad(group, colors.path, owned, id)
  return group
}

function pointsFor(id: ChapterId, xRadius: number, zRadius: number): THREE.Vector2[] {
  const radii = OUTLINES[id]
  return radii.map((radius, index) => {
    const angle = (index / radii.length) * Math.PI * 2 + (id === 'liangmian' ? Math.PI / 12 : 0)
    return new THREE.Vector2(Math.cos(angle) * xRadius * radius, Math.sin(angle) * zRadius * radius)
  })
}

function makeIslandShell(points: THREE.Vector2[], topY: number, bottomY: number, topColor: string, cliffColor: string, owned: OwnedResources): THREE.Group {
  const group = new THREE.Group()
  group.add(makeTop(points, topY, topColor, owned))

  const positions: number[] = []
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    positions.push(a.x, topY, a.y, b.x, topY, b.y, b.x * 1.055, bottomY, b.y * 1.055)
    positions.push(a.x, topY, a.y, b.x * 1.055, bottomY, b.y * 1.055, a.x * 1.055, bottomY, a.y * 1.055)
  }
  const sides = new THREE.BufferGeometry()
  sides.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  sides.computeVertexNormals()
  group.add(ownedMesh(sides, standardMaterial(cliffColor, owned, { flatShading: true, roughness: 0.92 }), owned))

  const underside = new THREE.ShapeGeometry(shapeFrom(points))
  underside.rotateX(-Math.PI / 2)
  const floor = ownedMesh(underside, standardMaterial('#315b5b', owned, { side: THREE.BackSide, roughness: 1 }), owned)
  floor.position.y = bottomY
  group.add(floor)
  return group
}

function makeTop(points: THREE.Vector2[], y: number, color: string, owned: OwnedResources): THREE.Mesh {
  const geometry = new THREE.ShapeGeometry(shapeFrom(points))
  geometry.rotateX(-Math.PI / 2)
  const mesh = ownedMesh(geometry, standardMaterial(color, owned, { flatShading: true, roughness: 0.86 }), owned)
  mesh.position.y = y
  return mesh
}

function shapeFrom(points: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i].x, points[i].y)
  shape.closePath()
  return shape
}

function addCliffStrata(group: THREE.Group, outline: THREE.Vector2[], cliffColor: string, owned: OwnedResources): void {
  for (const y of [-0.52, -0.96]) {
    const vertices: number[] = []
    for (const point of outline) vertices.push(point.x * 1.035, y, point.y * 1.035)
    vertices.push(vertices[0], vertices[1], vertices[2])
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    const line = new THREE.Line(geo, lineMaterial(new THREE.Color(cliffColor).offsetHSL(0, 0.03, 0.14).getStyle(), owned, 0.55))
    group.add(line)
  }
}

function addRoad(group: THREE.Group, color: string, owned: OwnedResources, id: ChapterId): void {
  const bend = id === 'liangmian' ? 0.2 : id === 'daren' ? -0.5 : 0
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.35, 0.13, 1.78),
    new THREE.Vector3(-1.25, 0.15, 0.58 + bend),
    new THREE.Vector3(0.5, 0.15, -0.28 - bend),
    new THREE.Vector3(2.9, 0.13, -1.55),
  ])
  const road = ownedMesh(new THREE.TubeGeometry(curve, 24, 0.13, 4, false), standardMaterial(color, owned, { roughness: 1 }), owned)
  road.castShadow = false
  group.add(road)
}

function buildJunzi(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  addModelOrFallback(group, models, 'paifang', { x: -0.7, y: 0.08, z: 0.75, yaw: -0.16, height: 2.85 }, () => gateFallback(owned, '#2d786f', '#d9bb74'))
  addModelOrFallback(group, models, 'market_stall', { x: 1.95, y: 0.08, z: -0.92, yaw: -0.42, height: 1.45 }, () => stallFallback(owned, '#3b887c'))
  addModelOrFallback(group, models, 'peach_tree', { x: -2.35, y: 0.08, z: -1.15, yaw: 0.45, height: 2.45 }, () => peachFallback(owned))
  addModelOrFallback(group, models, 'peach_tree', { x: 0.55, y: 0.08, z: 1.76, yaw: -0.4, height: 1.7 }, () => peachFallback(owned), 0.7)
  addRock(group, owned, -3.15, 0.12, 1.28, 0.38, colors.cliff)
}

function buildDaren(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  // A levitating rainbow cloud distinguishes the giant kingdom from the sea-bound islands.
  const cloudColors = ['#f5e9da', '#e2d7f1', '#c9e3dd', '#f2d6b3']
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2
    const puff = ownedMesh(new THREE.SphereGeometry(i % 2 ? 1.05 : 0.86, 12, 8), standardMaterial(cloudColors[i % cloudColors.length], owned, { roughness: 0.98, flatShading: true }), owned)
    puff.position.set(Math.cos(angle) * 2.65, -1.25 + (i % 2) * 0.12, Math.sin(angle) * 1.85)
    puff.scale.y = 0.48
    group.add(puff)
  }
  const tower = steppedTower(owned, colors.accent)
  tower.position.set(0.05, 0.09, -0.18)
  group.add(tower)
  addModelOrFallback(group, models, 'pavilion', { x: 1.95, y: 0.08, z: 1.18, yaw: -0.48, height: 1.7 }, () => pavilionFallback(owned, '#7560a2'))
  addRock(group, owned, -2.25, 0.1, 1.2, 0.42, '#597b80')
}

function buildLiangmian(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  addModelOrFallback(group, models, 'house', { x: -1.62, y: 0.08, z: 0.25, yaw: -Math.PI * 0.32, height: 2.0 }, () => houseFallback(owned, '#e3d5b4', '#a8493c'))
  addModelOrFallback(group, models, 'house', { x: 1.64, y: 0.08, z: -0.3, yaw: Math.PI * 0.68, height: 2.0 }, () => houseFallback(owned, '#cfbf9c', '#3b6470'))
  const masks = [
    { x: -1.62, z: 1.23, color: '#f0dfbc', flip: 1 },
    { x: 1.64, z: -1.26, color: '#864f47', flip: -1 },
  ]
  for (const mask of masks) addMask(group, owned, mask.x, 1.52, mask.z, mask.color, mask.flip)
  addTwinRidges(group, owned, colors.cliff)
}

function buildWuchang(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  // Shallow concentric terraces and grain sheaves make the no-intestine kingdom immediately legible.
  for (const [radius, y] of [[3.25, 0.08], [2.38, 0.13], [1.53, 0.18]] as const) {
    const terrace = ownedMesh(new THREE.RingGeometry(radius - 0.11, radius, 36), standardMaterial('#b98d43', owned, { roughness: 1 }), owned)
    terrace.rotation.x = -Math.PI / 2
    terrace.position.set(-0.55, y, 0.08)
    group.add(terrace)
  }
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + 0.12
    const grain = grainSheaf(owned, colors.accent)
    grain.position.set(-0.62 + Math.cos(a) * 2.32, 0.13, 0.08 + Math.sin(a) * 1.5)
    grain.rotation.y = -a
    group.add(grain)
  }
  addModelOrFallback(group, models, 'house', { x: 1.25, y: 0.08, z: -0.56, yaw: 0.16, height: 1.95 }, () => granaryFallback(owned))
  const chimney = ownedMesh(new THREE.CylinderGeometry(0.14, 0.19, 1.25, 6), standardMaterial('#8b6347', owned, { roughness: 1 }), owned)
  chimney.position.set(2.0, 1.05, -0.66)
  group.add(chimney)
}

function buildBaimin(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  // A bright plaster academy sits above its long, book-like island; real house texture supplies
  // the primary silhouette whenever the shipped asset is present.
  const steps = ownedMesh(new THREE.BoxGeometry(3.45, 0.2, 1.55), standardMaterial('#e5dfd0', owned, { roughness: 1 }), owned)
  steps.position.set(0.15, 0.18, -0.22)
  group.add(steps)
  addModelOrFallback(group, models, 'house', { x: 0.15, y: 0.28, z: -0.22, yaw: -0.06, height: 2.05 }, () => academyFallback(owned))
  for (const [x, z, s] of [[-2.7, 1.25, 1], [2.75, 0.98, 0.86], [-2.15, -1.45, 0.72]] as const) {
    addModelOrFallback(group, models, 'tree_pineRoundA', { x, y: 0.08, z, yaw: x * 0.8, height: 1.85 * s }, () => pineFallback(owned, '#426d62'))
  }
  addOpenBook(group, owned, 2.1, 0.3, -1.35, colors.accent)
}

function buildHeichi(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  // The dark, craggy coastline is intentionally more vertical than its neighbours.
  for (const [x, z, scale] of [[-2.8, 0.72, 0.82], [-1.95, 1.55, 0.56], [2.63, -1.22, 0.7]] as const) {
    addModelOrFallback(group, models, 'rock_smallA', { x, y: 0.08, z, yaw: x, span: scale }, () => rockFallback(owned, '#304951', scale))
  }
  addModelOrFallback(group, models, 'pavilion', { x: 0.72, y: 0.08, z: 0.18, yaw: 0.38, height: 2.05 }, () => lanternPavilionFallback(owned))
  addLantern(group, owned, 0.72, 2.0, 0.72, colors.accent)
  addModelOrFallback(group, models, 'tree_pineRoundA', { x: 2.7, y: 0.08, z: 1.28, yaw: 1.2, height: 1.42 }, () => pineFallback(owned, '#233f43'))
}

function buildPenglai(group: THREE.Group, colors: IslandColors, models: PortraitModels, owned: OwnedResources): void {
  const peaks = [
    { x: -1.85, z: 0.7, r: 1.28, h: 3.45 },
    { x: 0.18, z: -0.38, r: 1.46, h: 4.3 },
    { x: 2.12, z: 0.94, r: 1.12, h: 3.05 },
  ]
  for (const peak of peaks) steppedPeak(group, owned, peak.x, peak.z, peak.r, peak.h, colors.cliff)
  const terrace = mirrorTerrace(owned, colors.accent)
  terrace.position.set(0.15, 0.22, 1.6)
  group.add(terrace)
  addModelOrFallback(group, models, 'pavilion', { x: -2.7, y: 0.1, z: -0.95, yaw: -0.36, height: 1.32 }, () => pavilionFallback(owned, '#497e77'))
  for (const [x, z] of [[-3.05, 1.7], [2.95, -1.2]] as const) addRock(group, owned, x, 0.12, z, 0.42, colors.cliff)
}

function addModelOrFallback(
  group: THREE.Group,
  models: PortraitModels,
  key: PortraitModelKey,
  placement: ModelPlacement,
  fallback: () => THREE.Object3D,
  extraScale = 1,
): void {
  const source = models[key]
  if (source) {
    group.add(fittedModelClone(source, placement, extraScale))
  } else {
    const object = fallback()
    object.position.set(placement.x, placement.y, placement.z)
    object.rotation.y = placement.yaw ?? 0
    object.scale.setScalar(extraScale)
    group.add(object)
  }
}

/**
 * Clone only the object hierarchy, then size the clone through its transform. Geometry vertex
 * buffers are never rewritten (important for meshopt integer attributes), and model materials or
 * textures are never touched. Explicitly copying the root scale preserves any loaded transform.
 */
function fittedModelClone(source: THREE.Object3D, placement: ModelPlacement, extraScale: number): THREE.Group {
  const wrapper = new THREE.Group()
  const copy = source.clone(true)
  const originalScale = source.scale.clone()
  copy.scale.copy(originalScale)
  copy.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(copy)
  const size = bounds.getSize(new THREE.Vector3())
  const basis = placement.height ? size.y : Math.max(size.x, size.z)
  const desired = (placement.height ?? placement.span ?? 1) * extraScale
  const scale = desired / Math.max(basis, 0.001)
  copy.scale.copy(originalScale).multiplyScalar(scale)
  copy.updateMatrixWorld(true)
  const scaled = new THREE.Box3().setFromObject(copy)
  const centre = scaled.getCenter(new THREE.Vector3())
  copy.position.x -= centre.x
  copy.position.y -= scaled.min.y
  copy.position.z -= centre.z
  wrapper.add(copy)
  wrapper.position.set(placement.x, placement.y, placement.z)
  wrapper.rotation.y = placement.yaw ?? 0
  return wrapper
}

function standardMaterial(color: THREE.ColorRepresentation, owned: OwnedResources, options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.84, metalness: 0, ...options })
  owned.materials.add(material)
  return material
}

function lineMaterial(color: THREE.ColorRepresentation, owned: OwnedResources, opacity: number): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false })
  owned.materials.add(material)
  return material
}

function ownedMesh<G extends THREE.BufferGeometry>(geometry: G, material: THREE.Material, owned: OwnedResources): THREE.Mesh<G, THREE.Material> {
  owned.geometries.add(geometry)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function disposeOwned(owned: OwnedResources): void {
  for (const geometry of owned.geometries) geometry.dispose()
  for (const material of owned.materials) material.dispose()
}

function gateFallback(owned: OwnedResources, teal: string, gold: string): THREE.Group {
  const group = new THREE.Group()
  const stone = standardMaterial('#d4c39c', owned, { roughness: 0.95 })
  for (const x of [-1, 0, 1]) {
    const post = ownedMesh(new THREE.BoxGeometry(0.18, 1.85, 0.2), stone, owned)
    post.position.set(x, 0.93, 0)
    group.add(post)
  }
  const beam = ownedMesh(new THREE.BoxGeometry(2.48, 0.22, 0.28), standardMaterial(teal, owned), owned)
  beam.position.y = 1.72
  group.add(beam)
  const roof = ownedMesh(new THREE.ConeGeometry(1.52, 0.48, 4), standardMaterial(gold, owned, { flatShading: true }), owned)
  roof.position.y = 2.05
  roof.rotation.y = Math.PI / 4
  group.add(roof)
  return group
}

function stallFallback(owned: OwnedResources, canopy: string): THREE.Group {
  const group = new THREE.Group()
  const wood = standardMaterial('#8a5a39', owned)
  const counter = ownedMesh(new THREE.BoxGeometry(1.9, 0.74, 0.72), wood, owned)
  counter.position.y = 0.37
  group.add(counter)
  for (const x of [-0.78, 0.78]) {
    const post = ownedMesh(new THREE.CylinderGeometry(0.055, 0.065, 1.75, 6), wood, owned)
    post.position.set(x, 0.88, 0.18)
    group.add(post)
  }
  const awning = ownedMesh(new THREE.BoxGeometry(2.2, 0.12, 1.18), standardMaterial(canopy, owned), owned)
  awning.position.set(0, 1.74, 0)
  awning.rotation.x = -0.1
  group.add(awning)
  return group
}

function peachFallback(owned: OwnedResources): THREE.Group {
  const group = new THREE.Group()
  const trunk = ownedMesh(new THREE.CylinderGeometry(0.14, 0.23, 1.25, 7), standardMaterial('#704c36', owned, { flatShading: true }), owned)
  trunk.position.y = 0.62
  group.add(trunk)
  const blossom = standardMaterial('#e9a5b5', owned, { flatShading: true, roughness: 0.95 })
  for (const [x, y, z, scale] of [[0, 1.6, 0, 1], [0.43, 1.42, -0.1, 0.68], [-0.38, 1.45, 0.18, 0.74]] as const) {
    const crown = ownedMesh(new THREE.IcosahedronGeometry(0.64, 1), blossom, owned)
    crown.position.set(x, y, z)
    crown.scale.setScalar(scale)
    group.add(crown)
  }
  return group
}

function pavilionFallback(owned: OwnedResources, roof = '#3f8177'): THREE.Group {
  const group = new THREE.Group()
  const wood = standardMaterial('#6d4e38', owned)
  for (const [x, z] of [[-0.63, -0.5], [0.63, -0.5], [-0.63, 0.5], [0.63, 0.5]] as const) {
    const post = ownedMesh(new THREE.CylinderGeometry(0.06, 0.075, 1.45, 6), wood, owned)
    post.position.set(x, 0.73, z)
    group.add(post)
  }
  const roofMesh = ownedMesh(new THREE.ConeGeometry(1.16, 0.65, 4), standardMaterial(roof, owned, { flatShading: true }), owned)
  roofMesh.position.y = 1.73
  roofMesh.rotation.y = Math.PI / 4
  group.add(roofMesh)
  return group
}

function houseFallback(owned: OwnedResources, wall = '#d8c6a2', roof = '#8c4a3b'): THREE.Group {
  const group = new THREE.Group()
  const body = ownedMesh(new THREE.BoxGeometry(1.65, 1.1, 1.28), standardMaterial(wall, owned), owned)
  body.position.y = 0.56
  group.add(body)
  const roofMesh = ownedMesh(new THREE.ConeGeometry(1.35, 0.72, 4), standardMaterial(roof, owned, { flatShading: true }), owned)
  roofMesh.position.y = 1.47
  roofMesh.rotation.y = Math.PI / 4
  group.add(roofMesh)
  return group
}

function granaryFallback(owned: OwnedResources): THREE.Group {
  const granary = houseFallback(owned, '#b99b62', '#8a623d')
  const door = ownedMesh(new THREE.BoxGeometry(0.34, 0.62, 0.025), standardMaterial('#4d382b', owned), owned)
  door.position.set(0, 0.34, 0.655)
  granary.add(door)
  return granary
}

function academyFallback(owned: OwnedResources): THREE.Group {
  const group = houseFallback(owned, '#f1eee3', '#657f87')
  for (const x of [-0.55, -0.18, 0.18, 0.55]) {
    const column = ownedMesh(new THREE.CylinderGeometry(0.055, 0.065, 0.76, 8), standardMaterial('#faf6ea', owned), owned)
    column.position.set(x, 0.46, 0.66)
    group.add(column)
  }
  return group
}

function lanternPavilionFallback(owned: OwnedResources): THREE.Group {
  const group = pavilionFallback(owned, '#293f48')
  const lamp = ownedMesh(new THREE.BoxGeometry(0.36, 0.46, 0.36), standardMaterial('#d3a449', owned, { emissive: '#7d4b12', emissiveIntensity: 0.35 }), owned)
  lamp.position.y = 1.1
  group.add(lamp)
  return group
}

function pineFallback(owned: OwnedResources, color: string): THREE.Group {
  const group = new THREE.Group()
  const trunk = ownedMesh(new THREE.CylinderGeometry(0.11, 0.18, 1.2, 7), standardMaterial('#5e4936', owned), owned)
  trunk.position.y = 0.6
  group.add(trunk)
  for (const [y, r] of [[1.13, 0.62], [1.52, 0.49], [1.85, 0.34]] as const) {
    const crown = ownedMesh(new THREE.ConeGeometry(r, 0.74, 7), standardMaterial(color, owned, { flatShading: true }), owned)
    crown.position.y = y
    group.add(crown)
  }
  return group
}

function rockFallback(owned: OwnedResources, color: string, scale: number): THREE.Group {
  const group = new THREE.Group()
  const rock = ownedMesh(new THREE.DodecahedronGeometry(scale, 0), standardMaterial(color, owned, { flatShading: true, roughness: 1 }), owned)
  rock.position.y = scale * 0.72
  rock.scale.set(1.2, 0.86, 0.92)
  group.add(rock)
  return group
}

function addRock(group: THREE.Group, owned: OwnedResources, x: number, y: number, z: number, scale: number, color: string): void {
  const rock = rockFallback(owned, color, scale)
  rock.position.set(x, y, z)
  rock.rotation.y = x + z
  group.add(rock)
}

function steppedTower(owned: OwnedResources, accent: string): THREE.Group {
  const group = new THREE.Group()
  for (const [r, h, y] of [[1.14, 0.48, 0.24], [0.84, 0.72, 0.83], [0.56, 0.86, 1.62]] as const) {
    const tier = ownedMesh(new THREE.CylinderGeometry(r * 0.78, r, h, 6), standardMaterial(accent, owned, { flatShading: true }), owned)
    tier.position.y = y
    tier.rotation.y = Math.PI / 6
    group.add(tier)
  }
  const cap = ownedMesh(new THREE.ConeGeometry(0.42, 0.62, 6), standardMaterial('#e8c670', owned, { flatShading: true }), owned)
  cap.position.y = 2.36
  group.add(cap)
  return group
}

function addMask(group: THREE.Group, owned: OwnedResources, x: number, y: number, z: number, color: string, flip: number): void {
  const face = ownedMesh(new THREE.SphereGeometry(0.34, 10, 7), standardMaterial(color, owned, { flatShading: true }), owned)
  face.position.set(x, y, z)
  face.scale.set(0.76, 1.06, 0.34)
  face.rotation.y = flip * 0.2
  group.add(face)
  const eyeMaterial = standardMaterial('#312b2d', owned, { roughness: 1 })
  for (const dx of [-0.1, 0.1]) {
    const eye = ownedMesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMaterial, owned)
    eye.position.set(x + dx, y + 0.07, z + flip * 0.125)
    group.add(eye)
  }
}

function addTwinRidges(group: THREE.Group, owned: OwnedResources, color: string): void {
  for (const [x, z, rot] of [[-2.65, -1.25, 0.3], [2.62, 1.28, -0.25]] as const) {
    const ridge = ownedMesh(new THREE.ConeGeometry(0.78, 1.55, 5), standardMaterial(color, owned, { flatShading: true }), owned)
    ridge.position.set(x, 0.82, z)
    ridge.rotation.y = rot
    group.add(ridge)
  }
}

function grainSheaf(owned: OwnedResources, color: string): THREE.Group {
  const group = new THREE.Group()
  const gold = standardMaterial(color, owned, { flatShading: true, roughness: 0.9 })
  for (const dx of [-0.11, 0, 0.11]) {
    const stalk = ownedMesh(new THREE.CylinderGeometry(0.026, 0.038, 0.55, 5), gold, owned)
    stalk.position.set(dx, 0.32, 0)
    stalk.rotation.z = dx * 1.8
    group.add(stalk)
  }
  return group
}

function addOpenBook(group: THREE.Group, owned: OwnedResources, x: number, y: number, z: number, color: string): void {
  const paper = standardMaterial(color, owned, { roughness: 1, side: THREE.DoubleSide })
  for (const side of [-1, 1]) {
    const page = ownedMesh(new THREE.PlaneGeometry(0.53, 0.67), paper, owned)
    page.rotation.x = -Math.PI / 2
    page.rotation.z = side * 0.23
    page.position.set(x + side * 0.26, y, z)
    group.add(page)
  }
}

function addLantern(group: THREE.Group, owned: OwnedResources, x: number, y: number, z: number, color: string): void {
  const lamp = ownedMesh(new THREE.BoxGeometry(0.34, 0.48, 0.34), standardMaterial(color, owned, { emissive: color, emissiveIntensity: 0.45, roughness: 0.75 }), owned)
  lamp.position.set(x, y, z)
  group.add(lamp)
}

function steppedPeak(group: THREE.Group, owned: OwnedResources, x: number, z: number, radius: number, height: number, color: string): void {
  const layers = [
    { radius, height: height * 0.46, y: height * 0.23 },
    { radius: radius * 0.71, height: height * 0.4, y: height * 0.56 },
    { radius: radius * 0.39, height: height * 0.43, y: height * 0.86 },
  ]
  for (const layer of layers) {
    const peak = ownedMesh(new THREE.ConeGeometry(layer.radius, layer.height, 6), standardMaterial(color, owned, { flatShading: true, roughness: 0.95 }), owned)
    peak.position.set(x, layer.y + 0.08, z)
    peak.rotation.y = (x + z) * 0.35
    group.add(peak)
  }
}

function mirrorTerrace(owned: OwnedResources, accent: string): THREE.Group {
  const group = new THREE.Group()
  const base = ownedMesh(new THREE.CylinderGeometry(1.05, 1.25, 0.34, 8), standardMaterial('#d4c39f', owned, { flatShading: true }), owned)
  base.position.y = 0.18
  group.add(base)
  const mirror = ownedMesh(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 20), standardMaterial(accent, owned, { metalness: 0.32, roughness: 0.23, emissive: '#1d5d62', emissiveIntensity: 0.12 }), owned)
  mirror.position.set(0, 0.41, 0)
  group.add(mirror)
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const rail = ownedMesh(new THREE.BoxGeometry(0.15, 0.58, 0.15), standardMaterial('#76604a', owned), owned)
    rail.position.set(Math.cos(angle) * 0.88, 0.48, Math.sin(angle) * 0.88)
    group.add(rail)
  }
  return group
}
