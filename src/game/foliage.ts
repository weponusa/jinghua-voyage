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

export type MeadowForm = 'garden' | 'cloud' | 'stern' | 'scrub' | 'academy' | 'wetland' | 'fairy'

/** Region-specific blade count, height, width and lean; never just a palette swap. */
function tuftGeometry(base: THREE.Color, tip: THREE.Color, form: MeadowForm): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const shapes = {
    garden: { blades: 7, h: [0.12, 0.26], w: [0.010, 0.019], lean: [0.09, 0.25], seed: 7 },
    cloud: { blades: 5, h: [0.22, 0.40], w: [0.013, 0.024], lean: [0.15, 0.36], seed: 17 },
    stern: { blades: 5, h: [0.24, 0.43], w: [0.007, 0.013], lean: [0.025, 0.10], seed: 27 },
    scrub: { blades: 4, h: [0.08, 0.19], w: [0.014, 0.026], lean: [0.13, 0.31], seed: 37 },
    academy: { blades: 6, h: [0.08, 0.18], w: [0.010, 0.017], lean: [0.06, 0.16], seed: 47 },
    wetland: { blades: 9, h: [0.30, 0.55], w: [0.006, 0.012], lean: [0.035, 0.17], seed: 57 },
    fairy: { blades: 6, h: [0.15, 0.30], w: [0.010, 0.019], lean: [0.12, 0.28], seed: 67 },
  } as const
  const shape = shapes[form]
  const r = rng(shape.seed)
  const vertex = (x: number, y: number, z: number, t: number) => {
    pos.push(x, y, z)
    const c = base.clone().lerp(tip, t)
    col.push(c.r, c.g, c.b)
  }
  for (let b = 0; b < shape.blades; b += 1) {
    const a = (b / shape.blades) * Math.PI * 2 + r() * 0.6
    const lean = shape.lean[0] + r() * (shape.lean[1] - shape.lean[0])
    const h = shape.h[0] + r() * (shape.h[1] - shape.h[0])
    const w = shape.w[0] + r() * (shape.w[1] - shape.w[0])
    const ox = Math.cos(a) * (0.035 + r() * 0.075)
    const oz = Math.sin(a) * (0.035 + r() * 0.075)
    for (let segment = 0; segment < 2; segment += 1) {
      const t0 = segment / 2
      const t1 = (segment + 1) / 2
      const w0 = w * (1 - t0 * 0.9)
      const w1 = w * (1 - t1 * 0.9)
      const x0 = ox + Math.cos(a) * lean * t0 * t0
      const z0 = oz + Math.sin(a) * lean * t0 * t0
      const x1 = ox + Math.cos(a) * lean * t1 * t1
      const z1 = oz + Math.sin(a) * lean * t1 * t1
      const p0x = -Math.sin(a) * w0, p0z = Math.cos(a) * w0
      const p1x = -Math.sin(a) * w1, p1z = Math.cos(a) * w1
      vertex(x0 - p0x, h * t0, z0 - p0z, t0); vertex(x0 + p0x, h * t0, z0 + p0z, t0); vertex(x1 + p1x, h * t1, z1 + p1z, t1)
      vertex(x0 - p0x, h * t0, z0 - p0z, t0); vertex(x1 + p1x, h * t1, z1 + p1z, t1); vertex(x1 - p1x, h * t1, z1 - p1z, t1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  const n = g.getAttribute('normal') as THREE.BufferAttribute
  for (let i = 0; i < n.count; i += 1) n.setXYZ(i, 0, 1, 0)
  return g
}

/** Flower silhouette varies by region: five cloud petals, dry four-petal blooms or fairy stars. */
function flowerGeometry(form: MeadowForm): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const petalCount = form === 'scrub' ? 4 : form === 'cloud' || form === 'academy' ? 5 : form === 'fairy' ? 9 : 7
  const stemHeight = form === 'wetland' ? 0.39 : form === 'scrub' ? 0.18 : 0.26
  const stem = new THREE.CylinderGeometry(0.008, 0.01, stemHeight, 3).translate(0, stemHeight / 2, 0)
  parts.push(stem)
  for (let i = 0; i < petalCount; i += 1) {
    const a = (i / petalCount) * Math.PI * 2
    const petal = new THREE.CircleGeometry(form === 'fairy' ? 0.052 : 0.043, form === 'stern' ? 4 : 8)
      .scale(form === 'fairy' ? 0.34 : 0.64, form === 'cloud' ? 1.52 : 1.28, 1)
      .rotateX(-Math.PI / 2 + (form === 'wetland' ? 0.78 : 0.42))
      .translate(0, stemHeight + 0.01, form === 'fairy' ? 0.052 : 0.041)
    petal.rotateY(a)
    parts.push(petal)
  }
  const heart = new THREE.SphereGeometry(0.018, 5, 3).translate(0, stemHeight + 0.02, 0)
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
  form?: MeadowForm
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
  const tufts = Math.round(area * 5.5 * opts.density)
  const flowersN = Math.round(tufts * (opts.flowerRatio ?? 0.1))
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
  const form = opts.form ?? 'garden'
  const grass = new THREE.InstancedMesh(tuftGeometry(new THREE.Color(opts.grassBase), new THREE.Color(opts.grassTip), form), gMat, tufts)
  grass.name = `meadow-grass-${form}`
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
    const flowers = new THREE.InstancedMesh(flowerGeometry(form), fMat, flowersN)
    flowers.name = `meadow-flowers-${form}`
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
