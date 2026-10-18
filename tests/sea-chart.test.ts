import { describe, expect, it } from 'vitest'
import { emptyProgress } from '../src/game/progress'
import { getPortState, renderSeaChart } from '../src/ui/sea-chart'

describe('sea chart group portrait', () => {
  it('keeps seven selectable country buttons in chapter order with honest states', () => {
    const progress = emptyProgress()
    const html = renderSeaChart(progress, 'junzi')

    expect((html.match(/<button class="port /g) ?? []).length).toBe(7)
    expect(html).toMatch(/port--junzi is-open is-selected" data-port="junzi"[^>]*aria-pressed="true"/)
    for (const id of ['daren', 'liangmian', 'wuchang', 'baimin', 'heichi', 'penglai']) {
      expect(html).toMatch(new RegExp(`port--${id} is-soon" data-port="${id}"`))
    }
    expect(html).toContain('制作中。查看国家介绍')
    expect(getPortState(progress, 'junzi')).toBe('open')
    expect(getPortState(progress, 'penglai')).toBe('soon')
  })

  it('shows an image only for safe ephemeral raster data URLs and retains a visible SVG fallback', () => {
    const portrait = 'data:image/png;base64,iVBORw0KGgo='
    const html = renderSeaChart(emptyProgress(), 'junzi', { junzi: portrait, daren: 'javascript:alert(1)' })

    expect(html).toContain('port--junzi is-open is-selected has-portrait')
    expect(html).toContain(`src="${portrait}"`)
    expect(html).toContain('class="island-placeholder"')
    expect(html).not.toContain('javascript:alert')
  })

  it('marks a finished chapter as done without calling unfinished stories open', () => {
    const progress = { ...emptyProgress(), completed: ['junzi' as const] }
    const html = renderSeaChart(progress, 'junzi')
    expect(getPortState(progress, 'junzi')).toBe('done')
    expect(html).toMatch(/port--junzi is-done is-selected/)
    expect(html).toMatch(/port--daren is-soon/)
  })
})
