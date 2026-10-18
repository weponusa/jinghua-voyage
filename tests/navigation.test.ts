import { describe, expect, it } from 'vitest'
import { emptyProgress, parseProgress, updateJunzi, completeChapter } from '../src/game/progress'
import { distanceTo, JUNZI_MAP, mapPercent } from '../src/game/navigation'
import { defaultSave, parseSave } from '../src/engine/save'

describe('chapter-one checkpoints', () => {
  it('merges visited landmarks without losing solved state', () => {
    let p = updateJunzi(emptyProgress(), { visited: ['arch'], haggleSolved: true })
    p = updateJunzi(p, { visited: ['courtesy', 'arch', 'foreign'] })
    expect(p.junzi.visited).toEqual(['arch', 'courtesy'])
    expect(p.junzi.haggleSolved).toBe(true)
  })
  it('restores collected flowers before the return journey without claiming chapter completion', () => {
    const p = parseProgress({ completed: [], junzi: { flowerCollected: true } })
    expect(p.junzi.haggleSolved).toBe(true)
    expect(p.junzi.flowerCollected).toBe(true)
    expect(p.completed).toEqual([])
    expect(completeChapter(p, 'junzi').firstTime).toBe(true)
  })
  it('migrates old completed saves to replayable chapter checkpoints', () => {
    const p = parseProgress({ completed: ['junzi'] })
    expect(p.junzi.flowerCollected).toBe(true)
    expect(p.junzi.haggleSolved).toBe(true)
    expect(completeChapter(p, 'junzi').firstTime).toBe(false)
  })
  it('rejects malformed journal data', () => {
    expect(parseProgress({ junzi: { visited: [null, 'arch', 'arch', 1], haggleSolved: 'true' } }).junzi).toEqual({ visited: ['arch'], haggleSolved: false, flowerCollected: false })
    expect(parseProgress({ junzi: null }).junzi).toEqual(emptyProgress().junzi)
  })
  it('persists model style while retaining detailed mode for old saves', () => {
    expect(parseSave(JSON.stringify({ version: 1, modelStyle: 'chibi' })).modelStyle).toBe('chibi')
    expect(parseSave(JSON.stringify({ version: 1, modelStyle: 'invalid' })).modelStyle).toBe(defaultSave().modelStyle)
  })
})
describe('map coordinates', () => {
  it('puts north (-Z) at the top, south at the bottom', () => {
    expect(mapPercent({ x: -25, z: -24 }, JUNZI_MAP)).toEqual({ x: 0, y: 0 })
    expect(mapPercent({ x: 25, z: 30 }, JUNZI_MAP)).toEqual({ x: 100, y: 100 })
  })
  it('clips display positions but uses actual world distance', () => {
    expect(mapPercent({ x: 100, z: -100 }, JUNZI_MAP)).toEqual({ x: 100, y: 0 })
    expect(distanceTo({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5)
  })
  it('has every journal landmark and connected visitor paths', () => {
    expect(new Set(JUNZI_MAP.landmarks.map(l => l.id)).size).toBe(5)
    expect(JUNZI_MAP.paths).toHaveLength(5)
    for (const l of JUNZI_MAP.landmarks) expect(mapPercent(l, JUNZI_MAP).x).toBeGreaterThan(0)
  })
})
