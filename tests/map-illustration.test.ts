import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { mapCamera } from '../src/game/map-illustration'
import { JUNZI_MAP, mapPercent } from '../src/game/navigation'

describe('real-scene north-up map', () => {
  it('projects ground points to the same map coordinates as navigation markers', () => {
    const camera = mapCamera(JUNZI_MAP)
    for (const point of [{ x: -25, z: -24 }, { x: 25, z: 30 }, ...JUNZI_MAP.landmarks]) {
      const projected = new Vector3(point.x, 0, point.z).project(camera)
      const percent = mapPercent(point, JUNZI_MAP)
      expect((projected.x + 1) * 50).toBeCloseTo(percent.x, 6)
      expect((1 - projected.y) * 50).toBeCloseTo(percent.y, 6)
    }
  })
  it('keeps north at the top and east at the right', () => {
    const camera = mapCamera(JUNZI_MAP)
    expect(new Vector3(0, 0, -20).project(camera).y).toBeGreaterThan(new Vector3(0, 0, 20).project(camera).y)
    expect(new Vector3(20, 0, 0).project(camera).x).toBeGreaterThan(new Vector3(-20, 0, 0).project(camera).x)
  })
})
