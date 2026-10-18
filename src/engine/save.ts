import { emptyProgress, parseProgress, type Progress } from '../game/progress'

/**
 * Versioned local save. Everything the player keeps between sessions lives in one JSON record so
 * it is easy to migrate. Corrupt or foreign data falls back to defaults instead of crashing.
 */
export type Quality = 'low' | 'medium' | 'high'

export type SaveData = {
  version: 1
  musicVolume: number
  sfxVolume: number
  muted: boolean
  sensitivity: number
  invertY: boolean
  quality: Quality
  reducedMotion: boolean
  modelStyle: 'detailed' | 'chibi'
  /** Voyage progress: finished chapters and story flags. */
  progress: Progress
}

export const SAVE_KEY = 'jinghua.save'

export function defaultSave(): SaveData {
  return {
    version: 1,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false,
    sensitivity: 1,
    invertY: false,
    quality: 'high',
    reducedMotion: false,
    modelStyle: 'detailed',
    progress: emptyProgress(),
  }
}

const clamp01 = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback)

/** Parse untrusted stored JSON into a valid SaveData (pure; unit tested). */
export function parseSave(raw: string | null): SaveData {
  const base = defaultSave()
  if (!raw) return base
  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    data = parsed as Record<string, unknown>
  } catch {
    return base
  }
  if (data.version !== 1) return base
  return {
    version: 1,
    musicVolume: clamp01(data.musicVolume, base.musicVolume),
    sfxVolume: clamp01(data.sfxVolume, base.sfxVolume),
    muted: data.muted === true,
    sensitivity: typeof data.sensitivity === 'number' && data.sensitivity >= 0.2 && data.sensitivity <= 3 ? data.sensitivity : base.sensitivity,
    invertY: data.invertY === true,
    quality: data.quality === 'low' || data.quality === 'medium' || data.quality === 'high' ? data.quality : base.quality,
    reducedMotion: data.reducedMotion === true,
    modelStyle: data.modelStyle === 'chibi' ? 'chibi' : 'detailed',
    progress: parseProgress(data.progress),
  }
}

export class SaveStore {
  data: SaveData

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
    let raw: string | null = null
    try {
      raw = this.storage?.getItem(SAVE_KEY) ?? null
    } catch {
      raw = null
    }
    this.data = parseSave(raw)
  }

  update(patch: Partial<SaveData>): void {
    this.data = { ...this.data, ...patch }
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      // Private browsing or quota: the game keeps working with in-memory settings.
    }
  }
}
