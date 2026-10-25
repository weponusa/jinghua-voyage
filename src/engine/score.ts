import Soundfont, { type SoundfontPlayer } from 'soundfont-player'
import type { ChapterId } from '../game/progress'

export type ScoreScene = ChapterId | 'hub'
export type ScoreMood = 'explore' | 'dialog' | 'triumph'
type InstrumentName = 'strings' | 'harp' | 'flute' | 'clarinet' | 'horn' | 'brass' | 'choir' | 'timpani' | 'koto' | 'pizz' | 'drum'
type NoteEvent = [beat: number, midi: number, beats: number]
type Profile = {
  bpm: number
  transpose: number
  lead: InstrumentName[]
  minor?: boolean
  sparse?: boolean
  drums?: boolean
  choir?: boolean
}

const FILES: Record<InstrumentName, string> = {
  strings: 'string_ensemble_1', harp: 'orchestral_harp', flute: 'flute', clarinet: 'clarinet',
  horn: 'french_horn', brass: 'brass_section', choir: 'choir_aahs', timpani: 'timpani',
  koto: 'koto', pizz: 'pizzicato_strings', drum: 'taiko_drum',
}
const RANGES: Record<InstrumentName, [number, number]> = {
  strings: [36, 88], harp: [36, 96], flute: [60, 93], clarinet: [48, 86], horn: [36, 79],
  brass: [36, 79], choir: [48, 86], timpani: [36, 60], koto: [48, 96], pizz: [28, 72], drum: [36, 60],
}
const STEREO: Record<InstrumentName, number> = {
  strings: -0.16, harp: -0.38, flute: 0.18, clarinet: -0.24, horn: -0.08,
  brass: 0.14, choir: 0, timpani: -0.24, koto: 0.36, pizz: 0.24, drum: -0.06,
}
const BUS_LEVEL = 3
const PROFILES: Record<ScoreScene, Profile> = {
  hub: { bpm: 68, transpose: 0, lead: ['flute', 'horn'], drums: true, choir: true },
  junzi: { bpm: 72, transpose: 0, lead: ['koto', 'flute'], sparse: true },
  daren: { bpm: 62, transpose: 2, lead: ['flute', 'horn'], choir: true },
  liangmian: { bpm: 66, transpose: -2, lead: ['clarinet'], minor: true, sparse: true },
  wuchang: { bpm: 82, transpose: -5, lead: ['pizz', 'koto'], sparse: true, drums: true },
  baimin: { bpm: 76, transpose: 5, lead: ['clarinet', 'flute'], sparse: true },
  shushi: { bpm: 64, transpose: -3, lead: ['clarinet'], minor: true, sparse: true },
  heichi: { bpm: 70, transpose: 7, lead: ['flute', 'koto'], drums: true },
  qishe: { bpm: 84, transpose: 4, lead: ['koto', 'flute'], sparse: true, drums: true },
  nver: { bpm: 72, transpose: -1, lead: ['harp', 'strings'], choir: true, sparse: true },
  penglai: { bpm: 60, transpose: 2, lead: ['flute', 'harp'], choir: true, drums: true },
}

// Original eight-bar pentatonic theme: voyage, wonder, question and return. The second
// statement is rescored by each kingdom rather than repeating a four-chord ambient pad.
const THEME: NoteEvent[][] = [
  [[0, 62, 1.5], [1.5, 66, 0.5], [2, 69, 1.5], [3.5, 66, 0.5]],
  [[0, 71, 1], [1, 69, 1], [2, 66, 2]],
  [[0, 67, 1.5], [1.5, 66, 0.5], [2, 64, 1], [3, 62, 1]],
  [[0, 69, 2.5], [2.5, 67, 0.5], [3, 66, 1]],
  [[0, 74, 1], [1, 71, 1], [2, 69, 1], [3, 67, 1]],
  [[0, 66, 1.5], [1.5, 64, 0.5], [2, 62, 2]],
  [[0, 66, 1], [1, 64, 1], [2, 61, 1], [3, 64, 1]],
  [[0, 62, 3], [3.25, 69, 0.75]],
]
const ROOTS = [50, 47, 43, 45, 50, 43, 45, 50]
const ARP = [0, 1, 2, 1, 0, 2, 1, 2]
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const notes = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => {
  const midi = from + i
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
})

/** A locally hosted sampled-orchestra conductor with deterministic, bar-accurate scheduling. */
export class ScoreConductor {
  private readonly bus: GainNode
  private readonly instruments = new Map<InstrumentName, SoundfontPlayer>()
  private loading: Promise<void> | null = null
  private timer = 0
  private requested = false
  private playing = false
  private scene: ScoreScene = 'hub'
  private mood: ScoreMood = 'explore'
  private bar = 0
  private nextBar = 0
  private previewBars = 0

  constructor(private readonly ctx: AudioContext, destination: AudioNode) {
    this.bus = ctx.createGain()
    this.bus.gain.value = BUS_LEVEL
    const hall = ctx.createConvolver()
    const wet = ctx.createGain()
    hall.buffer = this.impulse(2.8, 2.6)
    wet.gain.value = 0.26
    this.bus.connect(destination)
    this.bus.connect(hall).connect(wet).connect(destination)
  }

  get status() {
    return { scene: this.scene, mood: this.mood, playing: this.playing, instruments: this.instruments.size, bar: this.bar }
  }

  async start(): Promise<void> {
    this.requested = true
    if (this.playing || this.ctx.state !== 'running') return
    await this.load()
    if (!this.requested || this.playing || this.ctx.state !== 'running') return
    this.playing = true
    this.nextBar = this.ctx.currentTime + 0.12
    this.timer = window.setInterval(() => this.tick(), 90)
    this.tick()
  }

  private async load(): Promise<void> {
    if (this.instruments.size === Object.keys(FILES).length) return
    if (!this.loading) {
      this.loading = Promise.all((Object.keys(FILES) as InstrumentName[]).map(async key => {
        const [from, to] = RANGES[key]
        const channel = this.ctx.createStereoPanner()
        channel.pan.value = STEREO[key]
        channel.connect(this.bus)
        const instrument = await Soundfont.instrument(this.ctx, FILES[key], {
          nameToUrl: name => `./audio/soundfonts/${name}-mp3.json`,
          destination: channel,
          notes: notes(from, to),
          attack: key === 'strings' || key === 'choir' ? 0.025 : 0.004,
          release: key === 'strings' || key === 'choir' ? 0.35 : 0.12,
        })
        this.instruments.set(key, instrument)
      })).then(() => undefined)
    }
    await this.loading
  }

  setScene(scene: ScoreScene): void {
    if (scene === this.scene) return
    this.scene = scene
    this.restart(0.22)
  }

  setMood(mood: ScoreMood): void {
    if (mood === this.mood) return
    this.mood = mood
  }

  preview(): void {
    this.previewBars = 8
    this.restart(0.08)
  }

  private restart(delay: number): void {
    if (!this.playing) return
    const now = this.ctx.currentTime
    this.stopVoices(now + delay * 0.45)
    this.bar = 0
    this.nextBar = now + delay
    this.bus.gain.cancelScheduledValues(now)
    this.bus.gain.setValueAtTime(this.bus.gain.value, now)
    this.bus.gain.linearRampToValueAtTime(0.0001, now + delay * 0.45)
    this.bus.gain.setValueAtTime(0.0001, this.nextBar)
    this.bus.gain.linearRampToValueAtTime(BUS_LEVEL, this.nextBar + 0.35)
  }

  private tick(): void {
    if (!this.playing || this.ctx.state !== 'running') return
    if (this.nextBar < this.ctx.currentTime - 0.2) this.nextBar = this.ctx.currentTime + 0.08
    while (this.nextBar < this.ctx.currentTime + 0.45) {
      const profile = PROFILES[this.scene]
      this.scheduleBar(this.nextBar, profile)
      this.nextBar += 240 / profile.bpm
      this.bar += 1
      if (this.previewBars > 0) this.previewBars -= 1
    }
  }

  private scheduleBar(time: number, profile: Profile): void {
    const beat = 60 / profile.bpm
    const step = this.bar % 16
    const index = step % 8
    const root = ROOTS[index] + profile.transpose
    const minor = profile.minor && (index === 1 || index === 5 || index === 6)
    const third = minor ? 3 : 4
    const chord = [root, root + third, root + 7]
    const dialog = this.mood === 'dialog'
    const triumph = this.mood === 'triumph' || this.previewBars > 0 || (this.scene === 'hub' && step >= 8)
    const full = triumph || (!profile.sparse && step >= 4)
    const phraseGain = dialog ? 0.1 : triumph ? 0.26 : 0.19
    const padGain = dialog ? 0.075 : full ? 0.16 : 0.12

    // Three-part string divisi plus independent bass: the sustained body of the orchestra.
    chord.forEach((note, i) => this.play('strings', note + 12, time, beat * 4.08, padGain * (i === 0 ? 0.9 : 0.68)))
    this.play('strings', root - 12, time, beat * 3.9, dialog ? 0.065 : 0.14)
    if (full) this.play('horn', root + (index % 2 ? 7 : 12), time + beat * 0.04, beat * 3.7, dialog ? 0.035 : 0.105)

    // Harp/koto arpeggiation supplies motion without masking dialogue.
    if (!dialog || step % 2 === 0) {
      const arpNotes = [root + 12, root + 12 + third, root + 19]
      for (let i = 0; i < (profile.sparse ? 6 : 8); i += 1) {
        const at = time + i * beat * 0.5
        this.play(step % 4 === 3 ? 'koto' : 'harp', arpNotes[ARP[i]], at, beat * 0.85, dialog ? 0.055 : 0.105)
      }
    }

    // The lead changes between statements to create a real A/B orchestration.
    const events = THEME[index]
    if (!dialog || index % 2 === 0) {
      const lead = profile.lead[Math.floor(step / 8) % profile.lead.length]
      events.forEach(([at, note, length], i) => {
        const altered = profile.minor && (note === 66 || note === 74) ? note - 1 : note
        this.play(lead, altered + profile.transpose, time + at * beat + i * 0.006, length * beat * 0.94, phraseGain)
        if (triumph && lead !== 'horn' && lead !== 'pizz') this.play('horn', altered + profile.transpose - 12, time + at * beat, length * beat, 0.045)
      })
    }

    // Pizzicato and low drum patterns are composed per kingdom, not a constant metronome.
    if (profile.sparse || full) {
      const hits = this.scene === 'wuchang' ? [0, 0.75, 1.5, 2.5, 3.25] : [0, 2]
      hits.forEach((at, i) => this.play('pizz', root + (i % 2 ? 7 : 0), time + at * beat, beat * 0.4, dialog ? 0.035 : 0.095))
    }
    if (profile.drums && !dialog) {
      this.play('drum', 38 + profile.transpose, time, beat * 0.75, triumph ? 0.25 : 0.14)
      this.play('timpani', root - 12, time + beat * (triumph ? 3 : 2), beat * 0.85, triumph ? 0.22 : 0.12)
      if (triumph) {
        this.play('drum', 38 + profile.transpose, time + beat * 2, beat * 0.6, 0.18)
        chord.forEach(note => this.play('brass', note + 12, time, beat * 1.75, 0.09))
      }
    }
    if ((profile.choir || this.scene === 'penglai') && (full || step % 4 === 0)) {
      chord.slice(1).forEach(note => this.play('choir', note + 12, time, beat * 3.9, dialog ? 0.025 : 0.075))
    }
  }

  private play(key: InstrumentName, note: number, time: number, duration: number, gain: number): void {
    const instrument = this.instruments.get(key)
    if (!instrument || note < RANGES[key][0] || note > RANGES[key][1]) return
    instrument.play(note, time, { duration, gain })
  }

  private stopVoices(when = this.ctx.currentTime): void {
    for (const instrument of this.instruments.values()) instrument.stop(when)
  }

  stop(): void {
    this.requested = false
    this.playing = false
    clearInterval(this.timer)
    this.stopVoices()
    this.bus.gain.cancelScheduledValues(this.ctx.currentTime)
    this.bus.gain.setTargetAtTime(BUS_LEVEL, this.ctx.currentTime, 0.03)
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
    let seed = 0x7f4a
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0
        const early = i < this.ctx.sampleRate * 0.08 ? 0.35 : 1
        data[i] = ((seed / 0xffffffff) * 2 - 1) * Math.pow(1 - i / length, decay) * 0.5 * early
      }
    }
    return buffer
  }
}
