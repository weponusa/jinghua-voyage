/**
 * Voyage progress rules (pure, unit tested). Chapters unlock in order; finishing one awards its
 * mirror flower and opens the next port. The finale needs every flower from the six kingdoms.
 */
export const CHAPTER_ORDER = ['junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai'] as const
export type ChapterId = (typeof CHAPTER_ORDER)[number]
export const KINGDOMS: ChapterId[] = CHAPTER_ORDER.filter(id => id !== 'penglai')

export const JUNZI_LANDMARKS = ['dock', 'arch', 'market', 'courtesy', 'pavilion'] as const
export type JunziProgress = { visited: string[]; haggleSolved: boolean; flowerCollected: boolean }
export const emptyJunzi = (): JunziProgress => ({ visited: [], haggleSolved: false, flowerCollected: false })

export type Progress = {
  /** Chapters finished at least once, in completion order. */
  completed: ChapterId[]
  /** True after the opening scene on deck has been seen. */
  prologueSeen: boolean
  /** True after the finale has been watched. */
  ending: boolean
  /** Persistent first-chapter checkpoints and optional travel journal. */
  junzi: JunziProgress
}

export function emptyProgress(): Progress {
  return { completed: [], prologueSeen: false, ending: false, junzi: emptyJunzi() }
}

export function isChapterId(v: unknown): v is ChapterId {
  return typeof v === 'string' && (CHAPTER_ORDER as readonly string[]).includes(v)
}

/** Chapters that are finished and playable in this build (the rest show as 制作中). */
export const PLAYABLE: readonly ChapterId[] = ['junzi']

export function isPlayable(id: ChapterId): boolean {
  return PLAYABLE.includes(id)
}

export function isUnlocked(p: Progress, id: ChapterId, playable: readonly ChapterId[] = PLAYABLE): boolean {
  if (!playable.includes(id)) return false
  const index = CHAPTER_ORDER.indexOf(id)
  if (index <= 0) return true
  // Every earlier port must be done; 小蓬莱 therefore needs all six mirror flowers.
  return CHAPTER_ORDER.slice(0, index).every(prev => p.completed.includes(prev))
}

export function isCompleted(p: Progress, id: ChapterId): boolean {
  return p.completed.includes(id)
}

/** The first unlocked chapter that has not been finished, or null when the voyage is done. */
export function nextChapter(p: Progress, playable: readonly ChapterId[] = PLAYABLE): ChapterId | null {
  return CHAPTER_ORDER.find(id => isUnlocked(p, id, playable) && !isCompleted(p, id)) ?? null
}

export function flowerCount(p: Progress): number {
  return KINGDOMS.filter(id => p.completed.includes(id)).length
}

export function completeChapter(p: Progress, id: ChapterId, playable: readonly ChapterId[] = PLAYABLE): { progress: Progress; firstTime: boolean } {
  if (!isUnlocked(p, id, playable)) return { progress: p, firstTime: false }
  if (p.completed.includes(id)) return { progress: { ...p, ending: p.ending || id === 'penglai' }, firstTime: false }
  return { progress: { ...p, completed: [...p.completed, id], ending: p.ending || id === 'penglai' }, firstTime: true }
}

/** Parse untrusted stored progress. Unknown ids are dropped; order gaps are tolerated. */
export function parseProgress(raw: unknown): Progress {
  const base = emptyProgress()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const data = raw as Record<string, unknown>
  const completed = Array.isArray(data.completed) ? data.completed.filter(isChapterId) : []
  const saved = data.junzi && typeof data.junzi === 'object' ? data.junzi as Record<string, unknown> : {}
  const visited = Array.isArray(saved.visited) ? saved.visited.filter((v): v is string => typeof v === 'string' && (JUNZI_LANDMARKS as readonly string[]).includes(v)) : []
  const collected = saved.flowerCollected === true || completed.includes('junzi')
  return {
    completed: [...new Set(completed)],
    prologueSeen: data.prologueSeen === true,
    ending: data.ending === true,
    junzi: { visited: [...new Set(visited)], haggleSolved: saved.haggleSolved === true || collected, flowerCollected: collected },
  }
}

export function updateJunzi(p: Progress, patch: Partial<JunziProgress>): Progress {
  return parseProgress({ ...p, junzi: { ...p.junzi, ...patch, visited: patch.visited ? [...p.junzi.visited, ...patch.visited] : p.junzi.visited } })
}
