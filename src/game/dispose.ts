import * as THREE from 'three'

/** Free scene-owned geometry and textures, never the GLB resources shared by the model cache. */
export function disposeScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse(o => {
    if (typeof o.userData.disposeCharacter === 'function') o.userData.disposeCharacter()
    if (o.userData.sharedModel) return
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      geometries.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
        const uniforms = (material as THREE.ShaderMaterial).uniforms
        if (uniforms) for (const u of Object.values(uniforms)) if (u.value instanceof THREE.Texture) textures.add(u.value)
      }
    }
    if (o instanceof THREE.Light) (o as THREE.Light & { dispose?: () => void }).dispose?.()
  })
  textures.forEach(t => t.dispose())
  materials.forEach(m => m.dispose())
  geometries.forEach(g => g.dispose())
  root.clear()
}
