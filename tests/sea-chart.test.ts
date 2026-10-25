import { describe, expect, it } from 'vitest'
import { emptyProgress } from '../src/game/progress'
import { getPortState, renderSeaChart } from '../src/ui/sea-chart'

describe('sea chart group portrait', () => {
  it('keeps ten selectable ports in chapter order with honest states', () => {
    const progress = emptyProgress()
    const html = renderSeaChart(progress, 'junzi')

    expect((html.match(/<button class="port /g) ?? []).length).toBe(10)
    expect(html).toMatch(/port--junzi is-open is-selected has-portrait" data-port="junzi"[^>]*aria-pressed="true"/)
    for (const id of ['daren', 'wuchang', 'heichi', 'baimin', 'shushi', 'liangmian', 'qishe', 'nver', 'penglai']) {
      expect(html).toMatch(new RegExp(`port--${id} is-locked has-portrait" data-port="${id}"`))
    }
    expect(html).toContain('待解锁。查看国家介绍')
    expect(getPortState(progress, 'junzi')).toBe('open')
    expect(getPortState(progress, 'penglai')).toBe('locked')
  })

  it('uses the painted chart and local artwork for every island without browser-rendered portraits', () => {
    const html = renderSeaChart(emptyProgress(), 'junzi')

    expect(html).toContain('class="sea-chart-art" src="./interface/sea-chart.webp"')
    expect(html).toContain('port--junzi is-open is-selected has-portrait')
    for (const id of ['junzi', 'daren', 'wuchang', 'heichi', 'baimin', 'shushi', 'liangmian', 'qishe', 'nver', 'penglai']) {
      expect(html).toContain(`class="island-portrait" src="./interface/map-${id}.webp"`)
    }
    expect(html).not.toContain('data:image')
    expect(html).not.toContain('island-placeholder')
  })

  it('marks a finished chapter as done and opens the next chapter', () => {
    const progress = { ...emptyProgress(), completed: ['junzi' as const] }
    const html = renderSeaChart(progress, 'junzi')
    expect(getPortState(progress, 'junzi')).toBe('done')
    expect(html).toMatch(/port--junzi is-done is-selected/)
    expect(html).toMatch(/port--daren is-open/)
  })
})
