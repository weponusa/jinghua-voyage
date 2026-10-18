import { CHAPTER_ORDER, isCompleted, isPlayable, isUnlocked, type ChapterId, type Progress } from '../game/progress'
import { CHAPTERS } from '../game/story'

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)

type PortState = 'done' | 'open' | 'soon'

const stateFor = (progress: Progress, id: ChapterId): PortState => {
  if (isCompleted(progress, id)) return 'done'
  return isPlayable(id) && isUnlocked(progress, id) ? 'open' : 'soon'
}

const stateCopy: Record<PortState, string> = {
  done: '已完成',
  open: '已开放',
  soon: '制作中',
}

const flowerMark = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(60 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(120 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(180 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(240 12 12)"/><ellipse cx="12" cy="7.2" rx="2.1" ry="3.45" transform="rotate(300 12 12)"/></g><circle cx="12" cy="12" r="1.9" fill="#f5edd9"/></svg>`

/**
 * A static hand-drawn chart layer. The SVG is intentionally decorative only; the seven HTML
 * buttons remain positioned from CHAPTERS.chart so their interactive centers retain game data.
 */
const mapSvg = `
<svg class="sea-chart-svg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sea-chart-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d7e8df"/><stop offset=".42" stop-color="#b7d7d0"/><stop offset="1" stop-color="#88b9bc"/>
    </linearGradient>
    <radialGradient id="sea-chart-wash" cx="50%" cy="42%" r="72%"><stop offset="0" stop-color="#edf0d8" stop-opacity=".45"/><stop offset="1" stop-color="#4b8991" stop-opacity=".16"/></radialGradient>
    <linearGradient id="sea-chart-sand" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f6e8c2"/><stop offset="1" stop-color="#d9bd80"/></linearGradient>
    <linearGradient id="sea-chart-land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b4c987"/><stop offset="1" stop-color="#6e9a74"/></linearGradient>
    <filter id="sea-chart-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#315c5d" flood-opacity=".25"/></filter>
    <pattern id="sea-chart-paper" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="5" cy="9" r=".8" fill="#6b776e" opacity=".12"/><path d="M1 26c9-4 18-3 31 1" fill="none" stroke="#547b7b" stroke-width=".6" opacity=".09"/></pattern>
    <pattern id="sea-chart-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M1 0v8" stroke="#405d50" stroke-width="1" opacity=".2"/></pattern>
  </defs>

  <rect width="1000" height="700" fill="url(#sea-chart-water)"/>
  <rect width="1000" height="700" fill="url(#sea-chart-wash)"/>
  <rect width="1000" height="700" fill="url(#sea-chart-paper)"/>

  <g class="sea-chart-waves">
    <path d="M-45 104C35 72 83 130 158 98s120-3 190 18 123-9 193-42 133-16 201 11 132 21 302-32"/>
    <path d="M-28 128c76-31 125 21 197-6s112-8 175 10 112-5 182-36 128-20 195 11 133 20 281-31"/>
    <path d="M-38 346c56-23 98-17 147 3s98 20 148-5 113-24 174 0 126 23 188-8 131-30 210-1 127 20 206-5"/>
    <path d="M-12 371c59-22 104-17 151 5s96 19 146-7 113-20 174 4 121 21 181-11 133-27 208 0 124 17 196-7"/>
    <path d="M-58 603c86-35 143 21 229-5s131-19 205 10 137 10 205-15 143-25 216 5 137 19 245-17"/>
    <path d="M-43 629c79-30 141 19 218-8s134-18 207 9 135 13 202-13 140-24 215 3 139 15 246-13"/>
    <path class="sea-chart-wave-fine" d="M64 213c30-15 52-13 77 1s48 14 73-3M707 104c22-10 41-9 61 2s41 11 66-4M496 619c22-12 43-12 65 1s44 12 70-4M793 468c25-13 48-11 71 3s44 11 67-4"/>
    <path class="sea-chart-wave-fine" d="M51 542c20-10 40-9 59 2s39 10 59-3M367 149c19-10 40-9 58 2s38 11 61-3M710 613c18-9 38-8 55 2s35 10 55-3"/>
  </g>

  <path class="sea-chart-route" d="M78 603 C113 568 132 508 180 448 S277 351 330 266 S422 396 470 490 S544 351 600 210 S681 308 740 406 S795 299 840 210 S874 413 900 532"/>
  <g class="sea-chart-route-stars"><circle cx="78" cy="603" r="5"/><circle cx="180" cy="448" r="4"/><circle cx="330" cy="266" r="4"/><circle cx="470" cy="490" r="4"/><circle cx="600" cy="210" r="4"/><circle cx="740" cy="406" r="4"/><circle cx="840" cy="210" r="4"/><circle cx="900" cy="532" r="4"/></g>

  <!-- 君子国：牌坊、让利集与竹影 -->
  <g class="sea-chart-island sea-chart-island--junzi" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-reef" d="M105 461c-9-38 14-79 49-94 25-11 66-7 91 15 33 29 25 85-5 106-40 29-111 22-135-27Z"/>
    <path class="sea-chart-sand" d="M119 461c-5-29 19-67 48-75 31-9 66 7 79 29 17 30-4 72-34 87-36 18-86-3-93-41Z"/>
    <path class="sea-chart-land" d="M130 459c2-25 24-54 50-59 30-5 57 12 62 38 7 31-18 58-47 65-31 7-67-13-65-44Z"/>
    <path d="M137 476c24-12 72-13 96-1" class="sea-chart-path"/><path d="M153 428c22 7 46 7 66-2" class="sea-chart-path"/>
    <g class="sea-chart-bamboo"><path d="M148 446v-37m8 39v-49m8 48v-35"/><path d="M148 417l-10-8m10 16 11-8m-3-9 10-7m-10 18-11-7m19 3 11-8"/></g>
    <g class="sea-chart-arch"><path d="M181 471v-27h35v27m-41 0h47M181 443h35l-5-11h-25zM190 444v-8m17 8v-8"/><path d="M177 459h43"/></g>
    <g class="sea-chart-market"><path d="M203 481h31M207 481v-13h23v13"/><path d="M205 468l7-9 7 9 7-9 7 9"/><circle cx="211" cy="485" r="2"/><circle cx="228" cy="485" r="2"/></g>
    <path class="sea-chart-hatch" d="M130 459c2-25 24-54 50-59 30-5 57 12 62 38 7 31-18 58-47 65-31 7-67-13-65-44Z"/>
  </g>

  <!-- 大人国：云阶与高楼 -->
  <g class="sea-chart-island sea-chart-island--daren" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-cloud-bank" d="M258 278c-22-18-10-48 16-49 8-31 51-37 68-12 28-16 59 9 51 37 23 18 4 55-22 52-20 22-61 20-76-2-20 7-42-7-37-26Z"/>
    <path class="sea-chart-reef" d="M267 278c-5-42 27-84 69-93 38-8 76 15 87 49 15 44-20 92-62 100-44 9-89-14-94-56Z"/>
    <path class="sea-chart-sand" d="M277 279c0-36 28-72 63-78 34-6 67 15 75 48 9 36-19 73-52 83-37 10-86-12-86-53Z"/>
    <path class="sea-chart-land" d="M286 280c5-30 31-59 59-62 31-3 57 17 62 43 6 31-19 59-46 66-32 8-79-14-75-47Z"/>
    <path d="M297 301c27-11 72-12 99-1" class="sea-chart-path"/>
    <g class="sea-chart-tower"><path d="M335 298v-57h30v57M330 299h41M337 240l13-19 13 19M342 253h16m-16 12h16m-16 12h16"/><path d="M350 221v-19m0 0 6 8m-6-8-6 8"/></g>
    <g class="sea-chart-small-cloud"><path d="M294 234c0-10 13-15 20-8 7-9 23-3 22 8 13 1 15 17 3 20h-35c-13-1-15-16-10-20Z"/><path d="M371 313c0-8 10-11 16-6 6-7 19-2 18 7 11 1 12 14 2 16h-27c-11-1-12-13-9-17Z"/></g>
    <path class="sea-chart-hatch" d="M286 280c5-30 31-59 59-62 31-3 57 17 62 43 6 31-19 59-46 66-32 8-79-14-75-47Z"/>
  </g>

  <!-- 两面国：相背双峰与谷地 -->
  <g class="sea-chart-island sea-chart-island--liangmian" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-reef" d="M398 505c-13-41 11-88 51-105 42-18 92 1 112 39 20 40-4 88-42 108-44 23-108 7-121-42Z"/>
    <path class="sea-chart-sand" d="M410 503c-9-35 14-77 48-89 38-14 80 3 94 36 16 36-5 78-38 94-38 18-93 2-104-41Z"/>
    <path class="sea-chart-land" d="M419 501c-2-29 21-67 51-76 35-11 70 8 78 39 8 33-16 67-46 78-36 13-80-5-83-41Z"/>
    <path class="sea-chart-valley" d="M438 508c19-38 32-65 49-80 19 20 27 46 46 86"/>
    <g class="sea-chart-double-mountain"><path d="M430 505l38-65 23 39 18-26 30 53"/><path d="M468 440l-8 21 16-4m33-4-8 21 16-4"/><path d="M442 501h84"/></g>
    <g class="sea-chart-masks"><path d="M450 484c-9-10-8-26 4-34 15 5 18 22 8 34-4 5-8 5-12 0Z"/><circle cx="450" cy="466" r="1.7"/><circle cx="457" cy="466" r="1.7"/><path d="M513 484c9-10 8-26-4-34-15 5-18 22-8 34 4 5 8 5 12 0Z"/><circle cx="513" cy="466" r="1.7"/><circle cx="506" cy="466" r="1.7"/></g>
    <path class="sea-chart-hatch" d="M419 501c-2-29 21-67 51-76 35-11 70 8 78 39 8 33-16 67-46 78-36 13-80-5-83-41Z"/>
  </g>

  <!-- 无肠国：暖炉、炊烟与梯田 -->
  <g class="sea-chart-island sea-chart-island--wuchang" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-reef" d="M518 224c-12-43 15-91 57-108 46-19 101 2 121 44 17 38-2 86-38 106-45 25-124 12-140-42Z"/>
    <path class="sea-chart-sand" d="M530 224c-8-36 17-79 53-94 40-16 88 2 103 38 16 38-4 79-38 95-41 20-107 7-118-39Z"/>
    <path class="sea-chart-land" d="M541 224c-3-31 20-69 52-81 37-14 78 5 88 36 12 34-10 70-42 84-37 16-94 2-98-39Z"/>
    <path d="M553 242c27-18 70-24 111-14M553 252c31-12 72-15 107-7" class="sea-chart-terrace"/>
    <g class="sea-chart-stove"><path d="M603 242v-31c0-14 40-14 40 0v31zM598 242h50M615 210v-14h16v14"/><path d="M623 232c-8-8 3-14 0-21m7 20c8-8-3-14 0-21"/></g>
    <g class="sea-chart-smoke"><path d="M623 191c-11-12 9-18-2-30-9-11 9-16 2-28M637 192c11-12-9-18 2-30 9-11-9-16 2-28"/></g>
    <path class="sea-chart-hatch" d="M541 224c-3-31 20-69 52-81 37-14 78 5 88 36 12 34-10 70-42 84-37 16-94 2-98-39Z"/>
  </g>

  <!-- 白民国：书院、松与书卷 -->
  <g class="sea-chart-island sea-chart-island--baimin" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-reef" d="M660 414c-8-43 27-82 66-91 48-12 97 19 103 65 5 42-28 82-67 89-48 8-94-19-102-63Z"/>
    <path class="sea-chart-sand" d="M672 414c-3-36 27-70 62-77 39-8 79 16 84 53 5 38-25 72-60 78-39 7-82-17-86-54Z"/>
    <path class="sea-chart-land sea-chart-pale-land" d="M683 413c2-31 28-60 59-64 34-4 66 17 70 48 4 33-22 62-52 68-36 7-80-17-77-52Z"/>
    <path d="M698 432c25-12 72-11 99 2" class="sea-chart-path"/>
    <g class="sea-chart-academy"><path d="M716 432v-34h55v34M709 433h69M713 398l30-20 30 20M723 402v-11m14 11v-11m14 11v-11m14 11v-11M739 432v-18h9v18"/><path d="M710 437h66"/></g>
    <g class="sea-chart-pine"><path d="M702 431v-39m0 11-16 13h32m-35 5 19-16 19 16m-14-31 11 13h-22"/></g>
    <g class="sea-chart-book"><path d="M778 425c8-5 16-4 21 2v15c-6-6-14-6-21-2zm0 0c-8-5-16-4-21 2v15c6-6 14-6 21-2z"/></g>
    <path class="sea-chart-hatch" d="M683 413c2-31 28-60 59-64 34-4 66 17 70 48 4 33-22 62-52 68-36 7-80-17-77-52Z"/>
  </g>

  <!-- 黑齿国：灯亭与石崖 -->
  <g class="sea-chart-island sea-chart-island--heichi" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-reef" d="M755 222c-7-43 24-86 66-98 44-14 94 9 111 48 18 43-7 93-48 109-44 18-120-8-129-59Z"/>
    <path class="sea-chart-sand" d="M767 221c-3-36 25-75 62-84 38-10 80 10 92 45 13 39-8 78-43 91-39 15-106-8-111-51Z"/>
    <path class="sea-chart-land sea-chart-dark-land" d="M778 220c2-31 27-64 59-71 34-8 70 10 79 41 10 34-12 70-43 82-36 13-95-8-95-52Z"/>
    <path d="M789 242c26-18 70-26 108-16" class="sea-chart-path"/>
    <g class="sea-chart-lantern"><path d="M841 246v-45h28v45M835 246h40M839 201l16-18 16 18M846 207h18v16h-18zM850 212h10M855 183v-14"/><path d="M846 235h18"/></g>
    <g class="sea-chart-cliff"><path d="M790 229l12-34 10 13 10-28 12 43"/><path d="M793 230h40"/></g>
    <path class="sea-chart-hatch" d="M778 220c2-31 27-64 59-71 34-8 70 10 79 41 10 34-12 70-43 82-36 13-95-8-95-52Z"/>
  </g>

  <!-- 小蓬莱：云海、三叠仙峰与镜台 -->
  <g class="sea-chart-island sea-chart-island--penglai" filter="url(#sea-chart-shadow)">
    <path class="sea-chart-cloud-bank" d="M824 547c-20-17-10-45 14-47 6-30 48-39 67-14 28-16 56 10 49 35 26 17 8 53-18 52-17 24-60 23-77 1-16 6-35-4-35-27Z"/>
    <path class="sea-chart-reef" d="M824 543c-12-47 20-98 65-111 48-15 101 13 118 59 17 47-14 103-59 119-48 17-111-12-124-67Z"/>
    <path class="sea-chart-sand" d="M837 542c-8-40 20-86 59-98 42-13 88 12 101 53 14 42-13 88-52 102-43 15-99-11-108-57Z"/>
    <path class="sea-chart-land sea-chart-mystic-land" d="M846 541c-3-35 23-77 59-87 39-11 79 11 88 47 10 39-16 80-51 91-41 13-92-11-96-51Z"/>
    <g class="sea-chart-penglai-peaks"><path d="M860 552l37-74 20 41 20-58 37 92"/><path d="M897 478l-9 29 18-8m31-38-10 36 21-11"/><path d="M859 553h117"/></g>
    <g class="sea-chart-mirror-terrace"><path d="M893 568h55M900 568l7-22h26l7 22M910 546c0-17 20-17 20 0"/><circle cx="920" cy="535" r="8"/></g>
    <g class="sea-chart-cirrus"><path d="M851 499c15-10 31-9 46 2s29 12 45 1M858 584c16-9 33-8 48 3s30 10 45-1"/></g>
    <path class="sea-chart-hatch" d="M846 541c-3-35 23-77 59-87 39-11 79 11 88 47 10 39-16 80-51 91-41 13-92-11-96-51Z"/>
  </g>

  <g class="sea-chart-compass" transform="translate(90 125)">
    <circle r="43"/><circle r="31"/><path d="M0-53 8-8 0 0-8-8Z" class="sea-chart-compass-north"/><path d="M0 53 8 8 0 0-8 8Z"/><path d="M-53 0-8-8 0 0-8 8ZM53 0 8-8 0 0 8 8Z"/>
    <text x="0" y="-61">北</text><text x="0" y="72">南</text><text x="-68" y="5">西</text><text x="62" y="5">东</text>
  </g>

  <g class="sea-chart-vessel" transform="translate(78 603)">
    <path class="sea-chart-ship-wake" d="M-41 18c13-6 25-6 38 0s27 6 40 0M-31 28c11-5 22-5 33 0s23 5 34 0"/>
    <path class="sea-chart-ship-hull" d="M-27 7h57l-10 15H-17Z"/><path class="sea-chart-ship-deck" d="M-18 7h39l-5 6h-30Z"/>
    <path class="sea-chart-mast" d="M0 7V-49"/><path class="sea-chart-sail-main" d="M-3-45v43h-30c9-18 17-32 30-43Z"/><path class="sea-chart-sail-small" d="M4-34v34h24c-7-14-14-25-24-34Z"/>
    <text x="-23" y="45">海船 · 起点</text>
  </g>
</svg>`

const portHtml = (progress: Progress, id: ChapterId, selected: ChapterId): string => {
  const chapter = CHAPTERS[id]
  const state = stateFor(progress, id)
  const status = stateCopy[state]
  const isSelected = id === selected
  return `<button class="port port--${id} is-${state}${isSelected ? ' is-selected' : ''}" data-port="${id}" data-state="${state}" style="left:${chapter.chart.x}%;top:${chapter.chart.y}%" aria-label="${esc(chapter.name)}，${status}${isSelected ? '，当前选中' : ''}。查看国家介绍" aria-pressed="${isSelected}">
    <span class="port-pin" aria-hidden="true"><span class="port-pin-core">${state === 'done' ? flowerMark : '<i></i>'}</span></span>
    <span class="port-info"><b class="port-name">${esc(chapter.name)}</b><small class="port-state">${status}</small></span>
  </button>`
}

/** Render the visual chart inserted into `.chart-sea`; selection is controlled by the parent UI. */
export function renderSeaChart(progress: Progress, selected: ChapterId): string {
  const selectedChapter = CHAPTERS[selected]
  const selectedState = stateFor(progress, selected)
  return `<div class="sea-chart-canvas">
    ${mapSvg}
    <div class="sea-chart-status" aria-live="polite"><span class="sea-chart-status-mark is-${selectedState}"></span><b>${esc(selectedChapter.name)}</b><span>${stateCopy[selectedState]} · ${esc(selectedChapter.tagline)}</span></div>
    <p class="sea-chart-hint" aria-hidden="true">点按岛屿阅览国情</p>
    <div class="sea-chart-ports" aria-label="海外七国港口">${CHAPTER_ORDER.map(id => portHtml(progress, id, selected)).join('')}</div>
  </div>`
}
