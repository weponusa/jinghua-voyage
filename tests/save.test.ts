import { describe, expect, it } from 'vitest'
import { defaultSave, parseSave, SAVE_KEY, SaveStore } from '../src/engine/save'
import { CHAPTER_ORDER, LEGACY_CHAPTER_ORDER, PLAYABLE, chapterCheckpoint, completeChapter, emptyProgress, flowerCount, isUnlocked, nextChapter, parseProgress, updateChapterCheckpoint } from '../src/game/progress'

const ALL = CHAPTER_ORDER

describe('save', () => {
  it('falls back to defaults for missing, corrupt or foreign data', () => {
    expect(parseSave(null)).toEqual(defaultSave())
    expect(parseSave('{nope')).toEqual(defaultSave())
    expect(parseSave('[]')).toEqual(defaultSave())
    expect(parseSave(JSON.stringify({ version: 99, musicVolume: 0.1 }))).toEqual(defaultSave())
  })
  it('clamps and validates fields', () => {
    const s = parseSave(JSON.stringify({ version: 1, musicVolume: 5, sfxVolume: -1, quality: 'ultra', progress: { completed: ['junzi', 'atlantis', 'junzi'] } }))
    expect(s.musicVolume).toBe(1)
    expect(s.sfxVolume).toBe(0)
    expect(s.quality).toBe(defaultSave().quality)
    expect(s.progress.completed).toEqual(['junzi'])
  })
  it('migrates a fully completed v1 save without blocking the new chapters', () => {
    const s = parseSave(JSON.stringify({ version: 1, progress: { route: 'linear', completed: LEGACY_CHAPTER_ORDER } }))
    expect(s.version).toBe(2)
    expect(s.progress.route).toBe('legacy')
    expect(nextChapter(s.progress)).toBe('shushi')
    expect(isUnlocked(s.progress, 'shushi')).toBe(true)
    expect(isUnlocked(s.progress, 'qishe')).toBe(true)
    expect(isUnlocked(s.progress, 'nver')).toBe(true)
    expect(flowerCount(s.progress)).toBe(6)
  })
  it('continues a partial v1 save along the legacy main route', () => {
    const s = parseSave(JSON.stringify({ version: 1, progress: { completed: ['junzi', 'daren', 'liangmian'] } }))
    expect(s.progress.route).toBe('legacy')
    expect(nextChapter(s.progress)).toBe('wuchang')
    expect(isUnlocked(s.progress, 'wuchang')).toBe(true)
    expect(isUnlocked(s.progress, 'heichi')).toBe(false)
    expect(isUnlocked(s.progress, 'shushi')).toBe(true)
  })
  it('uses version 2 and the linear route for new saves', () => {
    expect(defaultSave().version).toBe(2)
    expect(defaultSave().progress.route).toBe('linear')
    const s = parseSave(JSON.stringify({ version: 2, progress: { completed: ['junzi', 'daren'] } }))
    expect(s.progress.route).toBe('linear')
    expect(nextChapter(s.progress)).toBe('wuchang')
    expect(isUnlocked(s.progress, 'liangmian')).toBe(false)
  })
  it('persists through storage and survives storage errors', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    new SaveStore(storage).update({ musicVolume: 0.3, progress: completeChapter(emptyProgress(), 'junzi').progress })
    expect(JSON.parse(mem.get(SAVE_KEY)!).musicVolume).toBe(0.3)
    expect(new SaveStore(storage).data.progress.completed).toEqual(['junzi'])
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
    const store = new SaveStore(broken)
    expect(() => store.update({ muted: true })).not.toThrow()
    expect(store.data.muted).toBe(true)
  })
})

describe('voyage progress', () => {
  it('opens one port at a time and ends at 小蓬莱', () => {
    let p = emptyProgress()
    expect(isUnlocked(p, 'junzi', ALL)).toBe(true)
    expect(isUnlocked(p, 'daren', ALL)).toBe(false)
    for (const id of CHAPTER_ORDER) {
      expect(nextChapter(p, ALL)).toBe(id)
      expect(isUnlocked(p, id, ALL)).toBe(true)
      const r = completeChapter(p, id, ALL)
      expect(r.firstTime).toBe(true)
      p = r.progress
    }
    expect(nextChapter(p, ALL)).toBeNull()
    expect(flowerCount(p)).toBe(6)
  })
  it('only offers chapters that are built in this release', () => {
    const p = completeChapter(emptyProgress(), 'junzi').progress
    expect(PLAYABLE).toContain('junzi')
    expect(isUnlocked(p, 'daren', ['junzi'])).toBe(false)
    expect(nextChapter(p, ['junzi'])).toBeNull()
    expect(completeChapter(p, 'daren', ['junzi']).firstTime).toBe(false)
  })
  it('replaying a finished chapter changes nothing', () => {
    const p = completeChapter(emptyProgress(), 'junzi').progress
    const again = completeChapter(p, 'junzi')
    expect(again.firstTime).toBe(false)
    expect(again.progress.completed).toEqual(['junzi'])
  })
  it('requires every earlier chapter, even with a tampered save', () => {
    const p = parseProgress({ completed: ['heichi'] })
    expect(isUnlocked(p, 'penglai', ALL)).toBe(false)
  })
  it('merges chapter checkpoints without losing puzzle state or reviving collected flowers', () => {
    let p = updateChapterCheckpoint(emptyProgress(), 'wuchang', { data: { talkedMiser: true, carryingBowl: 1 } })
    p = updateChapterCheckpoint(p, 'wuchang', { data: { carryingBowl: -1, fed: [0, 1] }, visited: ['afu'] })
    expect(chapterCheckpoint(p, 'wuchang')).toMatchObject({ data: { talkedMiser: true, carryingBowl: -1, fed: [0, 1] }, visited: ['afu'] })
    p = updateChapterCheckpoint(p, 'wuchang', { solved: true, flowerCollected: true })
    expect(flowerCount(p)).toBe(1)
    const restored = parseProgress(JSON.parse(JSON.stringify(p)))
    expect(chapterCheckpoint(restored, 'wuchang')).toMatchObject({ solved: true, flowerCollected: true, data: { fed: [0, 1] } })
  })
  it('never creates flowers in story-only chapters', () => {
    let p = updateChapterCheckpoint(emptyProgress(), 'shushi', { solved: true, flowerCollected: true })
    p = parseProgress({
      ...p,
      completed: ['shushi', 'qishe', 'nver', 'penglai'],
      chapters: {
        ...p.chapters,
        qishe: { flowerCollected: true },
        nver: { solved: true, flowerCollected: true },
        penglai: { flowerCollected: true },
      },
    })
    for (const id of ['shushi', 'qishe', 'nver', 'penglai'] as const) {
      expect(chapterCheckpoint(p, id).flowerCollected).toBe(false)
    }
    expect(chapterCheckpoint(p, 'nver').solved).toBe(true)
    expect(flowerCount(p)).toBe(0)
  })
  it('sanitizes new story fields and preserves valid values', () => {
    const valid = parseProgress({
      route: 'legacy',
      prologueAct: 2.9,
      seaEvents: ['storm', 'storm', 'rescue'],
      endingChoice: 'stay',
      epilogueSeen: true,
    })
    expect(valid).toMatchObject({ route: 'legacy', prologueAct: 2, seaEvents: ['storm', 'rescue'], endingChoice: 'stay', epilogueSeen: true })
    const invalid = parseProgress({ route: 'other', prologueAct: 99, seaEvents: ['storm', 1, null], endingChoice: 'other', epilogueSeen: 'yes' })
    expect(invalid).toMatchObject({ route: 'linear', prologueAct: 3, seaEvents: ['storm'], endingChoice: null, epilogueSeen: false })
    expect(parseProgress({ prologueAct: -2 }).prologueAct).toBe(0)
    expect(parseProgress({ prologueAct: '2' }).prologueAct).toBe(0)
  })
})
