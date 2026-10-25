import * as THREE from 'three'

/** Free scene-owned geometry and textures, never the GLB resources shared by the model cache. */
export function disposeScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse(o => {
    if (typeof o.userData.disposeCharacter === 'function') o.userData.disposeCharacter()
    const shared = o.userData.sharedModel === true
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
      if (!shared) geometries.add(o.geometry)
      if (!shared || o.userData.ownedMaterial === true) {
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(material)
          // A cloned material on a shared GLB still borrows the cached texture and geometry.
          if (!shared) {
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
            const uniforms = (material as THREE.ShaderMaterial).uniforms
            if (uniforms) for (const u of Object.values(uniforms)) if (u.value instanceof THREE.Texture) textures.add(u.value)
          }
        }
      }
    }
    if (o instanceof THREE.Light) (o as THREE.Light & { dispose?: () => void }).dispose?.()
  })
  textures.forEach(t => t.dispose())
  materials.forEach(m => m.dispose())
  geometries.forEach(g => g.dispose())
  root.clear()
}
