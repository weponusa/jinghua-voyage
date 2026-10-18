import * as THREE from 'three'
import { fbm, ringNoise, segDist, smoothstep } from './noise'

/**
 * Hand-shaped island terrain, built procedurally so every chapter gets a sculpted landmass rather
 * than a flat disc: an irregular coastline, sand beach and wet sand shelving into the sea, gentle
 * rolling meadows, raised hills, flattened plots for buildings and worn earth paths, all painted
 * with vertex colours (grass tones, flower meadows, path earth, rock on steep slopes).
 * Ground level at the island core is y = 0 so chapter coordinates stay simple; the sea is at
 * WATER_Y. `heightAt` lets props and NPCs sit exactly on the ground.
 */
export const WATER_Y = -0.55

export type Hill = { x: number; z: number; r: number; h: number; /** Flat top radius (0 = round). */ top?: number }
export type Flat = { x: number; z: number; r: number; y?: number }
export type IslandSpec = {
  x?: number
  z?: number
  radius: number
  seed: number
  /** Meadow undulation amplitude (m). */
  roll?: number
  hills?: Hill[]
  flats?: Flat[]
  /** Polylines of [x, z]; paths are flattened, slightly sunken and painted earth/stone. */
  paths?: [number, number][][]
  pathWidth?: number
  pathColor?: string
  /** Paving instead of earth (white stone slabs). */
  paved?: boolean
  colors: { grass: string; grass2?: string; sand: string; rock?: string; meadow?: string }
  /** Coastline wobble (fraction of radius). */
  wobble?: number
}

export class Island {
  readonly mesh: THREE.Mesh
  readonly cx: number
  readonly cz: number
  private readonly spec: IslandSpec

  constructor(spec: IslandSpec) {
    this.spec = spec
    this.cx = spec.x ?? 0
    this.cz = spec.z ?? 0
    this.mesh = this.build()
  }

  /** Coast radius in a direction. */
  coast(angle: number): number {
    const s = this.spec
    return s.radius * (1 + (s.wobble ?? 0.1) * ringNoise(angle, s.seed, 2.2, 3))
  }

  /** Normalised distance: 0 at centre, 1 at the waterline. */
  rel(x: number, z: number): number {
    const dx = x - this.cx
    const dz = z - this.cz
    return Math.hypot(dx, dz) / this.coast(Math.atan2(dz, dx))
  }

  /** Path influence 0..1 (1 = centre of a path). */
  pathWeight(x: number, z: number): number {
    const w = (this.spec.pathWidth ?? 1.8) / 2
    let best = Infinity
    for (const line of this.spec.paths ?? []) {
      for (let i = 0; i < line.length - 1; i += 1) {
        best = Math.min(best, segDist(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]))
      }
    }
    // Ragged edge so the path reads as worn ground rather than a stripe.
    const edge = w + fbm(x * 0.9, z * 0.9, this.spec.seed + 5, 2) * 0.35
    return 1 - smoothstep(edge - 0.35, edge + 0.25, best)
  }

  /** Ground height (world y) at x, z. */
  heightAt(x: number, z: number): number {
    const s = this.spec
    const d = this.rel(x, z)
    // Coast profile: meadow plateau, a rounded shoulder, beach, then shelving sea floor.
    const shoulder = 1 - smoothstep(0.78, 0.97, d)
    const beach = -0.3 * smoothstep(0.9, 1.0, d)
    const shelf = -1.6 * smoothstep(1.0, 1.25, d)
    let h = shoulder * 0.0 + (1 - shoulder) * -0.25 + beach + shelf
    // Rolling meadow.
    const roll = (s.roll ?? 0.35) * fbm(x * 0.07, z * 0.07, s.seed, 4) * shoulder
    h += roll
    for (const hill of s.hills ?? []) {
      const r = Math.hypot(x - hill.x, z - hill.z)
      const top = hill.top ?? 0
      const t = r <= top ? 1 : 1 - smoothstep(0, 1, (r - top) / Math.max(0.01, hill.r - top))
      const bumps = r > top ? fbm(x * 0.25, z * 0.25, s.seed + 9, 3) * 0.12 * hill.h * t * (1 - t) * 4 : 0
      h += hill.h * t * t * (3 - 2 * t) + bumps
    }
    // Building plots: blend towards a level height.
    for (const f of s.flats ?? []) {
      const r = Math.hypot(x - f.x, z - f.z)
      const w = 1 - smoothstep(f.r, f.r + 1.6, r)
      h = h * (1 - w) + (f.y ?? 0) * w
    }
    // Paths: smooth out undulation and sink a few centimetres.
    const p = this.pathWeight(x, z)
    if (p > 0 && d < 0.95) h = h * (1 - p * 0.55) - p * 0.04
    return h
  }

  /** Slope magnitude (rise/run) by central differences. */
  slopeAt(x: number, z: number): number {
    const e = 0.35
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e)
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e)
    return Math.hypot(dx, dz)
  }

  /** True where foliage may grow (meadow, not path/beach/plots/steep rock). */
  isMeadow(x: number, z: number): boolean {
    const d = this.rel(x, z)
    if (d > 0.86) return false
    if (this.pathWeight(x, z) > 0.05) return false
    for (const f of this.spec.flats ?? []) if (Math.hypot(x - f.x, z - f.z) < f.r + 0.3) return false
    return this.slopeAt(x, z) < 0.9
  }

  private build(): THREE.Mesh {
    const s = this.spec
    const R = s.radius * (1 + (s.wobble ?? 0.1)) * 1.3
    // Polar grid: dense near the shore where the profile changes fastest.
    const rings = Math.round(Math.min(90, 40 + s.radius * 1.6))
    const seg = Math.round(Math.min(220, 96 + s.radius * 4))
    const pos: number[] = []
    const col: number[] = []
    const grass = new THREE.Color(s.colors.grass)
    const grass2 = new THREE.Color(s.colors.grass2 ?? new THREE.Color(s.colors.grass).offsetHSL(0.04, -0.05, 0.08).getStyle())
    const meadow = new THREE.Color(s.colors.meadow ?? '#c9c46a')
    const sand = new THREE.Color(s.colors.sand)
    const wet = sand.clone().multiplyScalar(0.72)
    const rock = new THREE.Color(s.colors.rock ?? '#8c8273')
    const earth = new THREE.Color(s.pathColor ?? (s.paved ? '#d9d2c1' : '#b99a6e'))
    const tmp = new THREE.Color()
    const vtx = (x: number, z: number) => {
      const y = this.heightAt(x, z)
      pos.push(x, y, z)
      const d = this.rel(x, z)
      const n = fbm(x * 0.12, z * 0.12, s.seed + 3, 3)
      const fine = fbm(x * 0.9, z * 0.9, s.seed + 4, 2)
      tmp.copy(grass).lerp(grass2, smoothstep(-0.25, 0.45, n))
      // Sun-dried meadow patches.
      tmp.lerp(meadow, smoothstep(0.25, 0.6, fbm(x * 0.05 + 3, z * 0.05, s.seed + 8, 3)) * 0.45)
      tmp.offsetHSL(0, 0, fine * 0.035)
      const slope = this.slopeAt(x, z)
      tmp.lerp(rock, smoothstep(0.7, 1.25, slope))
      const p = this.pathWeight(x, z)
      if (p > 0) {
        const e = earth.clone().offsetHSL(0, 0, fine * 0.05)
        tmp.lerp(e, Math.min(1, p * 1.25))
      }
      // Beach band, wet sand below the waterline, and a darker sea floor.
      const sandW = smoothstep(0.8, 0.9, d + fine * 0.02)
      tmp.lerp(sand, sandW)
      tmp.lerp(wet, smoothstep(0.97, 1.03, d))
      tmp.lerp(new THREE.Color('#5d7f7a'), smoothstep(1.06, 1.25, d))
      col.push(tmp.r, tmp.g, tmp.b)
    }
    vtx(this.cx, this.cz)
    for (let i = 1; i <= rings; i += 1) {
      const t = i / rings
      const rr = R * Math.pow(t, 0.85)
      for (let j = 0; j < seg; j += 1) {
        const a = (j / seg) * Math.PI * 2
        vtx(this.cx + Math.cos(a) * rr, this.cz + Math.sin(a) * rr)
      }
    }
    const idx: number[] = []
    for (let j = 0; j < seg; j += 1) idx.push(0, 1 + ((j + 1) % seg), 1 + j)
    for (let i = 1; i < rings; i += 1) {
      const a0 = 1 + (i - 1) * seg
      const b0 = 1 + i * seg
      for (let j = 0; j < seg; j += 1) {
        const j1 = (j + 1) % seg
        idx.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    mesh.name = 'island'
    return mesh
  }

  /** Vertex/index arrays for a physics trimesh. */
  trimesh(): { vertices: Float32Array; indices: Uint32Array } {
    const g = this.mesh.geometry
    return { vertices: new Float32Array(g.getAttribute('position').array), indices: new Uint32Array(g.getIndex()!.array) }
  }
}
