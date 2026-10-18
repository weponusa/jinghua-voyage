import { CHAPTER_ORDER, isCompleted, isPlayable, isUnlocked, type ChapterId, type Progress } from '../game/progress'
import { CHAPTERS } from '../game/story'

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!)

/** Visual status is deliberately derived from game progress, never from map layout. */
export type PortState = 'done' | 'open' | 'soon'

export const PORT_STATE_COPY: Record<PortState, string> = {
  done: '已完成',
  open: '已开放',
  soon: '制作中',
}

export function getPortState(progress: Progress, id: ChapterId): PortState {
  if (isCompleted(progress, id)) return 'done'
  return isPlayable(id) && isUnlocked(progress, id) ? 'open' : 'soon'
}

/**
 * Thumbnails are ephemeral PNG data URLs produced in the browser. Restricting the accepted
 * scheme means a malformed or persisted value cannot become executable markup in this template.
 */
const safePortrait = (value: string | undefined): string | null => {
  if (!value) return null
  const candidate = value.trim()
  return /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(candidate) ? candidate : null
}

const landmarkFor = (id: ChapterId): string => {
  switch (id) {
    case 'junzi': return '<path d="M62 65V42h36v23M57 65h46M62 42h36l-6-12H68Z M71 42v-8m18 8v-8"/>'
    case 'daren': return '<path d="M69 66V28h22v38M64 66h32M68 28l12-15 12 15M74 39h12m-12 11h12m-12 11h12"/>'
    case 'liangmian': return '<path d="M54 66 72 34l13 20 12-27 20 39M54 66h63M72 34l-5 14 11-3m19-18-6 18 12-5"/>'
    case 'wuchang': return '<path d="M66 65V42c0-13 28-13 28 0v23M62 65h36M74 42V30h12v12M77 57c-5-6 3-10 0-16m7 16c5-6-3-10 0-16"/>'
    case 'baimin': return '<path d="M57 66V43h47v23M52 66h57M56 43l25-17 25 17M65 46v-9m12 9v-9m12 9v-9m-7 29V51h9v15"/>'
    case 'heichi': return '<path d="M69 66V35h24v31M64 66h34M67 35l14-16 14 16M74 41h14v13H74zM81 19V8"/>'
    case 'penglai': return '<path d="M52 67 72 28l12 23 13-33 22 49M52 67h67M72 28l-5 16 10-5m20-21-6 20 12-7"/>'
  }
}

/** A compact illustrated fallback, kept visible while browser-generated portraits are loading. */
export function renderIslandPlaceholder(id: ChapterId): string {
  const chapter = CHAPTERS[id]
  const { sky, water, grass, sand, accent } = chapter.palette
  const cliff = `cliff-${id}`
  const glow = `glow-${id}`
  return `<svg class="island-placeholder" viewBox="0 0 160 110" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${cliff}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sand}"/><stop offset="1" stop-color="#47665c"/></linearGradient>
      <radialGradient id="${glow}" cx="50%" cy="16%" r="70%"><stop stop-color="${sky}" stop-opacity=".94"/><stop offset="1" stop-color="${water}" stop-opacity=".16"/></radialGradient>
      <pattern id="grain-${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M1 0v8" stroke="#173f40" stroke-opacity=".18" stroke-width="1"/></pattern>
    </defs>
    <rect width="160" height="110" fill="${water}"/><rect width="160" height="110" fill="url(#${glow})"/>
    <g fill="none" stroke="#dbebd7" stroke-opacity=".42" stroke-width="1.15"><path d="M-8 24c17-8 30 8 47 0s31 7 48-2 31 7 48-1 29 5 35-1"/><path d="M-12 92c18-9 31 7 49-1s32 7 50-2 31 7 48-1 27 5 37-2"/></g>
    <ellipse cx="82" cy="76" rx="54" ry="15" fill="#d8ece0" fill-opacity=".58"/>
    <path d="M35 66c4-18 24-30 47-30s43 12 47 30l-13 25c-12 8-58 8-70 0Z" fill="url(#${cliff})" stroke="#31574f" stroke-width="1.4"/>
    <path d="M35 66c5-18 24-30 47-30s42 12 47 30c-13 11-79 11-94 0Z" fill="${grass}" stroke="#31574f" stroke-width="1.25"/>
    <path d="M45 67c19 7 52 7 73-1M48 76c19 7 44 7 66-1" fill="none" stroke="#f6ebc9" stroke-opacity=".44" stroke-width="1.2"/>
    <path d="M35 66c4-18 24-30 47-30s43 12 47 30l-13 25c-12 8-58 8-70 0Z" fill="url(#grain-${id})" opacity=".7"/>
    <g fill="none" stroke="#f6efd5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${landmarkFor(id)}</g>
    <circle cx="126" cy="24" r="5" fill="${accent}" fill-opacity=".78"/><path d="M119 24h14M126 17v14" stroke="#f8efcf" stroke-opacity=".72" stroke-width="1"/>
  </svg>`
}

const flowerMark = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(60 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(120 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(180 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(240 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(300 12 12)"/></g><circle cx="12" cy="12" r="1.9" fill="#f5edd9"/></svg>`

const seaBackdrop = `<svg class="sea-chart-backdrop" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs><pattern id="chart-wave-grain" width="34" height="26" patternUnits="userSpaceOnUse"><path d="M-4 15c8-5 16-5 24 0s16 5 24 0" fill="none" stroke="#d3e7d6" stroke-opacity=".22" stroke-width="1"/></pattern></defs>
  <rect width="1000" height="620" fill="url(#chart-wave-grain)"/>
  <g fill="none" stroke="#f4df9d" stroke-opacity=".42" stroke-width="1"><path d="M54 112C164 74 222 151 332 113s177 36 281-4 181 31 322-35"/><path d="M-10 471c106-33 169 42 272 5s171 41 281 1 183 30 292-12"/></g>
  <g fill="#f8e8ab" fill-opacity=".74"><circle cx="72" cy="74" r="2"/><circle cx="212" cy="148" r="1.5"/><circle cx="458" cy="65" r="2"/><circle cx="698" cy="123" r="1.4"/><circle cx="918" cy="77" r="2"/><circle cx="862" cy="507" r="1.5"/><circle cx="126" cy="522" r="2"/></g>
  <path d="M96 550C224 421 299 488 418 390S634 375 752 274s157-58 192-157" fill="none" stroke="#d9915e" stroke-opacity=".52" stroke-width="2" stroke-dasharray="5 11"/>
</svg>`

const portHtml = (progress: Progress, id: ChapterId, selected: ChapterId, portraits?: Partial<Record<ChapterId, string>>): string => {
  const chapter = CHAPTERS[id]
  const state = getPortState(progress, id)
  const status = PORT_STATE_COPY[state]
  const isSelected = id === selected
  const portrait = safePortrait(portraits?.[id])
  const selectionCopy = isSelected ? '，当前选中' : ''
  const source = portrait ? ` src="${esc(portrait)}"` : ''
  return `<button class="port port--${id} is-${state}${isSelected ? ' is-selected' : ''}${portrait ? ' has-portrait' : ''}" data-port="${id}" data-state="${state}" aria-label="${esc(chapter.name)}，第${esc(chapter.order)}章，${status}${selectionCopy}。查看国家介绍" aria-pressed="${isSelected}">
    <span class="port-visual" aria-hidden="true">
      <img class="island-portrait"${source} alt="" decoding="async" />
      ${renderIslandPlaceholder(id)}
      <span class="port-seal">${state === 'done' ? flowerMark : `<i>${esc(chapter.order)}</i>`}</span>
    </span>
    <span class="port-caption"><span class="port-order">${chapter.order === '终' ? '终章' : `第${esc(chapter.order)}章`}</span><b class="port-name">${esc(chapter.name)}</b><small class="port-state">${status}</small></span>
  </button>`
}

/**
 * Renders the seven-country group portrait placed in `.chart-sea`.
 * The optional portraits are temporary browser-only data URLs; callers own their lifecycle.
 */
export function renderSeaChart(progress: Progress, selected: ChapterId, portraits?: Partial<Record<ChapterId, string>>): string {
  const selectedChapter = CHAPTERS[selected]
  const selectedState = getPortState(progress, selected)
  return `<section class="sea-chart-canvas" aria-label="七国群岛航海图">
    ${seaBackdrop}
    <div class="sea-chart-masthead" aria-hidden="true"><span>镜花海路</span><i></i><small>七国画卷</small></div>
    <div class="sea-chart-ports" role="group" aria-label="海外七国，选择一国查看介绍">${CHAPTER_ORDER.map(id => portHtml(progress, id, selected, portraits)).join('')}</div>
    <p class="sea-chart-caption"><span class="sea-chart-status-mark is-${selectedState}"></span><b>${esc(selectedChapter.name)}</b><span>${PORT_STATE_COPY[selectedState]} · ${esc(selectedChapter.tagline)}</span></p>
  </section>`
}
