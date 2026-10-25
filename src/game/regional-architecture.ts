import * as THREE from 'three'

export type CrownStyle = 'book' | 'ingot' | 'scroll' | 'lotus'

const mat = (color: string, roughness = 0.75, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/**
 * Distinct roofline silhouettes for important landmarks. Decorations are visual only and are
 * deliberately added after building collision is baked, so they cannot block a doorway or path.
 */
export function addRegionalCrown(scene: THREE.Scene, landmark: THREE.Object3D, style: CrownStyle): void {
  const box = new THREE.Box3().setFromObject(landmark)
  const center = box.getCenter(new THREE.Vector3())
  const group = new THREE.Group()
  group.name = `Regional ${style} roof crown`
  group.position.set(center.x, box.max.y + 0.06, center.z)
  landmark.getWorldQuaternion(group.quaternion)
  const ivory = mat('#e9e2ca', 0.9)
  const blue = mat('#557781', 0.72)
  const gold = mat('#c7a45a', 0.38, 0.48)
  const teal = mat('#355b5c', 0.7)
  const pink = mat('#e8b6c1', 0.64)
  if (style === 'book') {
    for (const side of [-1, 1]) {
      const page = mesh(new THREE.BoxGeometry(0.64, 0.075, 0.48), ivory)
      page.position.set(side * 0.28, 0.22, 0)
      page.rotation.z = side * -0.28
      const cover = mesh(new THREE.BoxGeometry(0.68, 0.035, 0.52), blue)
      cover.position.set(side * 0.28, 0.16, 0)
      cover.rotation.z = page.rotation.z
      group.add(cover, page)
    }
  } else if (style === 'ingot') {
    const ring = mesh(new THREE.TorusGeometry(0.38, 0.09, 8, 28), gold)
    ring.rotation.x = Math.PI / 2
    ring.scale.z = 0.64
    ring.position.y = 0.19
    const centre = mesh(new THREE.BoxGeometry(0.48, 0.20, 0.32), gold)
    centre.position.y = 0.25
    group.add(ring, centre)
  } else if (style === 'scroll') {
    for (const side of [-1, 1]) {
      const roll = mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.46, 12), gold)
      roll.position.set(side * 0.48, 0.28, 0)
      const cap = mesh(new THREE.SphereGeometry(0.12, 10, 6), teal)
      cap.position.set(side * 0.48, 0.55, 0)
      group.add(roll, cap)
    }
    const diamond = mesh(new THREE.OctahedronGeometry(0.24, 0), teal)
    diamond.scale.set(1, 1.35, 0.55)
    diamond.position.y = 0.28
    group.add(diamond)
  } else {
    for (let i = 0; i < 9; i += 1) {
      const a = i / 9 * Math.PI * 2
      const petal = mesh(new THREE.SphereGeometry(0.19, 10, 6), i % 2 ? pink : ivory)
      petal.scale.set(0.65, 1.65, 0.48)
      petal.position.set(Math.cos(a) * 0.24, 0.28, Math.sin(a) * 0.24)
      petal.rotation.z = Math.cos(a) * 0.58
      petal.rotation.x = Math.sin(a) * 0.58
      group.add(petal)
    }
    const heart = mesh(new THREE.SphereGeometry(0.15, 12, 8), gold)
    heart.position.y = 0.30
    group.add(heart)
  }
  scene.add(group)
}

/** Paired hanging facade banners, positioned from the real model bounds. */
export function addRegionalBanners(scene: THREE.Scene, landmark: THREE.Object3D, color: string, trim: string): void {
  const box = new THREE.Box3().setFromObject(landmark)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const group = new THREE.Group()
  group.name = 'Regional facade banners'
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide })
  const edge = mat(trim, 0.48, 0.25)
  for (const side of [-1, 1]) {
    const x = center.x + side * size.x * 0.34
    const y = box.max.y - Math.min(1.25, size.y * 0.28)
    const z = box.max.z + 0.035
    const banner = mesh(new THREE.PlaneGeometry(Math.min(0.42, size.x * 0.055), 1.35), cloth)
    banner.position.set(x, y - 0.70, z)
    const rod = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.58, 8), edge)
    rod.rotation.z = Math.PI / 2
    rod.position.set(x, y, z)
    const seal = mesh(new THREE.OctahedronGeometry(0.10, 0), edge)
    seal.scale.z = 0.20
    seal.position.set(x, y - 0.63, z + 0.025)
    group.add(banner, rod, seal)
  }
  scene.add(group)
}

/** Liangmian's severe split-stone gate: no reused curved paifang roof. */
export function createLiangmianGate(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Liangmian split-stone gate'
  const stone = mat('#777568', 0.96)
  const pale = mat('#c7bda4', 0.92)
  const dark = mat('#373b39', 0.9)
  const red = mat('#6f302d', 0.76)
  for (const side of [-1, 1]) {
    const x = side * 2.2
    const base = mesh(new THREE.BoxGeometry(0.82, 0.42, 0.92), stone)
    base.position.set(x, 0.21, 0)
    const pillar = mesh(new THREE.BoxGeometry(0.54, 3.25, 0.62), side < 0 ? pale : dark)
    pillar.position.set(x, 1.96, 0)
    const cap = mesh(new THREE.BoxGeometry(0.86, 0.22, 0.90), stone)
    cap.position.set(x, 3.62, 0)
    const spike = mesh(new THREE.ConeGeometry(0.29, 0.70, 4), side < 0 ? pale : dark)
    spike.position.set(x, 4.04, 0)
    spike.rotation.y = Math.PI / 4
    group.add(base, pillar, cap, spike)
  }
  for (const [y, h, material] of [[3.08, 0.28, stone], [3.66, 0.24, dark]] as const) {
    const beam = mesh(new THREE.BoxGeometry(5.35, h, 0.58), material)
    beam.position.y = y
    group.add(beam)
  }
  for (const side of [-1, 1]) {
    const panel = mesh(new THREE.BoxGeometry(0.88, 0.72, 0.18), side < 0 ? pale : red)
    panel.position.set(side * 0.44, 3.36, 0.02)
    panel.rotation.z = side * 0.05
    group.add(panel)
  }
  return group
}
