import * as THREE from 'three'
import type { Audio, Sfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { Physics } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import type { Quality, SaveStore } from '../engine/save'
import { FollowCamera } from './camera'
import type { Ctx, Interactable, Line, SceneDef } from './chapter'
import { hub } from './chapters/hub'
import { junzi } from './chapters/junzi'
import { instance, preload, setModelStyle } from './models'
import { disposeScene } from './dispose'
import { createMapIllustration } from './map-illustration'
import { JUNZI_MAP, distanceTo, type NavigationSnapshot, type SceneMap } from './navigation'
import { Npc, type NpcSpec } from './npc'
import { Player, type PlayerEvent } from './player'
import { completeChapter, isUnlocked, updateJunzi, type ChapterId } from './progress'
import { CHAPTERS } from './story'
import { mirrorFlower, objectiveMarker, Stage } from './stage'
import { WATER_Y } from './terrain'

/** Scenes built so far; later chapters live in drafts/ until they are finished. */
export const SCENES: Partial<Record<ChapterId | 'hub', SceneDef>> & { hub: SceneDef } = { hub, junzi }

export type Mode = 'title' | 'loading' | 'explore' | 'dialog' | 'menu' | 'paused'

/** What the voyage needs from the DOM UI. */
export interface VoyageUi {
  dialog(lines: Line[]): Promise<void>
  choose(who: string, text: string, options: string[]): Promise<number>
  objective(text: string): void
  prompt(p: { verb: string; name: string } | null): void
  toast(text: string): void
  flowers(n: number, flash?: boolean): void
  veil(on: boolean, label?: string, progress?: number): Promise<void>
  seal(id: ChapterId, firstTime: boolean): Promise<void>
  ending(): Promise<void>
  chart(): Promise<ChapterId | null>
  place(label: string): void
  navigation(snapshot: NavigationSnapshot): void
  localMap(): Promise<string | null>
}

type Active = {
  def: SceneDef
  stage: Stage
  physics: Physics
  player: Player
  cam: FollowCamera
  npcs: Npc[]
  things: Interactable[]
  updaters: ((dt: number, t: number) => void)[]
  flower: THREE.Object3D | null
  hasFlower: boolean
  target: THREE.Object3D | THREE.Vector3 | null
  marker: THREE.Mesh
  spawn: THREE.Vector3 | null
  ctx: Ctx
  map: SceneMap
  objectiveText: string
  trackedId: string | null
  guide: THREE.Mesh
}

export class Voyage {
  mode: Mode = 'title'
  reducedMotion = false
  private active?: Active
  private dialogDepth = 0
  private busy = false
  private time = 0
  private navigationTimer = 0
  private focus: Interactable | null = null
  private switching = false
  private styleChanging = false
  private styleRefreshPending = false
  /** Seconds during which interaction presses are ignored (after a dialogue closes). */
  private cooldown = 0

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio, private readonly save: SaveStore, private readonly ui: VoyageUi) {}

  get progress() {
    return this.save.data.progress
  }

  get sceneId(): ChapterId | 'hub' | null {
    return this.active?.def.id ?? null
  }

  setQuality(_q: Quality): void {
    this.renderer.applyQuality(_q)
  }

  async changeModelStyle(): Promise<void> {
    this.styleRefreshPending = true
    if (this.switching || this.styleChanging || !['title', 'paused', 'explore'].includes(this.mode)) return
    this.styleChanging = true
    try {
      do {
        this.styleRefreshPending = false
        setModelStyle(this.save.data.modelStyle)
        const previous = this.mode
        if (previous === 'title') {
          this.mode = 'loading'
          await this.backdrop()
          this.mode = 'title'
        } else {
          await this.enter(this.sceneId ?? 'hub', false)
          if (previous === 'paused') this.mode = 'paused'
        }
      } while (this.styleRefreshPending)
    } finally {
      this.styleChanging = false
    }
  }

  /** Load and enter a scene with a paper-coloured fade. */
  async enter(id: ChapterId | 'hub', intro = true): Promise<void> {
    if (this.switching) return
    if (id !== 'hub' && !isUnlocked(this.progress, id)) return
    this.switching = true
    const def = SCENES[id] ?? SCENES.hub
    const label = id === 'hub' ? '返回海船' : `扬帆前往 · ${CHAPTERS[id].name}`
    this.mode = 'loading'
    this.ui.prompt(null)
    this.focus = null
    try {
      setModelStyle(this.save.data.modelStyle)
      await this.ui.veil(true, label, 0)
      await preload(['tangao', ...def.models], p => void this.ui.veil(true, label, p))
      const next = await this.build(def)
      const old = this.active
      this.active = next
      this.ui.place(id === 'hub' ? '海船 · 甲板' : `${CHAPTERS[id].order === '终' ? '终章' : `第${CHAPTERS[id].order}章`} · ${CHAPTERS[id].name}`)
      this.ui.flowers(this.flowerTotal())
      this.updateNavigation(next)
      old?.physics.dispose()
      if (old) disposeScene(old.stage.scene)
      this.renderer.render(next.stage.scene, next.cam.camera)
      await this.ui.veil(false)
      this.mode = 'explore'
      if (intro && def.start) {
        await def.start(next.ctx)
        if (id === 'hub' && !this.progress.prologueSeen) this.save.update({ progress: { ...this.progress, prologueSeen: true } })
      }
    } catch (error) {
      console.warn('场景加载失败，可重新选择航线', error)
      await this.ui.veil(false)
      this.mode = this.active ? 'explore' : 'title'
      if (this.active) this.ui.objective(this.active.objectiveText)
      this.ui.toast('这一程未能载入，请从地图重试。进度已保留。')
    } finally {
      this.switching = false
      this.cooldown = 0.3
      this.input.endFrame()
      if (this.styleRefreshPending && !this.styleChanging) void this.changeModelStyle()
    }
  }

  private flowerTotal(): number {
    return this.progress.completed.filter(id => id !== 'penglai').length + (this.progress.junzi.flowerCollected && !this.progress.completed.includes('junzi') ? 1 : 0)
  }

  private async build(def: SceneDef): Promise<Active> {
    const physics = new Physics(-30)
    const stage = new Stage(physics, def.palette, this.renderer.shadowMapSize, this.renderer.shadowMapSize >= 2048 ? 1 : this.renderer.shadowMapSize >= 1024 ? 0.7 : 0.4)
    const player = new Player(physics, def.spawn.clone())
    const model = await instance('tangao')
    if (model) player.setModel(model)
    stage.scene.add(player.root, player.shadowMesh)
    const cam = new FollowCamera(physics, player.collider)
    const marker = objectiveMarker()
    stage.scene.add(marker)
    const guide = objectiveMarker()
    ;(guide.material as THREE.MeshBasicMaterial).color.set('#c9a045')
    guide.visible = false
    stage.scene.add(guide)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const voyage = this
    const a: Active = {
      def, stage, physics, player, cam, npcs: [], things: [], updaters: [], flower: null,
      hasFlower: def.id === 'junzi' && this.progress.junzi.flowerCollected, target: null, marker, spawn: null,
      guide, map: JUNZI_MAP, objectiveText: '', trackedId: null,
      ctx: undefined as unknown as Ctx,
    }
    a.ctx = {
      stage, scene: stage.scene, physics, player,
      get progress() { return voyage.progress },
      get hasFlower() { return a.hasFlower },
      updateJunzi: patch => { this.save.update({ progress: updateJunzi(this.progress, patch) }) },
      say: lines => this.say(lines),
      choose: (who, text, options) => this.choose(who, text, options),
      objective: (text, target) => {
        a.target = target ?? null
        a.objectiveText = text
        this.ui.objective(text)
      },
      toast: text => this.ui.toast(text),
      sfx: (name: Sfx) => this.audio.play(name),
      npc: async (spec: NpcSpec) => {
        const npc = await Npc.create({ ...spec, y: spec.y ?? stage.groundHeight(spec.x, spec.z) }, stage.scene, physics)
        a.npcs.push(npc)
        return npc
      },
      interact: spec => {
        a.things.push(spec)
        return spec
      },
      onUpdate: fn => void a.updaters.push(fn),
      spawnFlower: pos => {
        if (a.hasFlower || a.flower) return
        const f = mirrorFlower()
        f.position.copy(pos)
        stage.scene.add(f)
        a.flower = f
        this.audio.play('win')
      },
      finish: () => void this.finishChapter(def.id as ChapterId),
      leave: () => void this.enter('hub'),
      openChart: () => void this.openChart(),
      ending: () => this.ui.ending(),
      setSpawn: pos => void (a.spawn = pos.clone()),
    }
    try {
      await def.build(a.ctx)
      a.map = this.makeMap(a)
      if (def.id === 'junzi') a.map.illustration = createMapIllustration(stage.scene, a.map, [player.root, player.shadowMesh, marker, guide, ...a.npcs.map(npc => npc.root), ...(a.flower ? [a.flower] : [])])
      // Spawn on the ground (or wherever the chapter asked), never inside it.
      a.spawn ??= def.spawn.clone().setY(stage.groundHeight(def.spawn.x, def.spawn.z) + 0.9)
      player.teleport(a.spawn.clone())
      physics.step(1 / 60)
      cam.reset(player.root.position, def.yaw)
      return a
    } catch (error) {
      physics.dispose()
      disposeScene(stage.scene)
      throw error
    }
  }

  async openChart(): Promise<boolean> {
    if (this.switching || this.mode === 'menu' || this.mode === 'dialog' || this.mode === 'loading') return false
    const prev = this.mode
    this.mode = 'menu'
    this.ui.prompt(null)
    let pick: ChapterId | null = null
    try { pick = await this.ui.chart() } finally { this.mode = prev; this.input.endFrame(); this.cooldown = 0.3 }
    if (pick) await this.enter(pick)
    return pick !== null
  }

  async openLocalMap(): Promise<void> {
    const a = this.active
    if (!a || this.switching || this.busy || this.mode !== 'explore') return
    this.updateNavigation(a)
    this.mode = 'menu'
    this.ui.prompt(null)
    try {
      const pick = await this.ui.localMap()
      if (pick === '__objective__') a.trackedId = null
      else if (pick && a.map.landmarks.some(l => l.id === pick)) a.trackedId = pick
    } finally {
      this.mode = 'explore'
      this.input.endFrame()
      this.cooldown = 0.3
      this.updateNavigation(a)
    }
  }

  private makeMap(a: Active): SceneMap {
    if (a.def.id === 'junzi') {
      const g = a.stage.ground!
      const coast = Array.from({ length: 96 }, (_, i) => {
        const angle = i / 96 * Math.PI * 2, r = g.coast(angle)
        return { x: g.cx + Math.cos(angle) * r, z: g.cz + Math.sin(angle) * r }
      })
      const dock = a.things.find(t => t.verb === '登船')
      return { ...JUNZI_MAP, coast, landmarks: JUNZI_MAP.landmarks.map(l => l.id === 'dock' && dock ? { ...l, x: dock.pos.x, z: dock.pos.z } : { ...l }) }
    }
    const table = a.things.find(t => t.name === '航海图')?.pos ?? new THREE.Vector3(-1.2, 0, -1.2)
    return {
      id: 'hub', title: '海船 · 甲板舆图', bounds: { minX: -7, maxX: 7, minZ: -15, maxZ: 15 },
      coast: [{ x: -3.5, z: -11 }, { x: 0, z: -13 }, { x: 3.5, z: -11 }, { x: 3.5, z: 10 }, { x: 0, z: 13 }, { x: -3.5, z: 10 }],
      paths: [[{ x: 0, z: -9 }, { x: 0, z: 10 }]],
      landmarks: [
        { id: 'chart', name: '航海图', x: table.x, z: table.z, kind: 'quest', note: '到桌前展开航海图，前往君子国。' },
        ...a.npcs.map((n, i) => ({ id: `companion-${i}`, name: n.name, x: n.position.x, z: n.position.z, kind: 'story' as const, note: '走近同行人，听一段海外见闻。' })),
      ],
    }
  }

  private updateNavigation(a: Active): void {
    const p = a.player.root.position, target = a.target
    const pos = target instanceof THREE.Vector3 ? target : target?.getWorldPosition(new THREE.Vector3())
    const tracked = a.map.landmarks.find(l => l.id === a.trackedId)
    this.ui.navigation({
      map: a.map, player: { x: p.x, z: p.z, yaw: a.player.facing },
      objective: pos ? { x: pos.x, z: pos.z, text: a.objectiveText, distance: distanceTo(p, pos) } : null,
      tracked: tracked ? { ...tracked, distance: distanceTo(p, tracked) } : null,
      visited: a.def.id === 'junzi' ? this.progress.junzi.visited : [],
      chapter: { solved: this.progress.junzi.haggleSolved, collected: this.progress.junzi.flowerCollected, completed: this.progress.completed.includes('junzi') },
    })
  }

  private async finishChapter(id: ChapterId): Promise<void> {
    if (!this.active?.hasFlower || this.mode === 'menu') return
    const { progress, firstTime } = completeChapter(this.progress, id)
    this.save.update({ progress })
    this.mode = 'menu'
    this.ui.prompt(null)
    if (id !== 'penglai') {
      this.ui.flowers(this.flowerTotal(), firstTime)
      await this.ui.seal(id, firstTime)
    }
    this.mode = 'explore'
    await this.enter('hub')
  }

  async say(lines: Line[]): Promise<void> {
    if (!lines.length) return
    this.dialogDepth += 1
    this.mode = 'dialog'
    this.ui.prompt(null)
    const talkers = this.active?.npcs.filter(n => lines.some(l => l.who === n.name)) ?? []
    talkers.forEach(n => (n.talking = true))
    try {
      await this.ui.dialog(lines)
    } finally {
      talkers.forEach(n => (n.talking = false))
      this.endDialog()
    }
  }

  async choose(who: string, text: string, options: string[]): Promise<number> {
    this.dialogDepth += 1
    this.mode = 'dialog'
    this.ui.prompt(null)
    try {
      return await this.ui.choose(who, text, options)
    } finally {
      this.endDialog()
    }
  }

  private endDialog(): void {
    this.dialogDepth = Math.max(0, this.dialogDepth - 1)
    if (this.dialogDepth === 0 && this.mode === 'dialog') {
      this.mode = 'explore'
      // The key that closed the dialogue must not re-open it or make Tang Ao jump.
      this.input.endFrame()
      this.cooldown = 0.3
    }
  }

  pause(): void {
    if (this.mode === 'explore') this.mode = 'paused'
  }

  resume(): void {
    if (this.mode === 'paused') this.mode = 'explore'
  }

  toTitle(): void {
    this.mode = 'title'
  }

  /** Fixed-step simulation. */
  step(dt: number): void {
    const a = this.active
    if (!a || this.mode === 'paused' || this.mode === 'loading') return
    const exploring = this.mode === 'explore'
    a.player.frozen = !exploring
    const events: PlayerEvent[] = []
    a.player.step(dt, {
      moveX: this.input.move.x, moveY: this.input.move.y,
      sprint: this.input.held('sprint'),
      jumpPressed: exploring && this.input.consume('jump'),
      jumpHeld: this.input.held('jump'),
      dashPressed: false,
    }, a.cam.yaw, events)
    a.physics.step(dt)
    for (const e of events) if (e.type === 'jump') this.audio.play('jump')
    if (a.player.position.y < WATER_Y - 1.4) a.player.teleport((a.spawn ?? a.def.spawn).clone())

    if (!exploring) return
    this.cooldown = Math.max(0, this.cooldown - dt)
    const p = a.player.position
    // Walk into the mirror flower to collect it.
    if (a.flower && !a.hasFlower && a.flower.position.distanceTo(p) < 1.6) {
      a.hasFlower = true
      a.flower.removeFromParent()
      disposeScene(a.flower)
      a.flower = null
      if (a.def.id === 'junzi') a.ctx.updateJunzi({ flowerCollected: true })
      this.audio.play('pickup')
      this.ui.toast('镜花一枚，收入囊中。')
      this.ui.flowers(this.flowerTotal(), true)
      const dock = a.things.find(t => t.verb === '登船')
      a.ctx.objective('回到岸边的小舟，扬帆返航', dock?.pos ?? null)
    }
    this.focus = this.nearest(p)
    const pressed = this.input.consume('interact')
    if (this.focus && pressed && !this.busy && this.cooldown <= 0) {
      const it = this.focus
      this.busy = true
      this.audio.play('ui')
      Promise.resolve(it.run()).catch(err => console.error(err)).finally(() => { this.busy = false })
    }
  }

  private nearest(p: THREE.Vector3): Interactable | null {
    const a = this.active
    if (!a) return null
    let best: Interactable | null = null
    let bestD = Infinity
    for (const t of a.things) {
      const dx = t.pos.x - p.x
      const dz = t.pos.z - p.z
      const dy = Math.abs(t.pos.y - (p.y - 0.9))
      const d = Math.hypot(dx, dz)
      if (d > t.radius || dy > 2.5 || !t.enabled()) continue
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return best
  }

  /** Trigger the focused interaction from the touch button. */
  interactNow(): void {
    if (this.mode === 'explore' && this.focus && !this.busy && this.cooldown <= 0) {
      const it = this.focus
      this.busy = true
      this.audio.play('ui')
      Promise.resolve(it.run()).catch(err => console.error(err)).finally(() => { this.busy = false })
    }
  }

  render(alpha: number, frameSeconds: number): void {
    const a = this.active
    if (!a) return
    const dt = this.mode === 'paused' ? 0 : frameSeconds
    this.time += dt
    a.physics.sync(alpha)
    a.player.frozen = this.mode !== 'explore'
    a.player.animate(frameSeconds, this.time, false, a.player.grounded ? a.player.root.position.y - 0.92 : null)
    const p = a.player.root.position
    for (const n of a.npcs) n.update(dt, p)
    for (const u of a.updaters) u(dt, this.time)
    a.stage.update(dt, p)
    if (a.flower) {
      a.flower.rotation.y += dt * 1.6
      a.flower.position.y += Math.sin(this.time * 2.4) * 0.004
    }
    // Objective marker floats above the target.
    const t = a.target
    const tp = t ? (t instanceof THREE.Vector3 ? t : t.getWorldPosition(new THREE.Vector3())) : null
    a.marker.visible = !!tp && this.mode !== 'loading'
    if (tp) {
      const lift = t instanceof THREE.Vector3 ? 1.6 : 2.6
      a.marker.position.set(tp.x, tp.y + lift + Math.sin(this.time * 3) * 0.12, tp.z)
      a.marker.rotation.y += dt * 2
    }
    const tracked = a.map.landmarks.find(l => l.id === a.trackedId)
    a.guide.visible = !!tracked && this.mode !== 'loading'
    if (tracked) {
      a.guide.position.set(tracked.x, a.stage.groundHeight(tracked.x, tracked.z) + 2.2, tracked.z)
      a.guide.rotation.y += dt
    }
    this.navigationTimer += frameSeconds
    if (this.navigationTimer >= 0.12 && this.mode !== 'loading') { this.navigationTimer = 0; this.updateNavigation(a) }
    const look = this.mode === 'explore' || this.mode === 'dialog' ? this.input.takeLook() : (this.input.takeLook(), { x: 0, y: 0 })
    a.cam.update(p, look, frameSeconds, false, this.reducedMotion)
    if (this.mode === 'explore') {
      const f = this.focus
      this.ui.prompt(f ? { verb: typeof f.verb === 'function' ? f.verb() : f.verb, name: f.name } : null)
    }
    this.renderer.render(a.stage.scene, a.cam.camera)
    this.input.endFrame()
  }

  /** A scenic backdrop for the title screen: the ship deck with a slow orbit. */
  async backdrop(): Promise<void> {
    setModelStyle(this.save.data.modelStyle)
    await preload(['tangao', ...hub.models])
    const old = this.active
    this.active = await this.build(hub)
    old?.physics.dispose()
    if (old) disposeScene(old.stage.scene)
    this.ui.objective('')
  }

  orbitTitle(frameSeconds: number): void {
    const a = this.active
    if (!a) return
    a.cam.yaw += frameSeconds * 0.05
  }

  debug(): unknown {
    const a = this.active
    return a && { scene: a.def.id, pos: a.player.root.position.clone(), things: a.things.map(t => t.name), hasFlower: a.hasFlower, mode: this.mode, animation: a.player.animationInfo }
  }

  /** Test hook: teleport near an interactable and run it. */
  async debugInteract(name: string): Promise<boolean> {
    const a = this.active
    const it = a?.things.find(t => t.name === name && t.enabled())
    if (!a || !it) return false
    a.player.teleport(new THREE.Vector3(it.pos.x, it.pos.y + 1.2, it.pos.z + 1.2))
    await it.run()
    return true
  }

  debugTeleport(x: number, y: number, z: number): void {
    this.active?.player.teleport(new THREE.Vector3(x, y, z))
  }

  debugFlower(): THREE.Vector3 | null {
    return this.active?.flower?.position.clone() ?? null
  }
}
