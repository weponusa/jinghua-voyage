import * as THREE from 'three'
import type { SceneMap } from './navigation'

/** Exact north-up camera: image x maps to world x, image y maps to world z. */
export function mapCamera(map: SceneMap): THREE.OrthographicCamera {
  const b = map.bounds
  const width = b.maxX - b.minX, depth = b.maxZ - b.minZ
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0.1, 200)
  const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2
  camera.up.set(0, 0, -1)
  camera.position.set(x, 100, z)
  camera.lookAt(x, 0, z)
  camera.updateMatrixWorld(true)
  return camera
}

/**
 * Render existing terrain/buildings/vegetation once, without people or quest markers.
 * The generated image stays in memory; no asset generation service or network call is used.
 * Scene state is restored and only this renderer's resources are released.
 */
export function createMapIllustration(scene: THREE.Scene, map: SceneMap, hide: THREE.Object3D[]): string | undefined {
  let renderer: THREE.WebGLRenderer | undefined
  const fog = scene.fog, background = scene.background
  const visibility = hide.map(object => ({ object, visible: object.visible }))
  try {
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, preserveDrawingBuffer: true })
    const width = 1024
    const height = Math.round(width * (map.bounds.maxZ - map.bounds.minZ) / (map.bounds.maxX - map.bounds.minX))
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    renderer.shadowMap.enabled = false
    scene.fog = null
    scene.background = new THREE.Color('#a4c8c3')
    visibility.forEach(({ object }) => { object.visible = false })
    scene.updateMatrixWorld(true)
    renderer.render(scene, mapCamera(map))
    return renderer.domElement.toDataURL('image/png')
  } catch (error) {
    console.warn('地图底图未能渲染，使用坐标地图', error)
    return undefined
  } finally {
    visibility.forEach(({ object, visible }) => { object.visible = visible })
    scene.fog = fog
    scene.background = background
    renderer?.dispose()
    renderer?.forceContextLoss()
  }
}
