declare module 'soundfont-player' {
  export type SoundfontNote = string | number
  export type SoundfontPlayer = {
    name: string
    play(note: SoundfontNote, when?: number, options?: { duration?: number; gain?: number; attack?: number; release?: number }): { stop(when?: number): void }
    stop(when?: number): void
    connect(destination: AudioNode): SoundfontPlayer
  }
  export type SoundfontOptions = {
    destination?: AudioNode
    gain?: number
    notes?: SoundfontNote[]
    attack?: number
    release?: number
    nameToUrl?: (name: string, soundfont?: string, format?: string) => string
  }
  const Soundfont: {
    instrument(context: AudioContext, name: string, options?: SoundfontOptions): Promise<SoundfontPlayer>
  }
  export default Soundfont
}
