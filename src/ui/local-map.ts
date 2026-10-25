import { mapPercent, type Landmark, type NavigationSnapshot, type SceneMap } from '../game/navigation'
import type { ChapterId } from '../game/progress'
import { CHAPTERS } from '../game/story'

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export const distanceLabel = (distance: number): string => {
  if (!Number.isFinite(distance)) return '—'
  return distance < 10 ? `${Math.max(0, Math.round(distance * 10) / 10)} 步` : `${Math.round(distance)} 步`
}

type MapRole = 'mini' | 'local'

const PAINTED_MAPS = new Set(['hub', 'junzi', 'daren', 'wuchang', 'heichi', 'baimin', 'shushi', 'liangmian', 'qishe', 'nver', 'penglai'])
export const paintedMapArtwork = (id: string): string | null => PAINTED_MAPS.has(id) ? `./interface/map-${id}.webp` : null
export const miniMapArtwork = (id: string): string | null => PAINTED_MAPS.has(id) ? `./interface/mini-${id}.webp` : null

/**
 * Renders the chapter map from coordinates supplied by NavigationSnapshot. Terrain lines and
 * landmark controls only rebuild when the scene map changes; player/objective/tracking markers
 * are updated in place on every navigation tick.
 */
export class LocalMapRenderer {
  private snapshot: NavigationSnapshot | null = null
  private mini: HTMLElement | null = null
  private full: HTMLElement | null = null
  private miniMapId = ''
  private fullMapId = ''
  private miniIllustration: string | undefined
  private fullIllustration: string | undefined
  private selectedId: string | null = null
  private stateKey = ''

  mountMini(el: HTMLElement): void {
    this.mini = el
    if (this.snapshot) this.update(this.snapshot)
  }

  update(snapshot: NavigationSnapshot): void {
    const mapChanged = this.snapshot?.map.id !== snapshot.map.id
    this.snapshot = snapshot
    if (!this.selectedId || !snapshot.map.landmarks.some(mark => mark.id === this.selectedId)) {
      this.selectedId = snapshot.tracked?.id ?? snapshot.map.landmarks[0]?.id ?? null
    }
    if (this.mini && (mapChanged || this.miniMapId !== snapshot.map.id || this.miniIllustration !== snapshot.map.illustration)) this.renderMiniStatic()
    this.updateMiniDynamic()
    if (this.full) {
      if (mapChanged || this.fullMapId !== snapshot.map.id || this.fullIllustration !== snapshot.map.illustration) {
        this.stateKey = ''
        this.renderFullStatic()
      }
      this.updateFullDynamic()
    }
  }

  open(el: HTMLElement, snapshot: NavigationSnapshot): void {
    this.full = el
    this.snapshot = snapshot
    this.selectedId = snapshot.tracked?.id ?? snapshot.map.landmarks[0]?.id ?? null
    this.fullMapId = ''
    this.stateKey = ''
    this.renderFullStatic()
    this.updateFullDynamic()
  }

  close(): void {
    this.full = null
    this.fullMapId = ''
    this.fullIllustration = undefined
    this.stateKey = ''
  }

  select(id: string): void {
    if (!this.snapshot?.map.landmarks.some(mark => mark.id === id)) return
    this.selectedId = id
    this.renderFullDetail()
    this.updateFullDynamic()
  }

  selected(): Landmark | null {
    if (!this.snapshot || !this.selectedId) return null
    return this.snapshot.map.landmarks.find(mark => mark.id === this.selectedId) ?? null
  }

  private pointStyle(x: number, z: number): string {
    if (!this.snapshot) return ''
    const point = mapPercent({ x, z }, this.snapshot.map)
    return `left:${point.x.toFixed(3)}%;top:${point.y.toFixed(3)}%`
  }

  private aspectRatio(map: SceneMap): string {
    const width = map.bounds.maxX - map.bounds.minX
    const height = map.bounds.maxZ - map.bounds.minZ
    return width > 0 && height > 0 ? `${width} / ${height}` : '1'
  }

  private mapSvg(map: SceneMap, role: MapRole): string {
    const point = (p: { x: number; z: number }) => {
      const q = mapPercent(p, map)
      return `${q.x.toFixed(3)},${q.y.toFixed(3)}`
    }
    const coast = map.coast.length >= 3 ? `<polygon class="terrain-coast" points="${map.coast.map(point).join(' ')}"/>` : ''
    const paths = map.paths.map(path => `<polyline class="terrain-path" points="${path.map(point).join(' ')}"/>`).join('')
    const artwork = role === 'mini' ? miniMapArtwork(map.id) : paintedMapArtwork(map.id)
    const illustration = artwork
      ? `<image class="terrain-artwork" href="${artwork}" width="100" height="100" preserveAspectRatio="none"/>`
      : map.illustration
        ? `<image class="terrain-illustration" href="${esc(map.illustration)}" width="100" height="100" preserveAspectRatio="none"/>`
        : `<g class="terrain-fallback">
          <rect width="100" height="100" class="terrain-fallback-paper"/>
          <path class="terrain-fallback-wash" d="M-8 22C16 13 30 28 48 20s32-4 60-17v35C85 51 69 39 48 48S15 42-8 54z"/>
          <path class="terrain-fallback-contour" d="M-5 27C18 17 29 33 49 24s34-3 57-15M-5 35C16 25 31 40 50 31s32-2 57-14M-5 65C18 55 30 70 49 61s35-2 57-14M-5 73C18 63 30 78 49 69s35-2 57-14"/>
        </g>`
    return `<svg class="terrain-svg terrain-svg--${role}${artwork ? ' has-artwork' : map.illustration ? ' has-illustration' : ' is-fallback'}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="mapWater-${role}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cfe6dd"/><stop offset=".52" stop-color="#a9d1c7"/><stop offset="1" stop-color="#78b4b2"/></linearGradient>
        <linearGradient id="mapPaper-${role}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e5ead4"/><stop offset="1" stop-color="#b8d1ad"/></linearGradient>
      </defs>
      <rect width="100" height="100" class="terrain-water"/>
      ${illustration}
      ${coast}
      ${paths}
    </svg>`
  }

  private renderMiniStatic(): void {
    const snapshot = this.snapshot
    if (!snapshot || !this.mini) return
    this.mini.style.setProperty('--map-aspect', this.aspectRatio(snapshot.map))
    this.mini.classList.toggle('mini-map--hub', snapshot.map.id === 'hub')
    const marks = snapshot.map.landmarks
      .filter(mark => mark.kind === 'dock' || mark.kind === 'quest')
      .map(mark => `<i class="mini-landmark mini-landmark--${mark.kind}" style="${this.pointStyle(mark.x, mark.z)}"></i>`).join('')
    this.mini.innerHTML = `<div class="mini-map-field">${this.mapSvg(snapshot.map, 'mini')}
      <span class="map-north mini-north" aria-hidden="true">北</span>${marks}
      <i class="map-objective mini-objective" aria-hidden="true"></i>
      <i class="map-tracked mini-tracked" aria-hidden="true"></i>
      <i class="map-player mini-player" aria-label="你的位置"></i></div>
      <span class="mini-readout"><span>任务 <b data-mini-objective-distance>—</b></span><span>指引 <b data-mini-tracked-distance>—</b></span></span>`
    this.miniMapId = snapshot.map.id
    this.miniIllustration = snapshot.map.illustration
  }

  private updateMiniDynamic(): void {
    const snapshot = this.snapshot
    if (!snapshot || !this.mini) return
    const player = this.mini.querySelector<HTMLElement>('.mini-player')
    if (player) {
      player.style.cssText = `${this.pointStyle(snapshot.player.x, snapshot.player.z)};--yaw:${snapshot.player.yaw}rad`
    }
    const objective = this.mini.querySelector<HTMLElement>('.mini-objective')
    if (objective) {
      objective.classList.toggle('is-visible', !!snapshot.objective)
      if (snapshot.objective) objective.style.cssText = this.pointStyle(snapshot.objective.x, snapshot.objective.z)
    }
    const tracked = this.mini.querySelector<HTMLElement>('.mini-tracked')
    if (tracked) {
      tracked.classList.toggle('is-visible', !!snapshot.tracked)
      if (snapshot.tracked) tracked.style.cssText = this.pointStyle(snapshot.tracked.x, snapshot.tracked.z)
    }
    const objectiveDistance = this.mini.querySelector<HTMLElement>('[data-mini-objective-distance]')
    if (objectiveDistance) objectiveDistance.textContent = snapshot.objective ? distanceLabel(snapshot.objective.distance) : '—'
    const trackedDistance = this.mini.querySelector<HTMLElement>('[data-mini-tracked-distance]')
    if (trackedDistance) trackedDistance.textContent = snapshot.tracked ? distanceLabel(snapshot.tracked.distance) : '—'
  }

  private renderFullStatic(): void {
    const snapshot = this.snapshot
    if (!snapshot || !this.full) return
    const landmarkButtons = snapshot.map.landmarks.map(mark => {
      const visited = snapshot.visited.includes(mark.id)
      const selected = mark.id === this.selectedId
      return `<button class="local-mark local-mark--${mark.kind}" data-map-landmark="${esc(mark.id)}" style="${this.pointStyle(mark.x, mark.z)}" aria-pressed="${selected}" aria-label="${esc(mark.name)}${visited ? '，已到访' : '，未到访'}"><i></i><span>${esc(mark.name)}</span></button>`
    }).join('')
    this.full.innerHTML = `<div class="local-map-topline"><span class="map-north">北 ↑</span><span>${paintedMapArtwork(snapshot.map.id) ? '手绘山海舆图 · 实景坐标' : snapshot.map.illustration ? '实景俯视舆图' : '坐标舆图'}</span></div>
      <div class="local-map-legend" aria-label="图例"><span class="legend-player">你的位置</span><span class="legend-objective">当前任务</span><span class="legend-tracked">辅助指引</span><span class="legend-landmark">地标</span></div>
      <div class="local-map-layout">
        <section class="local-map-visual local-map-visual--${snapshot.map.id}" style="--map-aspect:${this.aspectRatio(snapshot.map)}" aria-label="${esc(snapshot.map.title)}">
          ${this.mapSvg(snapshot.map, 'local')}
          <i class="map-objective local-objective" aria-label="当前任务位置"></i>
          <i class="map-tracked local-tracked" aria-label="辅助指引位置"></i>
          <i class="map-player local-player" aria-label="你的位置"></i>
          ${landmarkButtons}
        </section>
        <aside class="local-map-detail" aria-live="polite"></aside>
      </div>
      ${snapshot.map.id === 'junzi' ? '<section class="local-map-journal" aria-label="君子国游记"><div class="journal-head"><h3>游记 · 五处见闻</h3><span>读牌或交谈后收录</span></div><div class="journal-list"></div></section>' : snapshot.map.id === 'hub' ? '<section class="local-map-journal"><div class="journal-head"><h3>甲板行路</h3></div><p>图桌可择港启航，同行人可交谈。此图只作甲板指引；君子国的五处见闻请在岛上查看。</p></section>' : `<section class="local-map-journal"><div class="journal-head"><h3>百花航海志</h3></div><p>${esc(CHAPTERS[snapshot.map.id as ChapterId].blurb)}</p></section>`}`
    this.fullMapId = snapshot.map.id
    this.fullIllustration = snapshot.map.illustration
    this.renderFullDetail()
  }

  private chapterState(snapshot: NavigationSnapshot): string {
    if (snapshot.map.id === 'hub') {
      return '<ul class="chapter-state"><li class="is-done"><i></i>图桌：选择已开放航线</li><li class="is-done"><i></i>同行人：靠近后交谈</li><li class="is-done"><i></i>北向坐标：对应实际甲板</li></ul>'
    }
    const state = snapshot.chapter
    const meta = CHAPTERS[snapshot.map.id as ChapterId]
    const items = [
      `<li class="${state.solved ? 'is-done' : ''}"><i></i>${meta.kind === 'flower' ? '本国主题' : '本章主线'}：${state.solved ? '已明了' : '尚在游历'}</li>`,
      ...(meta.kind === 'flower' ? [`<li class="${state.collected ? 'is-done' : ''}"><i></i>镜花：${state.collected ? '已收入囊中' : '尚未取得'}</li>`] : []),
      `<li class="${state.completed ? 'is-done' : ''}"><i></i>本章：${state.completed ? '已完成，可重游' : '尚未返航盖印'}</li>`,
    ]
    return `<ul class="chapter-state">${items.join('')}</ul>`
  }

  private renderFullDetail(): void {
    const snapshot = this.snapshot
    if (!snapshot || !this.full) return
    const detail = this.full.querySelector<HTMLElement>('.local-map-detail')
    if (!detail) return
    const selected = this.selected()
    const selectedVisited = !!selected && snapshot.visited.includes(selected.id)
    detail.innerHTML = `<p class="map-eyebrow">${esc(snapshot.map.title)}</p>
      <h3>${selected ? esc(selected.name) : '地标'}</h3>
      <p class="map-note">${selected ? (selectedVisited || snapshot.map.id === 'hub' ? esc(selected.note) : '尚未到访；到达此处后可收录见闻。') : '选择一处地标查看行路提示。'}</p>
      <p class="map-distance">${selected ? `距此 <b data-selected-distance>—</b>` : '—'}</p>
      <button class="btn small primary" data-action="local-guide" ${selected ? '' : 'disabled'}><span>设为指引</span></button>
      <p class="guide-note">设定后仅显示辅助方向，不会改变当前任务。</p>
      <div class="map-objective-card"><span>当前任务</span><b data-local-objective-text>暂无</b><em data-local-objective-distance>—</em><button class="btn small" data-action="local-objective" ${snapshot.objective ? '' : 'disabled'}><span>追踪当前任务</span></button></div>
      <h4>章内状态</h4><div data-local-state>${this.chapterState(snapshot)}</div>`
    for (const el of this.full.querySelectorAll<HTMLElement>('[data-map-landmark]')) {
      const selected = el.dataset.mapLandmark === this.selectedId
      el.classList.toggle('is-selected', selected)
      el.setAttribute('aria-pressed', String(selected))
    }
  }

  private renderJournal(): void {
    const snapshot = this.snapshot
    if (!snapshot || !this.full) return
    const list = this.full.querySelector<HTMLElement>('.journal-list')
    if (!list) return
    list.innerHTML = snapshot.map.landmarks.slice(0, 5).map((mark, index) => {
      const visited = snapshot.visited.includes(mark.id)
      return `<article class="journal-entry ${visited ? 'is-visited' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><div><h4>${esc(mark.name)}</h4><p>${visited ? esc(mark.note) : '未到访 · 到达此处后收录见闻。'}</p></div></article>`
    }).join('')
  }

  private updateFullDynamic(): void {
    const snapshot = this.snapshot
    if (!snapshot || !this.full) return
    const player = this.full.querySelector<HTMLElement>('.local-player')
    if (player) player.style.cssText = `${this.pointStyle(snapshot.player.x, snapshot.player.z)};--yaw:${snapshot.player.yaw}rad`
    const objective = this.full.querySelector<HTMLElement>('.local-objective')
    if (objective) {
      objective.classList.toggle('is-visible', !!snapshot.objective)
      if (snapshot.objective) objective.style.cssText = this.pointStyle(snapshot.objective.x, snapshot.objective.z)
    }
    const tracked = this.full.querySelector<HTMLElement>('.local-tracked')
    if (tracked) {
      tracked.classList.toggle('is-visible', !!snapshot.tracked)
      if (snapshot.tracked) tracked.style.cssText = this.pointStyle(snapshot.tracked.x, snapshot.tracked.z)
    }
    const selected = this.selected()
    const selectedDistance = this.full.querySelector<HTMLElement>('[data-selected-distance]')
    if (selectedDistance) {
      const distance = selected ? Math.hypot(snapshot.player.x - selected.x, snapshot.player.z - selected.z) : NaN
      selectedDistance.textContent = distanceLabel(distance)
    }
    const objectiveText = this.full.querySelector<HTMLElement>('[data-local-objective-text]')
    const objectiveDistance = this.full.querySelector<HTMLElement>('[data-local-objective-distance]')
    if (objectiveText) objectiveText.textContent = snapshot.objective?.text ?? '暂无当前任务'
    if (objectiveDistance) objectiveDistance.textContent = snapshot.objective ? `距 ${distanceLabel(snapshot.objective.distance)}` : '—'
    const key = `${snapshot.visited.join('|')}|${snapshot.chapter.solved}|${snapshot.chapter.collected}|${snapshot.chapter.completed}`
    if (key !== this.stateKey) {
      this.stateKey = key
      const state = this.full.querySelector<HTMLElement>('[data-local-state]')
      if (state) state.innerHTML = this.chapterState(snapshot)
      this.renderJournal()
      for (const mark of this.full.querySelectorAll<HTMLElement>('[data-map-landmark]')) {
        mark.classList.toggle('is-visited', snapshot.visited.includes(mark.dataset.mapLandmark ?? ''))
      }
      this.renderFullDetail()
    }
  }
}
