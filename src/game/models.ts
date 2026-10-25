import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * Model registry. Files under assets/models/ are discovered at build time, so a model that has not
 * been produced yet simply falls back to its procedural stand-in instead of breaking the build.
 * Every model is normalised once: scaled to a target height (or length), feet/bottom at y = 0,
 * centred on x/z and turned so that it faces -Z (the game's "forward").
 */
const FILES = import.meta.glob('../../assets/models/**/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export type CharKey =
  | 'tangao' | 'linzhiyang' | 'duojiugong' | 'seller' | 'buyer' | 'elder' | 'daren' | 'official' | 'granny' | 'child'
  | 'oilseller' | 'liangmian' | 'miser' | 'servant' | 'scholar' | 'heichi_red' | 'heichi_purple' | 'baihua'
export type PropKey =
  | 'junk_ship' | 'pavilion' | 'paifang' | 'market_stall' | 'house' | 'chinese_pine' | 'peach_tree' | 'willow' | 'arch_bridge'
  | 'stone_lantern' | 'bamboo' | 'taihu_rock' | 'small_boat' | 'lantern_post' | 'desk_books' | 'food_stove' | 'riddle_rack'
  | 'mirror_terrace' | 'lotus' | 'cloud_gate' | 'twin_screen' | 'banquet_house' | 'academy_hall' | 'library_tower'
  | 'sky_palm' | 'stern_cypress' | 'amber_tree' | 'scholar_oak' | 'fairy_tree'
type KitKey =
  | 'rock_largeA' | 'rock_largeC' | 'rock_tallB' | 'rock_smallA' | 'stone_tallC' | 'stone_largeB' | 'plant_bush' | 'plant_bushLarge'
  | 'lily_large' | 'log' | 'pot_large' | 'stump_round' | 'canoe' | 'tree_pineRoundA' | 'tree_pineTallA' | 'tree_oak' | 'tree_default'
  | 'tree_fat' | 'tree_cone' | 'tree_palmTall' | 'tree_palmBend' | 'tree_pineRoundC' | 'tree_blocks_fall'
  | 'flower_purpleA' | 'flower_yellowA' | 'flower_redA' | 'grass' | 'grass_large' | 'mushroom_redGroup' | 'bridge_wood' | 'fence_simple'
export type ModelKey = CharKey | PropKey | KitKey

type Spec = {
  path: string
  /** Target height in metres (characters/buildings). */
  height?: number
  /** Target length of the longest horizontal side (ships, bridges). */
  length?: number
  /** Uniform scale instead of a height (catalog kit pieces). */
  scale?: number
  /** Extra yaw so the model faces -Z (the game's forward). Image-to-3D characters face +X. */
  yaw?: number
}

const CHAR = (name: string, height = 1.75, yaw = Math.PI / 2): Spec => ({ path: `chars/${name}.glb`, height, yaw })
const PROP = (name: string, height: number, yaw = 0): Spec => ({ path: `props/${name}.glb`, height, yaw })
const KIT = (name: string, scale = 3): Spec => ({ path: `nature/${name}.glb`, scale })

export const MODELS: Record<ModelKey, Spec> = {
  tangao: CHAR('tangao', 1.78),
  linzhiyang: CHAR('linzhiyang', 1.72),
  duojiugong: CHAR('duojiugong', 1.7, Math.PI),
  seller: CHAR('seller', 1.76),
  buyer: CHAR('buyer', 1.74),
  elder: CHAR('elder', 1.68),
  daren: CHAR('daren', 2.5, Math.PI),
  official: CHAR('official', 1.85, Math.PI),
  granny: CHAR('granny', 1.5, Math.PI),
  child: CHAR('child', 1.2, Math.PI),
  oilseller: CHAR('oilseller', 1.72),
  liangmian: CHAR('liangmian', 1.8, Math.PI),
  miser: CHAR('miser', 1.7, Math.PI),
  servant: CHAR('servant', 1.66, Math.PI),
  scholar: CHAR('scholar', 1.86, Math.PI),
  heichi_red: CHAR('heichi_red', 1.62, Math.PI),
  heichi_purple: CHAR('heichi_purple', 1.6, Math.PI),
  baihua: CHAR('baihua', 1.9, Math.PI),
  junk_ship: { path: 'props/junk_ship.glb', length: 26 },
  pavilion: PROP('pavilion', 5.4),
  paifang: PROP('paifang', 6.2, Math.PI / 2),
  market_stall: PROP('market_stall', 3.1, -Math.PI / 2),
  house: PROP('house', 5, -Math.PI / 2),
  chinese_pine: PROP('chinese_pine', 6.5),
  sky_palm: PROP('sky_palm', 7.2),
  stern_cypress: PROP('stern_cypress', 6.2),
  amber_tree: PROP('amber_tree', 5.5),
  scholar_oak: PROP('scholar_oak', 5.8),
  fairy_tree: PROP('fairy_tree', 6.1),
  peach_tree: PROP('peach_tree', 5.2),
  willow: PROP('willow', 6.5),
  arch_bridge: { path: 'props/arch_bridge.glb', length: 9 },
  stone_lantern: PROP('stone_lantern', 1.6),
  bamboo: PROP('bamboo', 6),
  taihu_rock: PROP('taihu_rock', 2.4),
  small_boat: { path: 'props/small_boat.glb', length: 5.5 },
  lantern_post: PROP('lantern_post', 2.6),
  desk_books: PROP('desk_books', 1.1),
  food_stove: PROP('food_stove', 1.5),
  riddle_rack: PROP('riddle_rack', 3),
  mirror_terrace: PROP('mirror_terrace', 2.6),
  lotus: PROP('lotus', 0.7),
  cloud_gate: PROP('cloud_gate', 6),
  twin_screen: PROP('twin_screen', 4.5),
  banquet_house: PROP('banquet_house', 5.5),
  academy_hall: PROP('academy_hall', 5),
  library_tower: PROP('library_tower', 7),
  rock_largeA: KIT('rock_largeA', 3), rock_largeC: KIT('rock_largeC', 3), rock_tallB: KIT('rock_tallB', 3), rock_smallA: KIT('rock_smallA', 3),
  stone_tallC: KIT('stone_tallC', 3), stone_largeB: KIT('stone_largeB', 3),
  plant_bush: KIT('plant_bush', 3), plant_bushLarge: KIT('plant_bushLarge', 3), lily_large: KIT('lily_large', 3), log: KIT('log', 3),
  tree_pineRoundA: KIT('tree_pineRoundA', 3.2), tree_pineTallA: KIT('tree_pineTallA', 3.2), tree_oak: KIT('tree_oak', 3.4), tree_default: KIT('tree_default', 3),
  tree_fat: KIT('tree_fat', 3.2), tree_cone: KIT('tree_cone', 3.2), tree_palmTall: KIT('tree_palmTall', 3.2), tree_palmBend: KIT('tree_palmBend', 3.2),
  tree_pineRoundC: KIT('tree_pineRoundC', 3.2), tree_blocks_fall: KIT('tree_blocks_fall', 3),
  flower_purpleA: KIT('flower_purpleA', 2), flower_yellowA: KIT('flower_yellowA', 2), flower_redA: KIT('flower_redA', 2),
  grass: KIT('grass', 2), grass_large: KIT('grass_large', 2), mushroom_redGroup: KIT('mushroom_redGroup', 2),
  bridge_wood: KIT('bridge_wood', 3), fence_simple: KIT('fence_simple', 3),
  pot_large: KIT('pot_large', 3), stump_round: KIT('stump_round', 3), canoe: KIT('canoe', 3),
}

function urlFor(spec: Spec): string | undefined {
  return FILES[`../../assets/models/${spec.path}`]
}

export function hasModel(key: ModelKey): boolean {
  return urlFor(MODELS[key]) !== undefined
}

// Shipped models are meshopt-compressed with WebP textures (scripts/optimize-models.sh).
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map<ModelKey, Promise<THREE.Object3D | null>>()

/** Load (once) and normalise a model. Resolves to null when the file is missing or broken. */
export function loadModel(key: ModelKey): Promise<THREE.Object3D | null> {
  let pending = cache.get(key)
  if (!pending) {
    const spec = MODELS[key]
    const url = urlFor(spec)
    pending = url
      ? loader.loadAsync(url).then(gltf => normalise(gltf.scene, spec)).catch(err => {
          console.warn(`model ${key} failed to load`, err)
          return null
        })
      : Promise.resolve(null)
    cache.set(key, pending)
  }
  return pending
}

/** Preload several models, reporting progress in 0..1. */
export async function preload(keys: ModelKey[], onProgress?: (p: number) => void): Promise<void> {
  let done = 0
  const unique = [...new Set(keys)]
  onProgress?.(unique.length ? 0 : 1)
  await Promise.all(unique.map(k => loadModel(k).then(() => onProgress?.(++done / unique.length))))
}

/** A fresh instance of a loaded model (shares geometry/materials), or null if unavailable. */
/** Catalog stand-ins for generated props that are not in this build yet. */
const STAND_IN: Partial<Record<ModelKey, ModelKey>> = {
  chinese_pine: 'tree_pineRoundA', willow: 'tree_oak', peach_tree: 'tree_default', taihu_rock: 'rock_tallB', small_boat: 'canoe',
}

export async function instance(key: ModelKey): Promise<THREE.Object3D | null> {
  let base = await loadModel(key)
  const alt = STAND_IN[key]
  const useAlt = !base && !!alt
  if (!base && alt) {
    base = await loadModel(alt)
    if (base && !base.userData.toned && !MODELS[key].path.startsWith('chars/')) {
      // Pull the bright catalog colours toward the ink-wash palette so stand-ins sit in the scene.
      const tone = new THREE.Color(alt.startsWith('tree') ? '#3f6b4c' : '#a39a88')
      base.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (m?.color) m.color.lerp(tone, alt.startsWith('tree') ? 0.55 : 0.6)
      })
      base.userData.toned = true
    }
  }
  if (!base) return null
  const copy = base.clone(true)
  if (useAlt && alt && MODELS[key].path.startsWith('chars/')) {
    copy.scale.multiplyScalar((MODELS[key].height ?? 1.7) / (MODELS[alt].height ?? 1.7))
  }
  copy.traverse(o => { o.userData.sharedModel = true })
  return copy
}

function normalise(scene: THREE.Object3D, spec: Spec): THREE.Object3D {
  const inner = scene
  inner.rotation.y = spec.yaw ?? 0
  inner.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(inner)
  const size = box.getSize(new THREE.Vector3())
  const scale = spec.height ? spec.height / Math.max(size.y, 1e-3) : spec.length ? spec.length / Math.max(size.x, size.z, 1e-3) : spec.scale ?? 1
  inner.scale.setScalar(scale)
  inner.updateMatrixWorld(true)
  const scaled = new THREE.Box3().setFromObject(inner)
  const centre = scaled.getCenter(new THREE.Vector3())
  inner.position.set(-centre.x, -scaled.min.y, -centre.z)
  inner.traverse(o => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial
      if (spec.path.startsWith('nature/')) {
        // The catalog's neon cyan "grass" and orange "dirt" made rocks and bushes read as
        // metal crystals. Correct the shared source materials once, for every island.
        const natural: Record<string, string> = {
          grass: '#526b42', leafsDark: '#294d3d', leafsGreen: '#4f7549', leafsFall: '#a56f32',
          dirt: '#807664', stone: '#8f9389', wood: '#76533a', woodBark: '#68503b',
          woodBarkDark: '#4f4033', woodDark: '#594334', woodInner: '#b49a73',
          colorRed: '#a84d45', colorYellow: '#c6a34d', colorPurple: '#8a719d',
        }
        const color = natural[std.name]
        if (color) std.color.set(color)
      }
      // Generated PBR often reads too metallic/glossy under stylised lighting.
      if (std.isMeshStandardMaterial) {
        std.metalness = Math.min(std.metalness, 0.15)
        std.roughness = Math.max(std.roughness, 0.6)
      }
    }
  })
  const root = new THREE.Group()
  root.name = spec.path
  root.add(inner)
  return root
}
