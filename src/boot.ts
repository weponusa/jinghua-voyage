import './styles/jinghua.css'
import './styles/sea-chart.css'
import { Audio } from './engine/audio'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore, type SaveData } from './engine/save'
import { emptyProgress } from './game/progress'
import type { Voyage } from './game/voyage'
import { TouchControls } from './ui/touch'
import { Ui } from './ui/scroll-ui'

/**
 * Boot: the paper-coloured UI is on screen at once; three.js, Rapier and the game load as a
 * separate chunk behind the progress bar, then only the ship deck's models are fetched. Each
 * island's models load when the player sails there, so the first screen stays light.
 */
async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const firstRun = safeGet(SAVE_KEY) === null
  const save = new SaveStore()
  const input = new Input(canvas)
  if (navigator.maxTouchPoints > 0) input.method = 'touch'
  const audio = new Audio()
  let voyage: Voyage | undefined

  const applySettings = (d: SaveData) => {
    input.sensitivity = d.sensitivity
    input.invertY = d.invertY
    audio.setVolumes(d.musicVolume, d.sfxVolume, d.muted)
    if (voyage) voyage.reducedMotion = d.reducedMotion
  }

  const pause = () => {
    if (voyage?.mode !== 'explore') return
    voyage.pause()
    ui.show('pause')
  }
  const resume = () => {
    if (voyage?.mode !== 'paused') return
    voyage.resume()
    ui.show('hud')
    loop.resetAccumulator()
  }

  const ui = new Ui(save, audio, input, {
    start: () => {
      if (!voyage) return
      audio.unlock()
      audio.startMusic()
      ui.show('hud')
      const p = save.data.progress
      void voyage.enter(!p.completed.includes('junzi') && (p.junzi.haggleSolved || p.junzi.visited.length > 0) ? 'junzi' : 'hub')
    },
    chartFromTitle: () => {
      if (!voyage) return
      audio.unlock()
      audio.startMusic()
      ui.show('hud')
      void voyage.openChart().then(sailed => {
        if (!sailed) ui.show('title')
      })
    },
    resume,
    pause,
    pauseChart: () => {
      if (!voyage) return
      if (voyage.mode === 'paused') {
        voyage.resume()
        ui.show('hud')
      }
      if (voyage.mode === 'explore') void voyage.openChart()
    },
    localMap: () => {
      if (!voyage) return
      if (voyage.mode === 'paused') { voyage.resume(); ui.show('hud') }
      if (voyage.mode === 'explore') void voyage.openLocalMap()
    },
    quit: () => {
      voyage?.toTitle()
      ui.show('title')
    },
    settings: patch => {
      const qualityChanged = patch.quality !== undefined && patch.quality !== save.data.quality
      const styleChanged = patch.modelStyle !== undefined && patch.modelStyle !== save.data.modelStyle
      save.update(patch)
      applySettings(save.data)
      if (qualityChanged) voyage?.setQuality(save.data.quality)
      if (styleChanged) void voyage?.changeModelStyle()
    },
    resetProgress: () => save.update({ progress: emptyProgress() }),
    interact: () => voyage?.interactNow(),
  })
  ui.show('boot')
  applySettings(save.data)

  let loaded = 0
  const track = <T>(p: Promise<T>): Promise<T> => p.then(v => (ui.setBootProgress(0.1 + (++loaded / 4) * 0.5), v))
  ui.setBootProgress(0.08)
  const [{ Voyage: VoyageClass }, { Renderer, suggestQuality }, physics] = await Promise.all([
    track(import('./game/voyage')),
    track(import('./engine/renderer')),
    track(import('./engine/physics')),
    track(document.fonts.ready),
  ])
  await physics.initPhysics()
  if (firstRun) {
    save.update({ quality: suggestQuality() })
    ui.refreshSettings()
  }
  const renderer = new Renderer(canvas, save.data.quality)
  const v = new VoyageClass(renderer, input, audio, save, ui)
  voyage = v
  v.reducedMotion = save.data.reducedMotion
  ui.setBootProgress(0.75)
  await v.backdrop()
  ui.setBootProgress(1)

  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([
      import('../scripts/manus-tuning/adapter.js'), import('./game/tuning'),
    ])
    await registerGameTuning(tuning)
  }

  const loop = new GameLoop({
    step: dt => v.step(dt),
    render: (alpha, frameSeconds) => {
      input.update()
      if (input.consume('pause') && !ui.overlayOpen) {
        if (v.mode === 'explore') pause()
        else if (v.mode === 'paused' && ui.screen === 'pause') resume()
      }
      ui.frame(frameSeconds)
      loop.paused = v.mode === 'paused'
      if (v.mode === 'title') v.orbitTitle(frameSeconds)
      v.render(alpha, frameSeconds)
    },
  })
  loop.start()
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
  })
  new TouchControls(document.getElementById('ui')!, input, () => v.mode === 'explore' || v.mode === 'dialog')
  window.setTimeout(() => ui.show('title'), 200)
  // Debug/test hook (read-only use): smoke tests inspect state through it.
  ;(window as unknown as { __game: unknown }).__game = { voyage: v, ui, input, save }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

boot().catch(err => {
  console.error(err)
  const el = document.getElementById('ui')
  if (el) el.innerHTML = `<div class="fatal">启动失败：${String((err as Error)?.message ?? err).replace(/[<>&]/g, "")}<br><button class="btn" onclick="location.reload()">重试</button></div>`
})
