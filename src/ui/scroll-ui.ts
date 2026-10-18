import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Quality, SaveData, SaveStore } from '../engine/save'
import type { Line } from '../game/chapter'
import { CHAPTER_ORDER, KINGDOMS, isCompleted, isPlayable, isUnlocked, nextChapter, type ChapterId } from '../game/progress'
import { CHAPTERS } from '../game/story'
import type { NavigationSnapshot } from '../game/navigation'
import type { VoyageUi } from '../game/voyage'
import { LocalMapRenderer } from './local-map'

export type Screen = 'boot' | 'title' | 'hud' | 'pause' | 'settings'

export type UiActions = {
  start(): void
  chartFromTitle(): void
  resume(): void
  pauseChart(): void
  quit(): void
  settings(patch: Partial<SaveData>): void
  resetProgress(): void
  interact(): void
  pause(): void
  /** Opens the in-scene island map; the voyage owns the explore/menu mode transition. */
  localMap(): void
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const FLOWER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="1.6"/><g fill="currentColor">' +
  [0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="12" cy="7.2" rx="2.1" ry="3.4" transform="rotate(${a} 12 12)"/>`).join('') + '</g><circle cx="12" cy="12" r="1.8" fill="#f3ead7"/></svg>'

const WAVE_MARK_SVG = '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M4 28c7-9 15-9 22 0s15 9 22 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 37c6-7 13-7 19 0s13 7 21 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M32 8c-4 5-4 9 0 13 4-4 4-8 0-13Z" fill="currentColor" opacity=".78"/></svg>'

/**
 * DOM game UI styled as a handscroll. Screens are HTML layered over the canvas; dialogue,
 * choices, the sea chart, seals and the ending are promise-based overlays the voyage awaits.
 */
export class Ui implements VoyageUi {
  screen: Screen = 'boot'
  private readonly root: HTMLElement
  private stack: Screen[] = []
  private dialogResolve: (() => void) | null = null
  private choiceResolve: ((i: number) => void) | null = null
  private overlayResolve: ((v: unknown) => void) | null = null
  private typing: { full: string; shown: number; el: HTMLElement } | null = null
  private toastTimer = 0
  private lastPrompt = ''
  private navigationSnapshot: NavigationSnapshot | null = null
  private readonly mapRenderer = new LocalMapRenderer()

  constructor(private readonly save: SaveStore, private readonly audio: Audio, private readonly input: Input, private readonly actions: UiActions) {
    this.root = document.getElementById('ui')!
    this.root.innerHTML = this.template()
    this.root.addEventListener('click', e => this.onClick(e))
    this.root.addEventListener('input', e => this.onInput(e))
    window.addEventListener('keydown', e => this.onKey(e))
    this.mapRenderer.mountMini(this.q('.mini-map'))
    this.refreshSettings()
  }

  // ─── screens ────────────────────────────────────────────────────────────
  show(screen: Screen): void {
    this.stack = []
    this.setScreen(screen)
  }

  push(screen: Screen): void {
    this.stack.push(this.screen)
    this.setScreen(screen)
  }

  back(): void {
    const prev = this.stack.pop()
    if (prev) this.setScreen(prev)
    else if (this.screen === 'pause') this.actions.resume()
  }

  private setScreen(screen: Screen): void {
    this.screen = screen
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-screen]')) {
      const s = el.dataset.screen
      const active = s === screen || (s === 'hud' && (screen === 'pause' || (screen === 'settings' && this.stack.includes('pause'))))
      el.classList.toggle('is-active', active)
      el.setAttribute('aria-hidden', String(!active))
    }
    this.root.dataset.activeScreen = screen
    if (screen === 'title') this.renderTitle()
  }

  setBootProgress(p: number): void {
    this.q<HTMLElement>('.boot-bar i').style.transform = `scaleX(${Math.max(0.04, Math.min(1, p))})`
  }

  private renderTitle(): void {
    const p = this.save.data.progress
    const started = p.prologueSeen || p.completed.length > 0
    this.q('[data-action="start"] span').textContent = started ? '继续航程' : '扬帆启程'
    this.q('.title-status').textContent = started
      ? `第一章 · 君子国 ${p.completed.includes('junzi') ? '已完成，可重游' : '已开放'} · 其余章节制作中`
      : '第一章 · 君子国已开放 · 进度自动保存'
  }

  // ─── HUD ────────────────────────────────────────────────────────────────
  objective(text: string): void {
    const el = this.q('.quest')
    el.classList.toggle('is-empty', !text)
    const t = this.q('.quest-text')
    if (t.textContent !== text) {
      t.textContent = text
      el.classList.remove('flash')
      void el.offsetWidth
      if (text) el.classList.add('flash')
    }
  }

  prompt(p: { verb: string; name: string } | null): void {
    const key = p ? `${p.verb}|${p.name}` : ''
    if (key === this.lastPrompt) return
    this.lastPrompt = key
    const el = this.q('.prompt')
    el.classList.toggle('is-active', !!p)
    document.body.classList.toggle('can-interact', !!p)
    if (p) {
      this.q('.prompt-verb').textContent = p.verb
      this.q('.prompt-name').textContent = p.name
      this.q('.touch-act b').textContent = p.verb
    }
  }

  toast(text: string): void {
    const el = this.q('.toast')
    el.textContent = text
    el.classList.add('is-active')
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => el.classList.remove('is-active'), 2600)
  }

  place(label: string): void {
    this.q('.place').textContent = label
  }

  flowers(n: number, flash = false): void {
    const el = this.q('.flowers')
    el.innerHTML = KINGDOMS.map((_, i) => `<i class="${i < n ? 'got' : ''}">${FLOWER_SVG}</i>`).join('') + `<b>${n}/6</b>`
    if (flash) {
      el.classList.remove('flash')
      void el.offsetWidth
      el.classList.add('flash')
    }
  }

  /** Receives compact world-navigation state on a throttled voyage tick. */
  navigation(snapshot: NavigationSnapshot): void {
    this.navigationSnapshot = snapshot
    this.mapRenderer.update(snapshot)
  }

  // ─── dialogue ───────────────────────────────────────────────────────────
  async dialog(lines: Line[]): Promise<void> {
    const box = this.q('.dialog')
    box.classList.add('is-active')
    this.q('.choices').innerHTML = ''
    for (const line of lines) {
      this.showLine(line)
      await new Promise<void>(r => (this.dialogResolve = r))
    }
    this.dialogResolve = null
    box.classList.remove('is-active')
  }

  private showLine(line: Line): void {
    const box = this.q('.dialog')
    box.classList.toggle('is-narration', !line.who)
    this.q('.dialog-who').textContent = line.who
    const text = this.q<HTMLElement>('.dialog-text')
    text.textContent = ''
    this.typing = { full: line.text, shown: 0, el: text }
    box.classList.remove('is-choice')
    if (this.save.data.reducedMotion) this.finishTyping()
  }

  private finishTyping(): void {
    if (!this.typing) return
    this.typing.el.textContent = this.typing.full
    this.typing = null
  }

  private advance(): void {
    if (this.typing) {
      this.finishTyping()
      return
    }
    if (this.dialogResolve) {
      this.audio.play('ui')
      this.dialogResolve()
    }
  }

  async choose(who: string, text: string, options: string[]): Promise<number> {
    const box = this.q('.dialog')
    box.classList.add('is-active', 'is-choice')
    box.classList.remove('is-narration')
    this.q('.dialog-who').textContent = who
    this.q('.dialog-text').textContent = text
    this.typing = null
    const list = this.q('.choices')
    list.innerHTML = options.map((o, i) => `<button class="choice" data-choice="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('')
    if (this.input.method !== 'touch') requestAnimationFrame(() => list.querySelector<HTMLElement>('.choice')?.focus({ preventScroll: true }))
    const pick = await new Promise<number>(r => (this.choiceResolve = r))
    this.choiceResolve = null
    list.innerHTML = ''
    box.classList.remove('is-active', 'is-choice')
    return pick
  }

  // ─── overlays: veil, chart, seal, ending ───────────────────────────────
  async veil(on: boolean, label = '', progress?: number): Promise<void> {
    const el = this.q('.veil')
    if (label) this.q('.veil-label').textContent = label
    if (progress !== undefined) this.q<HTMLElement>('.veil-bar i').style.transform = `scaleX(${Math.max(0.03, progress)})`
    if (el.classList.contains('is-active') === on) return
    el.classList.toggle('is-active', on)
    await new Promise(r => setTimeout(r, this.save.data.reducedMotion ? 60 : 520))
  }

  chart(): Promise<ChapterId | null> {
    if (this.overlayOpen) return Promise.resolve(null)
    const el = this.q('.chart')
    const p = this.save.data.progress
    let selected: ChapterId = nextChapter(p) ?? 'junzi'
    const ports = CHAPTER_ORDER.map(id => {
      const m = CHAPTERS[id]
      const state = isCompleted(p, id) ? 'done' : isUnlocked(p, id) ? 'open' : isPlayable(id) ? 'locked' : 'soon'
      return `<button class="port is-${state}" data-port="${id}" style="left:${m.chart.x}%;top:${m.chart.y}%" aria-label="${m.name}，${state === 'soon' ? '制作中，可查看介绍' : state === 'locked' ? '待解锁，可查看介绍' : state === 'done' ? '已完成，可重游' : '已开放'}">
        <i class="port-dot">${state === 'done' ? FLOWER_SVG : ''}</i><span class="port-name">${m.name}</span><small class="port-state">${state === 'done' ? '已完成' : state === 'open' ? '已开放' : state === 'soon' ? '制作中' : '待解锁'}</small></button>`
    }).join('')
    const route = CHAPTER_ORDER.map(id => `${CHAPTERS[id].chart.x},${CHAPTERS[id].chart.y}`).join(' ')
    this.q('.chart-sea').innerHTML = `<svg class="chart-route" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="8,86 ${route}" /></svg>${ports}`
    const detail = () => {
      const m = CHAPTERS[selected]
      const locked = !isUnlocked(p, selected)
      const playable = isPlayable(selected)
      const stateLabel = isCompleted(p, selected) ? '已完成 · 可重游' : playable && !locked ? '已开放 · 可启航' : playable ? '尚待解锁' : '制作中 · 可查看介绍'
      this.q('.chart-detail').innerHTML = `
        <div class="cd-order">${m.order === '终' ? '终章' : `第${m.order}章`} · ${stateLabel}</div>
        <h3>${m.name}<small>${m.tagline}</small></h3>
        <p>${m.blurb}</p>
        ${isCompleted(p, selected) ? `<p class="cd-moral">所悟：${m.moral}</p>` : ''}
        <p class="cd-build-note">${!playable ? '此国故事仍在制作，现可阅览介绍，暂不能启航。' : locked ? '完成前序章节后方可启航。' : '本作当前仅开放第一章。'}</p>
        <button class="btn primary" data-action="sail" ${locked || !playable ? 'disabled' : ''}><span>${!playable ? '暂不可启航 · 制作中' : locked ? '尚未解锁' : isCompleted(p, selected) ? '重游此国' : '扬帆启航'}</span></button>`
      for (const b of this.qa<HTMLElement>('.port')) b.classList.toggle('is-selected', b.dataset.port === selected)
    }
    detail()
    el.classList.add('is-active')
    return new Promise<ChapterId | null>(resolve => {
      this.overlayResolve = v => {
        if (v === 'select') return
        el.classList.remove('is-active')
        this.overlayResolve = null
        resolve((v as ChapterId | null) ?? null)
      }
      ;(el as HTMLElement & { _select?: (id: ChapterId) => void })._select = id => {
        selected = id
        this.audio.play('ui')
        detail()
      }
      ;(el as HTMLElement & { _sail?: () => void })._sail = () => {
        if (isUnlocked(p, selected)) this.overlayResolve?.(selected)
      }
    })
  }

  /** In-scene map: selecting a landmark only returns an optional visual guidance target. */
  localMap(): Promise<string | null> {
    if (this.overlayOpen) return Promise.resolve(null)
    const snapshot = this.navigationSnapshot
    if (!snapshot) {
      this.toast('舆图尚在绘制，请稍候。')
      return Promise.resolve(null)
    }
    const el = this.q('.local-map')
    this.q('.local-map header p').textContent = snapshot.map.id === 'hub' ? '海船 · 甲板' : '君子国 · 第一章'
    this.mapRenderer.open(this.q('.local-map-body'), snapshot)
    el.classList.add('is-active')
    this.root.classList.add('is-map-open')
    return new Promise(resolve => {
      this.overlayResolve = value => {
        el.classList.remove('is-active')
        this.root.classList.remove('is-map-open')
        this.mapRenderer.close()
        this.overlayResolve = null
        resolve(typeof value === 'string' ? value : null)
      }
    })
  }

  seal(id: ChapterId, firstTime: boolean): Promise<void> {
    const m = CHAPTERS[id]
    const el = this.q('.seal')
    this.q('.seal-body').innerHTML = `
      <div class="stamp"><span>${m.name.slice(0, 2)}</span><span>镜花</span></div>
      <h2>${firstTime ? '得镜花一枚' : '重游已毕'}</h2>
      <p class="seal-name">${m.name} · ${m.tagline}</p>
      <p class="seal-moral">「${m.moral}」</p>
      ${id === 'junzi' ? '<p class="seal-next">第一章已圆满 · 后续诸国制作中。可回到海船，随时重游。</p>' : firstTime && id !== 'heichi' ? `<p class="seal-next">新港口已在航海图上标出：${CHAPTERS[CHAPTER_ORDER[CHAPTER_ORDER.indexOf(id) + 1]].name}</p>` : ''}
      ${firstTime && id === 'heichi' ? '<p class="seal-next">六枚镜花已齐，海上仙山小蓬莱现于航海图。</p>' : ''}
      <button class="btn primary" data-action="overlay-ok"><span>返回海船</span></button>`
    el.classList.add('is-active')
    this.audio.play('win')
    return new Promise(resolve => {
      this.overlayResolve = () => {
        el.classList.remove('is-active')
        this.overlayResolve = null
        resolve()
      }
    })
  }

  ending(): Promise<void> {
    const el = this.q('.ending')
    this.q('.ending-list').innerHTML = KINGDOMS.map(id => `<li><b>${CHAPTERS[id].name}</b><span>${CHAPTERS[id].moral}</span></li>`).join('')
    el.classList.add('is-active')
    return new Promise(resolve => {
      this.overlayResolve = () => {
        el.classList.remove('is-active')
        this.overlayResolve = null
        resolve()
      }
    })
  }

  // ─── settings ───────────────────────────────────────────────────────────
  refreshSettings(): void {
    const d = this.save.data
    const modelStyle = (d as SaveData & { modelStyle?: 'detailed' | 'chibi' }).modelStyle ?? 'detailed'
    const set = (name: string, v: number) => {
      const el = this.root.querySelector<HTMLInputElement>(`input[name="${name}"]`)
      if (el) el.value = String(v)
    }
    set('music', Math.round(d.musicVolume * 100))
    set('sfx', Math.round(d.sfxVolume * 100))
    set('sens', Math.round(d.sensitivity * 100))
    for (const b of this.qa<HTMLElement>('[data-quality]')) b.classList.toggle('is-on', b.dataset.quality === d.quality)
    for (const b of this.qa<HTMLElement>('[data-model-style]')) b.classList.toggle('is-on', b.dataset.modelStyle === modelStyle)
    for (const [k, v] of [['muted', d.muted], ['invertY', d.invertY], ['reducedMotion', d.reducedMotion]] as const) {
      this.q(`[data-toggle="${k}"]`).classList.toggle('is-on', v)
    }
  }

  private onInput(e: Event): void {
    const t = e.target as HTMLInputElement
    const v = Number(t.value) / 100
    if (t.name === 'music') this.actions.settings({ musicVolume: v })
    if (t.name === 'sfx') this.actions.settings({ sfxVolume: v })
    if (t.name === 'sens') this.actions.settings({ sensitivity: Math.max(0.2, v) })
  }

  private onClick(e: Event): void {
    const t = e.target as HTMLElement
    const choice = t.closest<HTMLElement>('[data-choice]')
    if (choice && this.choiceResolve) {
      this.audio.play('ui')
      this.choiceResolve(Number(choice.dataset.choice))
      return
    }
    if (t.closest('.dialog') && !t.closest('.choices')) {
      this.advance()
      return
    }
    const port = t.closest<HTMLElement>('[data-port]')
    if (port) {
      ;(this.q('.chart') as HTMLElement & { _select?: (id: ChapterId) => void })._select?.(port.dataset.port as ChapterId)
      return
    }
    const q = t.closest<HTMLElement>('[data-quality]')
    if (q) {
      this.actions.settings({ quality: q.dataset.quality as Quality })
      this.refreshSettings()
      return
    }
    const modelStyle = t.closest<HTMLElement>('[data-model-style]')
    if (modelStyle) {
      const style = modelStyle.dataset.modelStyle as 'detailed' | 'chibi'
      if (style && style !== (this.save.data as SaveData & { modelStyle?: string }).modelStyle) {
        this.actions.settings({ modelStyle: style } as Partial<SaveData>)
        this.toast('角色风格已切换，将重新进入场景。')
      }
      this.refreshSettings()
      return
    }
    const mapLandmark = t.closest<HTMLElement>('[data-map-landmark]')
    if (mapLandmark) {
      this.audio.play('ui')
      this.mapRenderer.select(mapLandmark.dataset.mapLandmark ?? '')
      return
    }
    const tog = t.closest<HTMLElement>('[data-toggle]')
    if (tog) {
      const k = tog.dataset.toggle as 'muted' | 'invertY' | 'reducedMotion'
      this.actions.settings({ [k]: !this.save.data[k] } as Partial<SaveData>)
      this.refreshSettings()
      return
    }
    const action = t.closest<HTMLElement>('[data-action]')?.dataset.action
    if (!action) return
    this.audio.unlock()
    this.audio.play('ui')
    switch (action) {
      case 'start': this.actions.start(); break
      case 'chart-title': this.actions.chartFromTitle(); break
      case 'settings': this.push('settings'); break
      case 'back': this.back(); break
      case 'resume': this.actions.resume(); break
      case 'pause': this.actions.pause(); break
      case 'pause-chart': this.actions.pauseChart(); break
      case 'quit': this.actions.quit(); break
      case 'local-map': this.actions.localMap(); break
      case 'sail': (this.q('.chart') as HTMLElement & { _sail?: () => void })._sail?.(); break
      case 'chart-close': this.overlayResolve?.(null); break
      case 'local-close': this.overlayResolve?.(null); break
      case 'local-guide': {
        const id = this.mapRenderer.selected()?.id
        if (id) this.overlayResolve?.(id)
        break
      }
      case 'local-objective': this.overlayResolve?.('__objective__'); break
      case 'overlay-ok': this.overlayResolve?.(undefined); break
      case 'reset': {
        const btn = this.q('[data-action="reset"] span')
        if (btn.textContent === '确定清除？') {
          this.actions.resetProgress()
          btn.textContent = '已清除'
        } else btn.textContent = '确定清除？'
        break
      }
    }
  }

  private onKey(e: KeyboardEvent): void {
    const dialogOpen = this.q('.dialog').classList.contains('is-active')
    if (this.choiceResolve) {
      const n = Number(e.key)
      const count = this.qa('.choice').length
      if (n >= 1 && n <= count) {
        e.preventDefault()
        this.audio.play('ui')
        this.choiceResolve(n - 1)
        return
      }
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault()
        const items = this.qa<HTMLElement>('.choice')
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.code === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
      return
    }
    if (dialogOpen && ['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) {
      e.preventDefault()
      this.advance()
      return
    }
    if (e.code === 'KeyM') {
      const mapOpen = this.q('.local-map').classList.contains('is-active')
      if (mapOpen) {
        e.preventDefault()
        this.overlayResolve?.(null)
      } else if (this.screen === 'hud' && !this.overlayOpen) {
        e.preventDefault()
        this.actions.localMap()
      }
      return
    }
    if (this.overlayResolve && (e.code === 'Escape')) {
      e.preventDefault()
      this.input.consume('pause')
      if (this.q('.chart').classList.contains('is-active') || this.q('.local-map').classList.contains('is-active')) this.overlayResolve(null)
      return
    }
    if (this.overlayResolve && (e.code === 'Enter' || e.code === 'Space')) {
      if (this.q('.chart').classList.contains('is-active')) {
        if (!(document.activeElement as HTMLElement)?.closest?.('.chart')) (this.q('.chart') as HTMLElement & { _sail?: () => void })._sail?.()
      } else if (this.q('.local-map').classList.contains('is-active')) {
        return
      } else {
        e.preventDefault()
        this.overlayResolve(undefined)
      }
      return
    }
    if ((e.code === 'Escape' || e.code === 'Backspace') && this.screen === 'settings') {
      e.preventDefault()
      this.input.consume('pause')
      this.back()
    }
  }

  /** Per-frame UI work: typewriter. */
  frame(frameSeconds: number): void {
    if (this.typing) {
      this.typing.shown = Math.min(this.typing.full.length, this.typing.shown + frameSeconds * 38)
      this.typing.el.textContent = this.typing.full.slice(0, Math.floor(this.typing.shown))
      if (this.typing.shown >= this.typing.full.length) this.typing = null
    }
    const touch = this.input.method === 'touch'
    document.body.classList.toggle('is-touch', touch)
  }

  get overlayOpen(): boolean {
    return this.overlayResolve !== null || this.dialogResolve !== null || this.choiceResolve !== null
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.root.querySelector<T>(sel)!
  }

  private qa<T extends HTMLElement = HTMLElement>(sel: string): T[] {
    return [...this.root.querySelectorAll<T>(sel)]
  }

  private template(): string {
    return `
<section class="screen boot" data-screen="boot">
  <div class="wave-mark">${WAVE_MARK_SVG}</div>
  <p class="boot-title">海上拾花记</p>
  <div class="boot-bar"><i></i></div>
  <p class="boot-tip">展卷中……</p>
</section>

<section class="screen title" data-screen="title">
  <div class="title-col">
    <h1 class="logo-text">海上拾花记</h1>
    <div class="title-seal">《镜花缘》海外奇游</div>
  </div>
  <div class="title-menu">
    <p class="tagline">随唐敖初访君子国，听市井让利，记海岛见闻。<br/>本作目前仅开放第一章；其余国家仍在制作中。</p>
    <button class="btn primary" data-action="start"><span>扬帆启程</span></button>
    <button class="btn" data-action="chart-title"><span>航海图 · 选章</span></button>
    <button class="btn" data-action="settings"><span>设置</span></button>
    <p class="title-status"></p>
    <p class="title-credit">取材自清·李汝珍《镜花缘》</p>
  </div>
</section>

<section class="screen hud" data-screen="hud">
  <div class="hud-top">
    <div class="hud-left"><div class="place"></div><div class="flowers"></div></div>
    <div class="hud-right">
      <button class="icon-btn" data-action="pause-chart" aria-label="航海图"><svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.8"/></svg></button>
      <button class="icon-btn" data-action="pause" aria-label="暂停"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg></button>
    </div>
  </div>
  <button class="mini-map-button" data-action="local-map" aria-label="打开岛图，快捷键 M"><span class="mini-map"></span><b>岛图</b><kbd>M</kbd></button>
  <div class="toast" role="status"></div>
  <div class="prompt"><kbd class="k-key">E</kbd><span class="prompt-verb"></span><span class="prompt-dot">·</span><span class="prompt-name"></span></div>
  <div class="quest is-empty"><span class="quest-tag">任务</span><span class="quest-text"></span></div>
  <div class="controls-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 行走 · <kbd>Shift</kbd> 快走 · <kbd>空格</kbd> 跳 · <kbd>E</kbd> 互动 · <kbd>M</kbd> 岛图 · 按住鼠标拖动转视角</div>
  <div class="touch">
    <div class="touch-stick"><i></i></div>
    <button class="touch-btn touch-act" data-touch="interact"><b>互动</b></button>
    <button class="touch-btn touch-jump" data-touch="jump"><b>跳</b></button>
  </div>
</section>

<section class="screen pause" data-screen="pause">
  <div class="panel">
    <h2>暂歇</h2>
    <button class="btn primary" data-action="resume"><span>继续</span></button>
    <button class="btn" data-action="pause-chart"><span>航海图</span></button>
    <button class="btn" data-action="settings"><span>设置</span></button>
    <button class="btn" data-action="quit"><span>回到标题</span></button>
  </div>
</section>

<section class="screen settings" data-screen="settings">
  <div class="panel wide">
    <h2>设置</h2>
    <label class="row"><span>音乐</span><input type="range" name="music" min="0" max="100"/></label>
    <label class="row"><span>音效</span><input type="range" name="sfx" min="0" max="100"/></label>
    <label class="row"><span>视角灵敏度</span><input type="range" name="sens" min="20" max="300"/></label>
    <div class="row"><span>画质</span><div class="seg"><button data-quality="low">流畅</button><button data-quality="medium">均衡</button><button data-quality="high">精美</button></div></div>
    <div class="row"><span>角色风格</span><div class="seg"><button data-model-style="detailed">写实</button><button data-model-style="chibi">Q版</button></div></div>
    <div class="row"><span>静音</span><button class="toggle" data-toggle="muted"><i></i></button></div>
    <div class="row"><span>视角上下反转</span><button class="toggle" data-toggle="invertY"><i></i></button></div>
    <div class="row"><span>减少动态效果</span><button class="toggle" data-toggle="reducedMotion"><i></i></button></div>
    <div class="row"><span>航程存档</span><button class="btn small danger" data-action="reset"><span>清除进度</span></button></div>
    <button class="btn primary" data-action="back"><span>返回</span></button>
  </div>
</section>

<div class="dialog" aria-live="polite">
  <div class="dialog-who"></div>
  <div class="dialog-text"></div>
  <div class="choices"></div>
  <i class="dialog-next"><svg viewBox="0 0 12 8" width="12" height="8"><path d="M0 0h12L6 8z" fill="currentColor"/></svg></i>
</div>

<div class="overlay chart">
  <div class="chart-paper">
    <header><h2>航海图</h2><p>可浏览各国介绍；目前仅第一章可启航。</p><div class="chart-legend"><span class="is-open">已开放</span><span class="is-done">已完成</span><span class="is-soon">制作中</span></div><button class="icon-btn" data-action="chart-close" aria-label="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></header>
    <div class="chart-body">
      <div class="chart-sea"></div>
      <aside class="chart-detail"></aside>
    </div>
  </div>
</div>

<div class="overlay local-map">
  <div class="local-map-paper" role="dialog" aria-modal="true" aria-label="岛图">
    <header><div><p>君子国 · 第一章</p><h2>山海舆图</h2></div><span class="local-map-hint">选择地标可设为辅助指引</span><button class="icon-btn" data-action="local-close" aria-label="关闭岛图"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></header>
    <div class="local-map-body"></div>
  </div>
</div>

<div class="overlay seal"><div class="seal-body"></div></div>

<div class="overlay ending">
  <div class="ending-scroll">
    <h2>镜花水月</h2>
    <p class="ending-lead">海外一程，六国六悟：</p>
    <ul class="ending-list"></ul>
    <p class="ending-last">镜中之花，水中之月。所见所历，皆在一心。<br/>—— 全剧终 ——</p>
    <button class="btn primary" data-action="overlay-ok"><span>回到海船</span></button>
  </div>
</div>

<div class="veil"><div class="wave-mark wave-mark--small">${WAVE_MARK_SVG}</div><p class="veil-label"></p><div class="veil-bar"><i></i></div></div>
`
  }
}
