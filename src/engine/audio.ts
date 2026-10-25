import { ScoreConductor, type ScoreMood, type ScoreScene } from './score'

/**
 * Web Audio mixer with music and SFX buses. Music uses locally hosted orchestral samples;
 * short procedural cues keep interaction sounds responsive. Browsers still require a real
 * user gesture before either bus can start output.
 */
export type Sfx = 'pickup' | 'jump' | 'land' | 'hurt' | 'ui' | 'win' | 'lose' | 'dash' | 'page' | 'seal' | 'sail'

type ToneOptions = {
  frequency: number
  end?: number
  duration: number
  type?: OscillatorType
  volume: number
  delay?: number
  attack?: number
  pan?: number
  cutoff?: number
  reverb?: number
}

type NoiseOptions = {
  duration: number
  volume: number
  frequency: number
  end?: number
  type?: BiquadFilterType
  q?: number
  delay?: number
  attack?: number
  pan?: number
  reverb?: number
}

const MIN_GAP: Partial<Record<Sfx, number>> = {
  pickup: 0.08, jump: 0.08, land: 0.09, hurt: 0.14, ui: 0.035,
  page: 0.04, seal: 0.2, sail: 0.25, dash: 0.08,
}

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private reverb: ConvolverNode
  private reverbGain: GainNode
  private noiseBuffer: AudioBuffer
  private readonly score: ScoreConductor
  private buffers = new Map<string, AudioBuffer>()
  private lastPlayed = new Map<Sfx, number>()
  private unlocking: Promise<boolean> | null = null
  private pendingCue: { name: Sfx; at: number } | null = null
  private musicRequested = false

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.music = this.ctx.createGain()
    this.sfx = this.ctx.createGain()
    this.reverb = this.ctx.createConvolver()
    this.reverbGain = this.ctx.createGain()
    const limiter = this.ctx.createDynamicsCompressor()
    const musicFilter = this.ctx.createBiquadFilter()

    musicFilter.type = 'lowpass'
    musicFilter.frequency.value = 10500
    musicFilter.Q.value = 0.2
    limiter.threshold.value = -18
    limiter.knee.value = 16
    limiter.ratio.value = 5
    limiter.attack.value = 0.003
    limiter.release.value = 0.18
    this.reverb.buffer = this.makeImpulse(1.05, 2.8)
    this.reverbGain.gain.value = 0.18
    this.noiseBuffer = this.makeNoise(2)

    this.music.connect(musicFilter).connect(this.master)
    this.sfx.connect(this.master)
    this.reverb.connect(this.reverbGain).connect(this.sfx)
    this.master.connect(limiter).connect(this.ctx.destination)
    this.score = new ScoreConductor(this.ctx, this.music)
  }

  /** Resume inside a real user gesture; retain one cue until the browser actually starts output. */
  unlock(): Promise<boolean> {
    if (this.ctx.state === 'running') {
      if (this.musicRequested && !this.score.status.playing) this.beginMusic()
      return Promise.resolve(true)
    }
    if (this.unlocking) return this.unlocking
    this.unlocking = this.ctx.resume().then(() => {
      if (this.ctx.state !== 'running') return false
      // Starting a zero-length buffer in the gesture also unlocks older iOS audio output routes.
      const source = this.ctx.createBufferSource()
      source.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
      source.connect(this.master)
      source.start()
      source.onended = () => source.disconnect()
      if (this.musicRequested) this.beginMusic()
      const cue = this.pendingCue
      this.pendingCue = null
      if (cue && performance.now() - cue.at < 2500) this.play(cue.name)
      return true
    }).catch(() => false).finally(() => { this.unlocking = null })
    return this.unlocking
  }

  /** Volumes in 0..1. Short smoothing avoids clicks when a slider or mute changes. */
  setVolumes(music: number, sfx: number, muted = false): void {
    const t = this.ctx.currentTime
    this.music.gain.setTargetAtTime(muted ? 0 : music, t, 0.04)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.72, t, 0.025)
  }

  async load(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url)
    if (cached) return cached
    const data = await (await fetch(url)).arrayBuffer()
    const buffer = await this.ctx.decodeAudioData(data)
    this.buffers.set(url, buffer)
    return buffer
  }

  playBuffer(buffer: AudioBuffer, bus: 'music' | 'sfx' = 'sfx', loop = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = loop
    src.connect(bus === 'music' ? this.music : this.sfx)
    src.start()
    return src
  }

  play(name: Sfx): void {
    if (this.ctx.state !== 'running') {
      this.pendingCue = { name, at: performance.now() }
      void this.unlock()
      return
    }
    const t = this.ctx.currentTime
    const previous = this.lastPlayed.get(name) ?? -Infinity
    if (t - previous < (MIN_GAP[name] ?? 0)) return
    this.lastPlayed.set(name, t)

    const chime = (frequency: number, delay: number, volume: number, duration = 0.48, pan = 0) => {
      this.tone({ frequency, end: frequency * 0.996, duration, type: 'sine', volume, delay, attack: 0.006, pan, reverb: 0.3 })
      this.tone({ frequency: frequency * 2.005, duration: duration * 0.62, type: 'sine', volume: volume * 0.24, delay: delay + 0.004, attack: 0.004, pan, reverb: 0.22 })
      this.tone({ frequency: frequency * 3.97, duration: duration * 0.34, type: 'sine', volume: volume * 0.08, delay: delay + 0.006, attack: 0.003, pan, reverb: 0.16 })
    }

    switch (name) {
      case 'pickup':
        chime(659.25, 0, 0.19, 0.38, -0.12)
        chime(987.77, 0.075, 0.16, 0.46, 0.12)
        chime(1318.51, 0.15, 0.11, 0.5, 0)
        this.noise({ duration: 0.15, volume: 0.025, frequency: 5200, type: 'highpass', delay: 0.04, reverb: 0.25 })
        break
      case 'jump':
        this.tone({ frequency: 245, end: 510, duration: 0.17, type: 'triangle', volume: 0.12, cutoff: 1500, reverb: 0.05 })
        this.noise({ duration: 0.14, volume: 0.055, frequency: 650, end: 1700, type: 'bandpass', q: 0.7, reverb: 0.04 })
        break
      case 'land':
        this.tone({ frequency: 118, end: 54, duration: 0.13, type: 'sine', volume: 0.2, attack: 0.004, reverb: 0.02 })
        this.noise({ duration: 0.11, volume: 0.1, frequency: 420, end: 150, type: 'lowpass', attack: 0.003, reverb: 0.02 })
        break
      case 'hurt':
        this.tone({ frequency: 185, end: 76, duration: 0.25, type: 'triangle', volume: 0.17, cutoff: 750, reverb: 0.08 })
        this.noise({ duration: 0.18, volume: 0.065, frequency: 680, end: 230, type: 'bandpass', q: 0.9, reverb: 0.05 })
        break
      case 'ui':
        this.tone({ frequency: 690, end: 510, duration: 0.055, type: 'sine', volume: 0.105, attack: 0.003, reverb: 0.04 })
        this.noise({ duration: 0.026, volume: 0.025, frequency: 2100, type: 'highpass', attack: 0.002 })
        break
      case 'page':
        this.noise({ duration: 0.075, volume: 0.055, frequency: 1250, end: 2800, type: 'bandpass', q: 0.55, pan: -0.08, reverb: 0.03 })
        this.tone({ frequency: 420, end: 350, duration: 0.045, type: 'sine', volume: 0.035, delay: 0.012, pan: 0.08 })
        break
      case 'dash':
        this.noise({ duration: 0.24, volume: 0.1, frequency: 380, end: 1900, type: 'bandpass', q: 0.6, reverb: 0.08 })
        this.tone({ frequency: 280, end: 145, duration: 0.18, type: 'triangle', volume: 0.055, cutoff: 900 })
        break
      case 'seal':
        this.noise({ duration: 0.12, volume: 0.2, frequency: 360, end: 120, type: 'lowpass', attack: 0.002, reverb: 0.12 })
        this.tone({ frequency: 105, end: 62, duration: 0.2, type: 'sine', volume: 0.22, attack: 0.003, reverb: 0.08 })
        chime(523.25, 0.075, 0.18, 0.75, -0.08)
        chime(783.99, 0.18, 0.13, 0.82, 0.08)
        break
      case 'sail':
        this.noise({ duration: 0.85, volume: 0.07, frequency: 280, end: 1350, type: 'bandpass', q: 0.45, attack: 0.12, reverb: 0.28 })
        chime(392, 0.08, 0.1, 0.75, -0.2)
        chime(587.33, 0.28, 0.09, 0.85, 0.2)
        break
      case 'win':
        [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((frequency, i) => chime(frequency, i * 0.105, 0.14 - i * 0.008, 0.7, (i - 2) * 0.09))
        break
      case 'lose':
        [392, 329.63, 261.63].forEach((frequency, i) => this.tone({ frequency, end: frequency * 0.985, duration: 0.48, type: 'triangle', volume: 0.12, delay: i * 0.16, cutoff: 1200, reverb: 0.22 }))
        break
    }
  }

  private tone(options: ToneOptions): void {
    const { frequency, duration, volume } = options
    const delay = options.delay ?? 0
    const t = this.ctx.currentTime + delay
    const oscillator = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    const panner = this.ctx.createStereoPanner()
    oscillator.type = options.type ?? 'sine'
    oscillator.frequency.setValueAtTime(frequency, t)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(options.end ?? frequency, 20), t + duration)
    filter.type = 'lowpass'
    filter.frequency.value = options.cutoff ?? 8000
    filter.Q.value = 0.35
    panner.pan.value = options.pan ?? 0
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), t + (options.attack ?? 0.008))
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    oscillator.connect(filter).connect(gain).connect(panner)
    this.connectVoice(panner, options.reverb ?? 0)
    oscillator.start(t)
    oscillator.stop(t + duration + 0.04)
  }

  private noise(options: NoiseOptions): void {
    const t = this.ctx.currentTime + (options.delay ?? 0)
    const source = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    const panner = this.ctx.createStereoPanner()
    source.buffer = this.noiseBuffer
    filter.type = options.type ?? 'bandpass'
    filter.frequency.setValueAtTime(options.frequency, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(options.end ?? options.frequency, 30), t + options.duration)
    filter.Q.value = options.q ?? 0.7
    panner.pan.value = options.pan ?? 0
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(options.volume, 0.0001), t + (options.attack ?? 0.006))
    gain.gain.exponentialRampToValueAtTime(0.0001, t + options.duration)
    source.connect(filter).connect(gain).connect(panner)
    this.connectVoice(panner, options.reverb ?? 0)
    source.start(t)
    source.stop(t + options.duration + 0.03)
  }

  private connectVoice(output: StereoPannerNode, reverb: number): void {
    output.connect(this.sfx)
    if (reverb > 0) {
      const send = this.ctx.createGain()
      send.gain.value = reverb
      output.connect(send).connect(this.reverb)
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let seed = 0x4a17
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      data[i] = (seed / 0xffffffff) * 2 - 1
    }
    return buffer
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * seconds)
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
    let seed = 0x9e37
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0
        const noise = (seed / 0xffffffff) * 2 - 1
        data[i] = noise * Math.pow(1 - i / length, decay) * 0.42
      }
    }
    return impulse
  }

  /** Start the sampled orchestra after the browser's real audio unlock. */
  startMusic(): void {
    this.musicRequested = true
    if (this.ctx.state !== 'running') {
      void this.unlock()
      return
    }
    this.beginMusic()
  }

  private beginMusic(): void {
    void this.score.start().catch(error => {
      console.warn('管弦配乐载入失败', error)
    })
  }

  setScene(scene: ScoreScene): void {
    this.score.setScene(scene)
  }

  setMusicMood(mood: ScoreMood): void {
    this.score.setMood(mood)
  }

  previewScore(): void {
    this.musicRequested = true
    void this.score.start().then(() => this.score.preview()).catch(error => console.warn('配乐试听载入失败', error))
  }

  get scoreStatus() {
    return this.score.status
  }

  stopMusic(): void {
    this.musicRequested = false
    this.score.stop()
  }
}
