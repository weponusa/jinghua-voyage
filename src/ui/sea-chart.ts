import { CHAPTER_ORDER, isCompleted, isUnlocked, type ChapterId, type Progress } from '../game/progress'
import { CHAPTERS } from '../game/story'

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!)

/** Visual status is deliberately derived from game progress, never from map layout. */
export type PortState = 'done' | 'open' | 'locked'

export const PORT_STATE_COPY: Record<PortState, string> = {
  done: '已完成',
  open: '已开放',
  locked: '待解锁',
}

export function getPortState(progress: Progress, id: ChapterId): PortState {
  if (isCompleted(progress, id)) return 'done'
  return isUnlocked(progress, id) ? 'open' : 'locked'
}

export const islandArtwork = (id: ChapterId): string => `/interface/map-${id}.webp`

const flowerMark = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(60 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(120 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(180 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(240 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(300 12 12)"/></g><circle cx="12" cy="12" r="1.9" fill="#f5edd9"/></svg>`

const portHtml = (progress: Progress, id: ChapterId, selected: ChapterId): string => {
  const chapter = CHAPTERS[id]
  const state = getPortState(progress, id)
  const status = PORT_STATE_COPY[state]
  const isSelected = id === selected
  const selectionCopy = isSelected ? '，当前选中' : ''
  return `<button class="port port--${id} is-${state}${isSelected ? ' is-selected' : ''} has-portrait" data-port="${id}" data-state="${state}" aria-label="${esc(chapter.name)}，第${esc(chapter.order)}章，${status}${selectionCopy}。查看国家介绍" aria-pressed="${isSelected}">
    <span class="port-visual" aria-hidden="true">
      <img class="island-portrait" src="${islandArtwork(id)}" alt="" decoding="async" />
      <span class="port-seal">${state === 'done' ? flowerMark : `<i>${esc(chapter.order)}</i>`}</span>
    </span>
    <span class="port-caption"><span class="port-order">${chapter.order === '终' ? '终章' : `第${esc(chapter.order)}章`}</span><b class="port-name">${esc(chapter.name)}</b><small class="port-state">${status}</small></span>
  </button>`
}

/** Generated artwork supplies the painting; real HTML controls retain selection and progress. */
export function renderSeaChart(progress: Progress, selected: ChapterId): string {
  const selectedChapter = CHAPTERS[selected]
  const selectedState = getPortState(progress, selected)
  return `<section class="sea-chart-canvas" aria-label="七国群岛航海图">
    <img class="sea-chart-art" src="/interface/sea-chart.webp" alt="" decoding="async" />
    <svg class="sea-chart-backdrop" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M96 550C224 421 299 488 418 390S634 375 752 274s157-58 192-157" fill="none" stroke="#f4d58f" stroke-opacity=".3" stroke-width="2" stroke-dasharray="5 11"/></svg>
    <div class="sea-chart-masthead" aria-hidden="true"><span>镜花海路</span><i></i><small>七国画卷</small></div>
    <div class="sea-chart-ports" role="group" aria-label="海外七国，选择一国查看介绍">${CHAPTER_ORDER.map(id => portHtml(progress, id, selected)).join('')}</div>
    <p class="sea-chart-caption"><span class="sea-chart-status-mark is-${selectedState}"></span><b>${esc(selectedChapter.name)}</b><span>${PORT_STATE_COPY[selectedState]} · ${esc(selectedChapter.tagline)}</span></p>
  </section>`
}
