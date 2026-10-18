import * as THREE from 'three'
import { rng } from './stage'
import type { Island } from './terrain'

/**
 * Instanced meadow life: thousands of grass tufts and small wild flowers that sway in the wind.
 * One draw call per kind; wind is a vertex-shader offset weighted by blade height, so it costs
 * nothing on the CPU. Density adapts to the quality preset.
 */
const windUniforms = { uTime: { value: 0 } }

export function updateWind(time: number): void {
  windUniforms.uTime.value = time
}

function addWind(mat: THREE.Material, strength: number): void {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = windUniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float k = max(position.y, 0.0);
          float gust = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.22) * 0.6 + sin(uTime * 3.1 + wp.x * 1.3) * 0.25;
          transformed.x += gust * k * k * ${strength.toFixed(3)};
          transformed.z += cos(uTime * 1.3 + wp.z * 0.4) * k * k * ${(strength * 0.5).toFixed(3)};
        }`,
      )
  }
}

/** A tuft of five tapered blades, base at y = 0, colour graded dark root → light tip. */
function tuftGeometry(base: THREE.Color, tip: THREE.Color): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const r = rng(7)
  for (let b = 0; b < 7; b += 1) {
    const a = (b / 7) * Math.PI * 2 + r() * 0.6
    const lean = 0.05 + r() * 0.08
    const h = 0.14 + r() * 0.14
    const w = 0.022 + r() * 0.012
    const ox = Math.cos(a) * (0.04 + r() * 0.08)
    const oz = Math.sin(a) * (0.04 + r() * 0.08)
    const px = -Math.sin(a) * w
    const pz = Math.cos(a) * w
    const tx = ox + Math.cos(a) * lean
    const tz = oz + Math.sin(a) * lean
    pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz)
    for (const t of [0, 0, 1]) {
      const c = base.clone().lerp(tip, t)
      col.push(c.r, c.g, c.b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  // Point normals up so blades light like the ground they grow from (no dark backfaces).
  const n = g.getAttribute('normal') as THREE.BufferAttribute
  for (let i = 0; i < n.count; i += 1) n.setXYZ(i, 0, 1, 0)
  return g
}

/** Five-petal flower head on a short stem. */
function flowerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.26, 3).translate(0, 0.13, 0)
  parts.push(stem)
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2
    const petal = new THREE.CircleGeometry(0.035, 5).rotateX(-Math.PI / 2 + 0.35).translate(0, 0.27, 0.03)
    petal.rotateY(a)
    parts.push(petal)
  }
  const heart = new THREE.SphereGeometry(0.018, 5, 3).translate(0, 0.28, 0)
  parts.push(heart)
  // Stem/heart vertices are coloured separately from petals via the "color" attribute.
  const colored = parts.map((p, i) => {
    const g = p.index ? p.toNonIndexed() : p
    const c = i === 0 ? new THREE.Color('#4f7d3a') : i === parts.length - 1 ? new THREE.Color('#f2c94c') : new THREE.Color('#ffffff')
    const arr: number[] = []
    for (let k = 0; k < g.getAttribute('position').count; k += 1) arr.push(c.r, c.g, c.b)
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3))
    g.deleteAttribute('uv')
    return g
  })
  return mergeSimple(colored)
}

function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  for (const g of geos) {
    pos.push(...(g.getAttribute('position').array as Float32Array))
    nor.push(...(g.getAttribute('normal').array as Float32Array))
    col.push(...(g.getAttribute('color').array as Float32Array))
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return out
}

export type FoliageOpts = {
  density: number
  grassBase: string
  grassTip: string
  flowers?: string[]
  flowerRatio?: number
  seed: number
  /** Extra keep-out circles (e.g. NPC spots). */
  avoid?: { x: number; z: number; r: number }[]
}

export function plantMeadow(scene: THREE.Scene, island: Island, radius: number, opts: FoliageOpts): void {
  const rand = rng(opts.seed)
  const area = Math.PI * radius * radius
  const tufts = Math.round(area * 4 * opts.density)
  const flowersN = Math.round(tufts * (opts.flowerRatio ?? 0.08))
  const keep = (x: number, z: number) => island.isMeadow(x, z) && !(opts.avoid ?? []).some(a => Math.hypot(a.x - x, a.z - z) < a.r)
  const sample = (n: number, cb: (x: number, y: number, z: number, i: number) => void) => {
    let placed = 0
    for (let tries = 0; placed < n && tries < n * 4; tries += 1) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * radius * 0.9
      const x = island.cx + Math.cos(a) * r
      const z = island.cz + Math.sin(a) * r
      if (!keep(x, z)) continue
      cb(x, island.heightAt(x, z), z, placed)
      placed += 1
    }
    return placed
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const sc = new THREE.Vector3()
  const p = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  const gMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  addWind(gMat, 1.2)
  const grass = new THREE.InstancedMesh(tuftGeometry(new THREE.Color(opts.grassBase), new THREE.Color(opts.grassTip)), gMat, tufts)
  const tint = new THREE.Color()
  const count = sample(tufts, (x, y, z, i) => {
    q.setFromAxisAngle(up, rand() * Math.PI * 2)
    const s = 0.8 + rand() * 0.6
    sc.set(s, s * (0.7 + rand() * 0.6), s)
    m.compose(p.set(x, y - 0.02, z), q, sc)
    grass.setMatrixAt(i, m)
    grass.setColorAt(i, tint.setHSL(0, 0, 0.92 + rand() * 0.16))
  })
  grass.count = count
  grass.receiveShadow = true
  grass.frustumCulled = false
  scene.add(grass)

  if (opts.flowers?.length && flowersN > 0) {
    const fMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    addWind(fMat, 0.6)
    const flowers = new THREE.InstancedMesh(flowerGeometry(), fMat, flowersN)
    // Flowers grow in drifts: pick cluster centres, then scatter around them.
    const colors = opts.flowers.map(c => new THREE.Color(c))
    let n = 0
    for (let c = 0; c < flowersN / 9 && n < flowersN; c += 1) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * radius * 0.85
      const cx = island.cx + Math.cos(a) * r
      const cz = island.cz + Math.sin(a) * r
      const color = colors[Math.floor(rand() * colors.length)]
      for (let k = 0; k < 12 && n < flowersN; k += 1) {
        const x = cx + (rand() - 0.5) * 2.6
        const z = cz + (rand() - 0.5) * 2.6
        if (!keep(x, z)) continue
        q.setFromAxisAngle(up, rand() * Math.PI * 2)
        const s = 0.8 + rand() * 0.7
        m.compose(p.set(x, island.heightAt(x, z) - 0.02, z), q, sc.set(s, s, s))
        flowers.setMatrixAt(n, m)
        flowers.setColorAt(n, color)
        n += 1
      }
    }
    flowers.count = n
    flowers.frustumCulled = false
    scene.add(flowers)
  }
}
