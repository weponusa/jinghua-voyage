// Dev-only model viewer: /viewer.html?m=assets/source-models/props/junk_ship.glb
// Renders front (-Z camera looks at the model's +Z side), right, back and 3/4 views in a 2x2 grid.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const params = new URLSearchParams(location.search)
const url = '/' + (params.get('m') ?? '')
const W = 1200
const H = 900
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(W, H)
renderer.setScissorTest(true)
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#cfd8d4')
scene.add(new THREE.HemisphereLight('#ffffff', '#887766', 2))
const sun = new THREE.DirectionalLight('#fff', 2.5)
sun.position.set(3, 5, 4)
scene.add(sun)
const grid = new THREE.GridHelper(4, 8, '#666', '#999')
scene.add(grid)
const axis = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.01, 0), 1.2, '#d22')
scene.add(axis)

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
loader.load(url, gltf => {
  const m = gltf.scene
  const box = new THREE.Box3().setFromObject(m)
  const size = box.getSize(new THREE.Vector3())
  const s = 2 / Math.max(size.x, size.y, size.z)
  m.scale.setScalar(s)
  box.setFromObject(m)
  m.position.y -= box.min.y
  m.position.x -= (box.min.x + box.max.x) / 2
  m.position.z -= (box.min.z + box.max.z) / 2
  scene.add(m)
  const c = new THREE.Vector3(0, (box.max.y - box.min.y) / 2, 0)
  const views: [number, number, THREE.Vector3][] = [
    [0, 0, new THREE.Vector3(0, 0.6, 3.4)], // looking at +Z side (red arrow toward camera)
    [1, 0, new THREE.Vector3(3.4, 0.6, 0)],
    [0, 1, new THREE.Vector3(0, 0.6, -3.4)],
    [1, 1, new THREE.Vector3(2.4, 2.2, 2.4)],
  ]
  for (const [ix, iy, p] of views) {
    const cam = new THREE.PerspectiveCamera(35, W / 2 / (H / 2), 0.01, 50)
    cam.position.copy(p).add(c)
    cam.lookAt(c)
    renderer.setViewport(ix * W / 2, (1 - iy) * H / 2, W / 2, H / 2)
    renderer.setScissor(ix * W / 2, (1 - iy) * H / 2, W / 2, H / 2)
    renderer.render(scene, cam)
  }
  const info = document.createElement('pre')
  info.id = 'info'
  info.textContent = JSON.stringify({ size: size.toArray().map(v => +v.toFixed(3)) })
  document.body.appendChild(info)
  document.body.dataset.ready = '1'
}, undefined, e => { document.body.dataset.ready = 'err'; console.error(e) })
