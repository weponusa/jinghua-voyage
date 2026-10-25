/**
 * Voyage progress rules and untrusted-save migration. Chapter unlocks stay linear, while each
 * island owns a small JSON checkpoint so refresh and model-style rebuilds never lose puzzle state.
 */
export const CHAPTER_ORDER = ['junzi', 'daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai'] as const
export type ChapterId = (typeof CHAPTER_ORDER)[number]
export const KINGDOMS: ChapterId[] = CHAPTER_ORDER.filter(id => id !== 'penglai')

export const JUNZI_LANDMARKS = ['dock', 'arch', 'market', 'courtesy', 'pavilion'] as const
export type JunziProgress = { visited: string[]; haggleSolved: boolean; flowerCollected: boolean }
export const emptyJunzi = (): JunziProgress => ({ visited: [], haggleSolved: false, flowerCollected: false })

export type CheckpointValue = boolean | number | string | null | boolean[] | number[] | string[] | Record<string, boolean | number>
export type ChapterCheckpoint = {
  solved: boolean
  flowerCollected: boolean
  visited: string[]
  data: Record<string, CheckpointValue>
}
export const emptyChapterCheckpoint = (): ChapterCheckpoint => ({ solved: false, flowerCollected: false, visited: [], data: {} })

export type Progress = {
  completed: ChapterId[]
  prologueSeen: boolean
  ending: boolean
  junzi: JunziProgress
  chapters: Partial<Record<ChapterId, ChapterCheckpoint>>
  /** Last unfinished island; Continue returns here instead of losing the player's place. */
  lastChapter: ChapterId | null
}

export function emptyProgress(): Progress {
  return { completed: [], prologueSeen: false, ending: false, junzi: emptyJunzi(), chapters: {}, lastChapter: null }
}

export function isChapterId(v: unknown): v is ChapterId {
  return typeof v === 'string' && (CHAPTER_ORDER as readonly string[]).includes(v)
}

export const PLAYABLE: readonly ChapterId[] = CHAPTER_ORDER
export function isPlayable(id: ChapterId): boolean { return PLAYABLE.includes(id) }

/** Explicit test URL: unlocks every shipped chapter without marking it complete. */
export const TEST_ALL_CHAPTERS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('test') === '1'

export function isUnlocked(p: Progress, id: ChapterId, playable: readonly ChapterId[] = PLAYABLE): boolean {
  if (!playable.includes(id)) return false
  if (TEST_ALL_CHAPTERS) return true
  const index = CHAPTER_ORDER.indexOf(id)
  if (index <= 0) return true
  return CHAPTER_ORDER.slice(0, index).every(prev => p.completed.includes(prev))
}

export function isCompleted(p: Progress, id: ChapterId): boolean { return p.completed.includes(id) }

export function nextChapter(p: Progress, playable: readonly ChapterId[] = PLAYABLE): ChapterId | null {
  return CHAPTER_ORDER.find(id => isUnlocked(p, id, playable) && !isCompleted(p, id)) ?? null
}

export function flowerCount(p: Progress): number { return TEST_ALL_CHAPTERS ? 6 : KINGDOMS.filter(id => p.completed.includes(id)).length }

export function completeChapter(p: Progress, id: ChapterId, playable: readonly ChapterId[] = PLAYABLE): { progress: Progress; firstTime: boolean } {
  if (!isUnlocked(p, id, playable)) return { progress: p, firstTime: false }
  if (p.completed.includes(id)) return { progress: { ...p, ending: p.ending || id === 'penglai' }, firstTime: false }
  return { progress: { ...p, completed: [...p.completed, id], ending: p.ending || id === 'penglai' }, firstTime: true }
}

function checkpointValue(raw: unknown): CheckpointValue | undefined {
  if (raw === null || typeof raw === 'boolean' || typeof raw === 'string') return raw
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (Array.isArray(raw)) {
    if (raw.every(v => typeof v === 'boolean')) return raw as boolean[]
    if (raw.every(v => typeof v === 'number' && Number.isFinite(v))) return raw as number[]
    if (raw.every(v => typeof v === 'string')) return raw as string[]
    return undefined
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, boolean | number> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
      if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) out[k] = v
    }
    return out
  }
  return undefined
}

function parseCheckpoint(raw: unknown, completed: boolean, finale = false): ChapterCheckpoint {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const values: Record<string, CheckpointValue> = {}
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    for (const [key, rawValue] of Object.entries(data.data)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      const value = checkpointValue(rawValue)
      if (value !== undefined) values[key] = value
    }
  }
  const flowerCollected = !finale && (data.flowerCollected === true || completed)
  return {
    solved: data.solved === true || flowerCollected || completed,
    flowerCollected,
    visited: Array.isArray(data.visited) ? [...new Set(data.visited.filter((v): v is string => typeof v === 'string'))] : [],
    data: values,
  }
}

export function chapterCheckpoint(p: Progress, id: ChapterId): ChapterCheckpoint {
  if (id === 'junzi') return { solved: p.junzi.haggleSolved, flowerCollected: p.junzi.flowerCollected, visited: p.junzi.visited, data: {} }
  return p.chapters[id] ?? parseCheckpoint(null, p.completed.includes(id), id === 'penglai')
}

export function parseProgress(raw: unknown): Progress {
  const base = emptyProgress()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const data = raw as Record<string, unknown>
  const completed = Array.isArray(data.completed) ? [...new Set(data.completed.filter(isChapterId))] : []
  const saved = data.junzi && typeof data.junzi === 'object' ? data.junzi as Record<string, unknown> : {}
  const visited = Array.isArray(saved.visited) ? saved.visited.filter((v): v is string => typeof v === 'string' && (JUNZI_LANDMARKS as readonly string[]).includes(v)) : []
  const collected = saved.flowerCollected === true || completed.includes('junzi')
  const chapters: Progress['chapters'] = {}
  const rawChapters = data.chapters && typeof data.chapters === 'object' && !Array.isArray(data.chapters) ? data.chapters : {}
  for (const id of CHAPTER_ORDER) {
    if (id === 'junzi') continue
    const rawCheckpoint = (rawChapters as Record<string, unknown>)[id]
    if (rawCheckpoint !== undefined || completed.includes(id)) chapters[id] = parseCheckpoint(rawCheckpoint, completed.includes(id), id === 'penglai')
  }
  return {
    completed,
    prologueSeen: data.prologueSeen === true,
    ending: data.ending === true,
    junzi: { visited: [...new Set(visited)], haggleSolved: saved.haggleSolved === true || collected, flowerCollected: collected },
    chapters,
    lastChapter: isChapterId(data.lastChapter) ? data.lastChapter : null,
  }
}

export function updateJunzi(p: Progress, patch: Partial<JunziProgress>): Progress {
  return parseProgress({ ...p, junzi: { ...p.junzi, ...patch, visited: patch.visited ? [...p.junzi.visited, ...patch.visited] : p.junzi.visited } })
}

export function updateChapterCheckpoint(p: Progress, id: ChapterId, patch: Partial<ChapterCheckpoint>): Progress {
  if (id === 'junzi') {
    return updateJunzi(p, {
      ...(patch.solved === undefined ? {} : { haggleSolved: patch.solved }),
      ...(patch.flowerCollected === undefined ? {} : { flowerCollected: patch.flowerCollected }),
      ...(patch.visited ? { visited: patch.visited } : {}),
    })
  }
  const previous = chapterCheckpoint(p, id)
  const next = { ...previous, ...patch, visited: patch.visited ? [...previous.visited, ...patch.visited] : previous.visited, data: { ...previous.data, ...patch.data } }
  return parseProgress({ ...p, chapters: { ...p.chapters, [id]: next } })
}
