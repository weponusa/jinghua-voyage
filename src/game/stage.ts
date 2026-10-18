import * as THREE from 'three'
import type { Physics } from '../engine/physics'
import { plantMeadow, updateWind, type FoliageOpts } from './foliage'
import { instance, type ModelKey } from './models'
import { fbm, ringNoise } from './noise'
import { Island, WATER_Y, type IslandSpec } from './terrain'

export type Palette = { sky: string; horizon: string; fog: string; water: string; grass: string; sand: string; accent: string }

/** Mulberry32: tiny deterministic RNG so every island looks the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type TerrainOpts = Partial<Omit<IslandSpec, 'colors' | 'radius'>> & {
  colors?: Partial<IslandSpec['colors']>
  foliage?: Partial<FoliageOpts> | false
}

/**
 * Shared scenery for every scene, painted after 青绿山水 (blue-green landscape) scrolls:
 * a luminous gradient sky with a soft sun, drifting painted clouds, three layers of misty
 * blue-green ridges on the horizon, a sea that turns jade over the shallows with lapping foam,
 * and warm sunlight. Each chapter then sculpts its island with `terrain()`.
 */
export class Stage {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  ground?: Island
  private readonly waterMat: THREE.ShaderMaterial
  private readonly water: THREE.Mesh
  private readonly clouds: THREE.Sprite[] = []
  private time = 0
  private readonly spinners: { obj: THREE.Object3D; speed: number }[] = []
  private readonly bobbers: { obj: THREE.Object3D; base: number; amp: number; speed: number; phase: number }[] = []

  constructor(readonly physics: Physics, readonly palette: Palette, shadowSize: number, readonly detail = 1) {
    const scene = this.scene
    const horizon = new THREE.Color(palette.horizon)
    scene.background = horizon.clone()
    scene.fog = new THREE.Fog(palette.fog, 55, 230)

    this.sky()
    scene.add(new THREE.HemisphereLight('#fff6e4', new THREE.Color(palette.grass).multiplyScalar(0.55), 1.25))
    this.sun = new THREE.DirectionalLight('#fff0d2', 2.6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowSize, shadowSize)
    const s = this.sun.shadow.camera
    s.left = -26; s.right = 26; s.top = 26; s.bottom = -26; s.near = 1; s.far = 140
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.05
    scene.add(this.sun, this.sun.target)

    this.waterMat = this.makeWater()
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), this.waterMat)
    this.water.rotation.x = -Math.PI / 2
    this.water.position.y = WATER_Y
    this.water.renderOrder = 1
    scene.add(this.water)

    const rand = rng(palette.water.length * 97 + palette.sky.charCodeAt(1) * 13)
    this.ridges(rand)
    this.cloudBank(rand)
  }

  // ---------------------------------------------------------------- sky, clouds, ridges

  private sky(): void {
    const p = this.palette
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          top: { value: new THREE.Color(p.sky) },
          bottom: { value: new THREE.Color(p.horizon) },
          sunDir: { value: new THREE.Vector3(0.55, 0.32, 0.42).normalize() },
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
        fragmentShader: `
          uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vP;
          void main(){
            float h = clamp(vP.y, -0.2, 1.0);
            vec3 c = mix(bottom, top, smoothstep(0.0, 0.62, h));
            // Warm haze band just above the horizon, like aged silk.
            c = mix(c, vec3(1.0, 0.95, 0.84), (1.0 - smoothstep(0.0, 0.16, abs(h - 0.03))) * 0.35);
            float s = max(dot(normalize(vP), sunDir), 0.0);
            c += vec3(1.0, 0.86, 0.6) * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 1.2);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    )
    sky.renderOrder = -10
    sky.frustumCulled = false
    this.scene.add(sky)
  }

  /** Three misty layers of blue-green peaks; nearer layers are darker and more saturated. */
  private ridges(rand: () => number): void {
    const fog = new THREE.Color(this.palette.fog)
    const layers = [
      { r: 260, h: 34, col: '#9fbdb5', seed: 3 },
      { r: 205, h: 26, col: '#6f9f93', seed: 7 },
      { r: 160, h: 16, col: '#4f8578', seed: 11 },
    ]
    for (const L of layers) {
      const seg = 220
      const pos: number[] = []
      const col: number[] = []
      const base = new THREE.Color(L.col)
      const offset = rand() * 10
      for (let i = 0; i <= seg; i += 1) {
        const a = (i / seg) * Math.PI * 2
        // Sharp peaks: |noise| ridges plus a slow swell, so the skyline reads as a painted range.
        const n = ringNoise(a, L.seed + offset, 5, 4)
        const peak = Math.pow(1 - Math.abs(ringNoise(a, L.seed + 1 + offset, 9, 3)), 3)
        const hgt = Math.max(2, L.h * (0.35 + 0.5 * (n * 0.5 + 0.5) + 0.55 * peak))
        const x = Math.cos(a) * L.r
        const z = Math.sin(a) * L.r
        pos.push(x, WATER_Y - 1, z, x, WATER_Y + hgt, z)
        const low = base.clone().lerp(fog, 0.75)
        const high = base.clone().offsetHSL(0, 0.02, 0.04)
        col.push(low.r, low.g, low.b, high.r, high.g, high.b)
      }
      const idx: number[] = []
      for (let i = 0; i < seg; i += 1) {
        const a = i * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      geo.setIndex(idx)
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }))
      m.renderOrder = -5
      m.frustumCulled = false
      this.scene.add(m)
    }
  }

  private cloudTexture(seed: number): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const ctx = c.getContext('2d')!
    const r = rng(seed)
    for (let i = 0; i < 26; i += 1) {
      const x = 40 + r() * 176
      const y = 60 + (r() - 0.5) * 34 - Math.sin(((x - 40) / 176) * Math.PI) * 18
      const rad = 16 + r() * 26
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, 'rgba(255,253,246,0.95)')
      g.addColorStop(0.6, 'rgba(250,246,236,0.55)')
      g.addColorStop(1, 'rgba(250,246,236,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  private cloudBank(rand: () => number): void {
    const textures = [this.cloudTexture(1), this.cloudTexture(2), this.cloudTexture(3)]
    for (let i = 0; i < 16; i += 1) {
      const mat = new THREE.SpriteMaterial({ map: textures[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.85 })
      const s = new THREE.Sprite(mat)
      const a = rand() * Math.PI * 2
      const r = 120 + rand() * 110
      const w = 40 + rand() * 50
      s.scale.set(w, w * 0.42, 1)
      s.position.set(Math.cos(a) * r, 22 + rand() * 40, Math.sin(a) * r)
      s.renderOrder = -4
      this.clouds.push(s)
      this.scene.add(s)
    }
  }

  // ---------------------------------------------------------------- sea

  private makeWater(): THREE.ShaderMaterial {
    const p = this.palette
    return new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          time: { value: 0 },
          deep: { value: new THREE.Color(p.water).multiplyScalar(0.78) },
          shallow: { value: new THREE.Color(p.water).lerp(new THREE.Color('#9fe0cf'), 0.55) },
          sky: { value: new THREE.Color(p.horizon) },
          sunDir: { value: new THREE.Vector3(0.55, 0.32, 0.42).normalize() },
          depthMap: { value: new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1) as THREE.Texture },
          depthBox: { value: new THREE.Vector4(0, 0, 1, 0) },
        },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vW = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 sky; uniform vec3 sunDir;
        uniform sampler2D depthMap; uniform vec4 depthBox; varying vec3 vW;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        void main(){
          // Water depth from the baked island height map (0 outside it = deep sea).
          vec2 uv = (vW.xz - depthBox.xy) / depthBox.z + 0.5;
          float ground = -6.0;
          if (depthBox.w > 0.5 && all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) ground = texture2D(depthMap, uv).r * 12.0 - 8.0;
          float depth = max(vW.y - ground, 0.0);
          float shore = 1.0 - smoothstep(0.0, 1.6, depth);
          // Gentle wave normal from two scrolling noise layers.
          vec2 q = vW.xz * 0.18;
          float n1 = vn(q + vec2(time * 0.12, time * 0.07));
          float n2 = vn(q * 2.3 - vec2(time * 0.09, -time * 0.11));
          vec3 nrm = normalize(vec3((n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.3, 1.0, (n2 - 0.5) * 0.5));
          vec3 view = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(view, nrm), 0.0), 3.0);
          vec3 col = mix(deep, shallow, smoothstep(2.6, 0.2, depth));
          col = mix(col, sky, fres * 0.35);
          // Painted ripple strokes on open water.
          float w = sin(vW.x * 0.33 + sin(vW.z * 0.21 + time * 0.6) * 1.6 + time * 0.8) * sin(vW.z * 0.29 - time * 0.5);
          col = mix(col, vec3(0.93, 0.97, 0.95), smoothstep(0.965, 0.995, w) * 0.12 * (1.0 - shore));
          // Lapping foam lines that travel up the beach.
          float band = fract(depth * 1.6 - time * 0.35 + vn(vW.xz * 0.6) * 0.6);
          float foam = smoothstep(0.75, 0.95, band) * smoothstep(1.3, 0.2, depth) + smoothstep(0.18, 0.0, depth);
          col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
          // Sun glints.
          vec3 hv = normalize(sunDir + view);
          col += vec3(1.0, 0.92, 0.75) * pow(max(dot(nrm, hv), 0.0), 220.0) * 1.4;
          float alpha = mix(0.96, 0.55, shore);
          alpha = max(alpha, clamp(foam, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
    })
  }

  /** Bake ground heights around an island into the water's depth map (for shallows and foam). */
  private bakeDepth(island: Island, radius: number): void {
    const N = 256
    const size = radius * 2 * 1.45
    const data = new Uint8Array(N * N * 4)
    for (let j = 0; j < N; j += 1) {
      for (let i = 0; i < N; i += 1) {
        const x = island.cx + (i / (N - 1) - 0.5) * size
        const z = island.cz + (j / (N - 1) - 0.5) * size
        const h = this.groundHeight(x, z)
        const v = Math.round(THREE.MathUtils.clamp((h + 8) / 12, 0, 1) * 255)
        data.set([v, v, v, 255], (j * N + i) * 4)
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    this.waterMat.uniforms.depthMap.value = tex
    this.waterMat.uniforms.depthBox.value.set(island.cx, island.cz, size, 1)
  }

  // ---------------------------------------------------------------- land

  /**
   * Sculpt the chapter's island: terrain mesh, exact trimesh collider, an invisible fence just
   * inside the waterline, meadow grass and flowers, and the water depth map.
   */
  terrain(radius: number, opts: TerrainOpts = {}): Island {
    const p = this.palette
    const grass = new THREE.Color(p.grass)
    const island = new Island({
      radius,
      seed: opts.seed ?? 1,
      ...opts,
      colors: {
        grass: p.grass,
        grass2: grass.clone().offsetHSL(0.03, 0.04, 0.07).getStyle(),
        sand: p.sand,
        ...opts.colors,
      },
    })
    this.ground = island
    this.scene.add(island.mesh)
    const tm = island.trimesh()
    this.physics.addStaticTrimesh(tm.vertices, tm.indices)
    // Fence posts follow the irregular coast.
    const n = 64
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2
      const r = island.coast(a) * 0.9
      const x = island.cx + Math.cos(a) * r
      const z = island.cz + Math.sin(a) * r
      const len = ((Math.PI * 2 * r) / n) * 1.25
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
      this.physics.addStaticBox(new THREE.Vector3(x, island.heightAt(x, z) + 1.5, z), new THREE.Vector3(0.4, 4, len), q)
    }
    if (opts.foliage !== false) {
      const f = opts.foliage ?? {}
      plantMeadow(this.scene, island, radius, {
        density: (f.density ?? 1) * this.detail,
        grassBase: f.grassBase ?? grass.clone().multiplyScalar(0.82).getStyle(),
        grassTip: f.grassTip ?? grass.clone().offsetHSL(0.015, 0.04, 0.1).getStyle(),
        flowers: f.flowers ?? ['#f6f1e3', '#f2b6c6', '#f4d35e'],
        flowerRatio: f.flowerRatio,
        seed: f.seed ?? (opts.seed ?? 1) * 31,
        avoid: f.avoid,
      })
    }
    this.bakeDepth(island, radius)
    return island
  }

  /** Extra raised features (terraces) contribute to ground height for props and the water map. */
  private terraces: { x: number; z: number; r: number; top: number }[] = []

  groundHeight(x: number, z: number): number {
    let h = this.ground ? this.ground.heightAt(x, z) : 0
    for (const t of this.terraces) if (Math.hypot(x - t.x, z - t.z) <= t.r) h = Math.max(h, t.top)
    return h
  }

  /**
   * A stone-walled terrace (raised round platform) with a grass or paved top. The wall is built
   * from irregular stone courses so it reads as masonry; the top joins the grass colour.
   */
  island(x: number, z: number, radius: number, top = 0, opts: { fence?: boolean; sand?: boolean; paved?: boolean; wall?: string } = {}): number {
    const base = this.ground ? this.ground.heightAt(x, z) - 0.6 : -1
    const depth = top - base
    const seg = 48
    const wallGeo = new THREE.CylinderGeometry(radius, radius * 1.03, depth, seg, 4, true)
    const wc = new THREE.Color(opts.wall ?? '#b9ad97')
    const colors: number[] = []
    const pos = wallGeo.getAttribute('position')
    for (let i = 0; i < pos.count; i += 1) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i))
      const y = pos.getY(i)
      const course = Math.floor((y + depth) / 0.45)
      const n = fbm(a * 6 + course * 3.1, course * 0.7, 5, 2)
      const c = wc.clone().offsetHSL(0, 0, n * 0.09 - (y < -depth / 2 + 0.4 ? 0.12 : 0))
      colors.push(c.r, c.g, c.b)
    }
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }))
    wall.position.set(x, base + depth / 2, z)
    wall.castShadow = true
    wall.receiveShadow = true
    const topCol = opts.paved ? '#d8d0bf' : new THREE.Color(this.palette.grass).offsetHSL(0.02, 0, 0.03).getStyle()
    const cap = new THREE.Mesh(new THREE.CircleGeometry(radius, seg).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: topCol, roughness: 0.95 }))
    cap.position.set(x, top + 0.005, z)
    cap.receiveShadow = true
    const coping = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.05, 0.12, 6, seg).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfc5b0', roughness: 0.9 }))
    coping.position.set(x, top + 0.02, z)
    coping.receiveShadow = true
    this.scene.add(wall, cap, coping)
    this.physics.addStaticCylinder(new THREE.Vector3(x, base + depth / 2, z), radius, depth)
    this.terraces.push({ x, z, r: radius, top })
    if (opts.fence) this.ring(x, z, radius - 0.3, top)
    return top
  }

  /** Invisible wall ring (keeps the player on a plateau). */
  ring(x: number, z: number, radius: number, base: number, gapAngle?: number, gapWidth = 0): void {
    const n = 32
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2
      if (gapAngle !== undefined) {
        let d = Math.abs(a - gapAngle) % (Math.PI * 2)
        if (d > Math.PI) d = Math.PI * 2 - d
        if (d < gapWidth) continue
      }
      const len = ((Math.PI * 2 * radius) / n) * 1.15
      const c = new THREE.Vector3(x + Math.cos(a) * radius, base + 1.5, z + Math.sin(a) * radius)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
      this.physics.addStaticBox(c, new THREE.Vector3(0.4, 3, len), q)
    }
  }

  /** Visible box with a matching collider. */
  box(center: THREE.Vector3, size: THREE.Vector3, color: string, opts: { collide?: boolean; rotY?: number } = {}): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }))
    mesh.position.copy(center)
    mesh.rotation.y = opts.rotY ?? 0
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)
    if (opts.collide !== false) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), opts.rotY ?? 0)
      this.physics.addStaticBox(center, size, q)
    }
    return mesh
  }

  /**
   * Place a model (or a procedural fallback). `y: 'ground'` sits it on the terrain. Optional
   * cylinder collider radius, or `solid: true` for an exact mesh collider (buildings you walk in).
   */
  async prop(key: ModelKey, x: number, y: number | 'ground', z: number, opts: { rotY?: number; scale?: number; collider?: number; solid?: boolean; fallback?: () => THREE.Object3D } = {}): Promise<THREE.Object3D | null> {
    const obj = (await instance(key)) ?? opts.fallback?.() ?? null
    if (!obj) return null
    const yy = y === 'ground' ? this.groundHeight(x, z) - 0.03 : y
    obj.position.set(x, yy, z)
    obj.rotation.y = opts.rotY ?? 0
    if (opts.scale) obj.scale.multiplyScalar(opts.scale)
    this.scene.add(obj)
    if (opts.solid) this.physics.addObjectTrimesh(obj)
    else if (opts.collider) this.physics.addStaticCylinder(new THREE.Vector3(x, yy + 1.5, z), opts.collider, 3)
    return obj
  }

  /** Scatter props on the meadow inside a ring, avoiding keep-out circles. */
  async scatter(cx: number, cz: number, rMin: number, rMax: number, count: number, keys: ModelKey[], seed: number, avoid: { x: number; z: number; r: number }[] = [], _y = 0, collide = false, scale: [number, number] = [0.8, 1.3]): Promise<void> {
    const rand = rng(seed)
    const jobs: Promise<unknown>[] = []
    const placed: { x: number; z: number }[] = []
    for (let tries = 0; placed.length < count && tries < count * 12; tries += 1) {
      const a = rand() * Math.PI * 2
      const r = rMin + Math.sqrt(rand()) * (rMax - rMin)
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (avoid.some(o => Math.hypot(o.x - x, o.z - z) < o.r)) continue
      if (this.ground && !this.ground.isMeadow(x, z) && this.ground.rel(x, z) > 0.86) continue
      if (this.ground && this.ground.pathWeight(x, z) > 0.02) continue
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 1.6)) continue
      const key = keys[Math.floor(rand() * keys.length)]
      const s = scale[0] + rand() * (scale[1] - scale[0])
      jobs.push(this.prop(key, x, 'ground', z, { rotY: rand() * Math.PI * 2, scale: s, collider: collide ? 0.45 : undefined }))
      placed.push({ x, z })
    }
    await Promise.all(jobs)
  }

  /** Register an object that slowly spins. */
  spin(obj: THREE.Object3D, speed = 1): void {
    this.spinners.push({ obj, speed })
  }

  /** Register an object that gently bobs (boats on the swell, lanterns). */
  bob(obj: THREE.Object3D, amp = 0.08, speed = 1.2): void {
    this.bobbers.push({ obj, base: obj.position.y, amp, speed, phase: obj.position.x * 0.7 + obj.position.z * 0.3 })
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt
    updateWind(this.time)
    this.waterMat.uniforms.time.value = this.time
    this.water.position.x = focus.x
    this.water.position.z = focus.z
    this.sun.position.set(focus.x + 32, 46, focus.z + 26)
    this.sun.target.position.copy(focus)
    for (const s of this.spinners) s.obj.rotation.y += dt * s.speed
    for (const b of this.bobbers) {
      b.obj.position.y = b.base + Math.sin(this.time * b.speed + b.phase) * b.amp
      b.obj.rotation.z = Math.sin(this.time * b.speed * 0.8 + b.phase) * b.amp * 0.25
    }
    for (const [i, c] of this.clouds.entries()) {
      const a = Math.atan2(c.position.z, c.position.x) + dt * 0.004 * (1 + (i % 3) * 0.3)
      const r = Math.hypot(c.position.x, c.position.z)
      c.position.x = Math.cos(a) * r
      c.position.z = Math.sin(a) * r
    }
  }
}

/** Paper-cut style villager: robe cone, round head, hat. Used for minor roles and fallbacks. */
export function villager(robe: string, opts: { hat?: string; height?: number; skin?: string; hatShape?: 'cap' | 'tall' | 'straw' | 'bun' } = {}): THREE.Group {
  const g = new THREE.Group()
  const h = opts.height ?? 1.6
  const k = h / 1.6
  const robeMat = new THREE.MeshLambertMaterial({ color: robe })
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin ?? '#f0d2b4' })
  const hatMat = new THREE.MeshLambertMaterial({ color: opts.hat ?? '#2a2622' })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * k, 0.42 * k, 1.0 * k, 10), robeMat)
  body.position.y = 0.5 * k
  const sleeves = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * k, 0.16 * k, 0.75 * k, 8), robeMat)
  sleeves.rotation.z = Math.PI / 2
  sleeves.position.y = 0.82 * k
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26 * k, 16, 12), skin)
  head.position.y = 1.26 * k
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#2a2622' })
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03 * k, 6, 4), eyeMat)
    eye.position.set(0.09 * s * k, 1.29 * k, -0.235 * k)
    g.add(eye)
  }
  g.add(body, sleeves, head)
  const shape = opts.hatShape ?? 'cap'
  let hat: THREE.Mesh
  if (shape === 'straw') hat = new THREE.Mesh(new THREE.ConeGeometry(0.5 * k, 0.28 * k, 14), hatMat)
  else if (shape === 'tall') hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * k, 0.24 * k, 0.42 * k, 12), hatMat)
  else if (shape === 'bun') hat = new THREE.Mesh(new THREE.SphereGeometry(0.14 * k, 10, 8), hatMat)
  else hat = new THREE.Mesh(new THREE.SphereGeometry(0.27 * k, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat)
  hat.position.y = shape === 'tall' ? 1.6 * k : shape === 'straw' ? 1.5 * k : shape === 'bun' ? 1.52 * k : 1.3 * k
  g.add(hat)
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true })
  return g
}

/** The mirror flower collectible: a bronze mirror with a six-petal gold flower, glowing. */
export function mirrorFlower(): THREE.Group {
  const g = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a045', emissive: '#c9a045', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.35 })
  const glass = new THREE.MeshStandardMaterial({ color: '#dff3f0', emissive: '#bfe9e3', emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 })
  const red = new THREE.MeshStandardMaterial({ color: '#c8412f', emissive: '#c8412f', emissiveIntensity: 0.5 })
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 36), gold)
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.4, 36), glass)
  const back = face.clone()
  back.rotation.y = Math.PI
  g.add(rim, face, back)
  for (let i = 0; i < 6; i += 1) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), red)
    const a = (i / 6) * Math.PI * 2
    petal.scale.set(1, 0.5, 0.25)
    petal.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.03)
    petal.rotation.z = a
    g.add(petal)
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold)
  heart.position.z = 0.05
  g.add(heart)
  const light = new THREE.PointLight('#ffd98a', 6, 6, 1.6)
  g.add(light)
  return g
}

/** Floating vermilion diamond that marks the current objective. */
export function objectiveMarker(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: '#c8412f', transparent: true, opacity: 0.9, depthTest: false }),
  )
  m.scale.set(1, 1.6, 1)
  m.renderOrder = 10
  return m
}

/** Paper lantern (procedural). */
export function lantern(color = '#c8412f'): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 }))
  body.scale.y = 1.25
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10), new THREE.MeshLambertMaterial({ color: '#c9a045' }))
  cap.position.y = 0.42
  const cap2 = cap.clone()
  cap2.position.y = -0.42
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.3, 6), new THREE.MeshLambertMaterial({ color: '#c9a045' }))
  tassel.position.y = -0.62
  g.add(body, cap, cap2, tassel)
  return g
}

/** Procedural memorial archway, used when the generated model is unavailable. */
export function paifangFallback(): THREE.Group {
  // 三间四柱三楼: four pillars on stone drums, a tall centre bay and two lower side bays,
  // each capped by a hipped tile roof with flared eaves.
  const g = new THREE.Group()
  const red = new THREE.MeshLambertMaterial({ color: '#b2392b' })
  const tile = new THREE.MeshLambertMaterial({ color: '#2f4f4a', flatShading: true })
  const stone = new THREE.MeshLambertMaterial({ color: '#cfc4ad' })
  const gold = new THREE.MeshLambertMaterial({ color: '#c9a045' })
  const add = (m: THREE.Mesh, x: number, y: number, z = 0) => { m.position.set(x, y, z); g.add(m); return m }
  for (const [x, h] of [[-2.7, 3.3], [-1.05, 4.3], [1.05, 4.3], [2.7, 3.3]] as const) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, h, 10), red), x, h / 2)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.75), stone), x, 0.25)
  }
  const roof = (w: number, y: number, x: number) => {
    // Flattened four-sided cone = hipped roof; a thin slab underneath reads as the flared eave.
    const r = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4, 1), tile)
    r.rotation.y = Math.PI / 4
    r.scale.set(w * 0.72, 0.55, 1.05)
    add(r, x, y + 0.3)
    add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.1, 1.4), tile), x, y)
    add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.16, 0.16), tile), x, y + 0.58)
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 0.32), red), 0, 3.55)
  add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 0.32), red), 0, 2.75)
  add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.3), red), -1.88, 2.7)
  add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.3), red), 1.88, 2.7)
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.1), gold), 0, 3.15, 0.2)
  roof(2.9, 4.35, 0)
  roof(1.9, 3.35, -1.88)
  roof(1.9, 3.35, 1.88)
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true })
  return g
}

/** Procedural pavilion, used when the generated model is unavailable. */
export function pavilionFallback(): THREE.Group {
  const g = new THREE.Group()
  const red = new THREE.MeshLambertMaterial({ color: '#b2392b' })
  const roof = new THREE.MeshLambertMaterial({ color: '#34525e', flatShading: true })
  const stone = new THREE.MeshLambertMaterial({ color: '#cfc4ad' })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.4, 6), stone)
  base.position.y = 0.2
  g.add(base)
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 8), red)
    p.position.set(Math.cos(a) * 2.2, 1.8, Math.sin(a) * 2.2)
    g.add(p)
  }
  const r = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 6), roof)
  r.position.y = 3.9
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshLambertMaterial({ color: '#c9a045' }))
  tip.position.y = 4.8
  g.add(r, tip)
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true })
  return g
}

/** Make a canvas texture with large vertical/horizontal calligraphy (signs, plaques). */
export function textTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; vertical?: boolean; size?: number } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 256
  const h = opts.h ?? 128
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = opts.bg ?? '#c9a045'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = opts.fg ?? '#2a2622'
  ctx.font = `${opts.size ?? 54}px "ManusCC0 Sans CJK SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (opts.vertical) {
    const chars = [...text]
    const step = h / (chars.length + 0.5)
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, step * (i + 0.75)))
  } else ctx.fillText(text, w / 2, h / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
