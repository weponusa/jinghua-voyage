import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Voyage } from '../src/game/voyage'

describe('interaction input lifetime', () => {
  it('does not discard a key edge on a render-only high-refresh frame', () => {
    const voyage = Object.create(Voyage.prototype) as Voyage
    const endFrame = vi.fn()
    const input = { endFrame, takeLook: () => ({ x: 0, y: 0 }) }
    const renderer = { render: vi.fn() }
    const active = {
      physics: { sync: vi.fn() },
      player: {
        root: new THREE.Group(), frozen: false, grounded: true,
        animate: vi.fn(),
      },
      npcs: [], updaters: [], flower: null, target: null,
      stage: { scene: new THREE.Scene(), update: vi.fn() },
      marker: { visible: false },
      guide: { visible: false },
      map: { landmarks: [] }, trackedId: null,
      cam: { camera: {}, update: vi.fn() },
    }
    Object.assign(voyage as unknown as Record<string, unknown>, {
      input, renderer, active, mode: 'title', time: 0, navigationTimer: 0,
      reducedMotion: false,
    })

    voyage.render(0, 1 / 144)

    expect(renderer.render).toHaveBeenCalledOnce()
    expect(endFrame).not.toHaveBeenCalled()
  })
})
