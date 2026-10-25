import type { ChapterId } from './progress'

/** Static chapter metadata shown on the sea chart, seals and ending scroll. */
export type ChapterMeta = {
  id: ChapterId
  name: string
  tagline: string
  blurb: string
  moral: string
  order: string
  kind: 'flower' | 'story' | 'finale'
  chart: { x: number; y: number }
  palette: { sky: string; horizon: string; fog: string; water: string; grass: string; sand: string; accent: string }
}

export const CHAPTERS: Record<ChapterId, ChapterMeta> = {
  junzi: {
    id: 'junzi', order: '一', name: '君子国', tagline: '好让不争', kind: 'flower',
    blurb: '国中之人，衣冠整齐，买卖之间竟是卖家嫌价高、买家嫌价低。',
    moral: '让一步，天地宽。', chart: { x: 12, y: 64 },
    palette: { sky: '#8fc3c9', horizon: '#f2e6c9', fog: '#e9e2c8', water: '#3f8a93', grass: '#7fb27a', sand: '#e8d6a8', accent: '#3e8e7e' },
  },
  daren: {
    id: 'daren', order: '二', name: '大人国', tagline: '云随心生', kind: 'flower',
    blurb: '国人足下皆生云彩。心地光明者，脚踏彩云；心怀奸恶者，足下乌云。',
    moral: '心之善恶，藏不住，遮不了。', chart: { x: 22, y: 34 },
    palette: { sky: '#a7c4e0', horizon: '#f6eedb', fog: '#e6e8e4', water: '#4c7fa8', grass: '#8cbc86', sand: '#efe0b8', accent: '#7b5ea7' },
  },
  wuchang: {
    id: 'wuchang', order: '三', name: '无肠国', tagline: '食而即过', kind: 'flower',
    blurb: '国人腹中无肠，吃下即过。富家却把剩饭留给仆人，一粒不肯多给。',
    moral: '吝于人者，终亦空空。', chart: { x: 32, y: 66 },
    palette: { sky: '#b9c7a8', horizon: '#f1e8cf', fog: '#e4e3cc', water: '#4f8c7c', grass: '#a3b56f', sand: '#ead9a6', accent: '#b0752f' },
  },
  heichi: {
    id: 'heichi', order: '四', name: '黑齿国', tagline: '才女如云', kind: 'flower',
    blurb: '国人面黑齿黑，貌不惊人，女学塾里的才女却个个满腹经纶。',
    moral: '不可以貌取人。', chart: { x: 42, y: 30 },
    palette: { sky: '#9fb3c8', horizon: '#efe3cf', fog: '#dcdcd6', water: '#3e6d8c', grass: '#6f9f78', sand: '#dccb9c', accent: '#2e5e8c' },
  },
  baimin: {
    id: 'baimin', order: '五', name: '白民国', tagline: '衣冠楚楚', kind: 'flower',
    blurb: '国人肤白如玉，衣冠如雪。塾中先生摇头晃脑，书却念得颠三倒四。',
    moral: '学问不在衣冠；知之为知之，不知为不知。', chart: { x: 52, y: 64 },
    palette: { sky: '#c8d6dd', horizon: '#f7f3ea', fog: '#eef0ee', water: '#5f8ea3', grass: '#9cc0a0', sand: '#efe6cd', accent: '#6f8fa8' },
  },
  shushi: {
    id: 'shushi', order: '六', name: '淑士国', tagline: '酸文困人', kind: 'story',
    blurb: '满街之乎者也，酒保也要掉书袋。唐敖在酒楼遇见徐承志，才知道雅言也能成为困人的墙。',
    moral: '言辞漂亮，不如行事正直。', chart: { x: 60, y: 30 },
    palette: { sky: '#aeb8b0', horizon: '#e8e2d1', fog: '#d9d8c9', water: '#587a78', grass: '#89966d', sand: '#d9cba9', accent: '#677a64' },
  },
  liangmian: {
    id: 'liangmian', order: '七', name: '两面国', tagline: '巾后藏面', kind: 'flower',
    blurb: '人人头戴浩然巾，前面一张笑脸，巾后却藏着另一张脸。',
    moral: '观人须观其背后，不可只看笑脸。', chart: { x: 68, y: 68 },
    palette: { sky: '#c9b2a0', horizon: '#f3e2cc', fog: '#e8d8c6', water: '#5a7f86', grass: '#97a96e', sand: '#e6cfa2', accent: '#c8412f' },
  },
  qishe: {
    id: 'qishe', order: '八', name: '歧舌国', tagline: '音中有义', kind: 'story',
    blurb: '药香与灯影满街，国人谈字母、辨音韵。多九公在这里救人，也重新学着承认不知。',
    moral: '知有所长，也知有所不知。', chart: { x: 78, y: 32 },
    palette: { sky: '#c9aa91', horizon: '#f2dfc4', fog: '#e7d4bd', water: '#5b7d83', grass: '#9a9b68', sand: '#e2c89d', accent: '#b65d42' },
  },
  nver: {
    id: 'nver', order: '九', name: '女儿国', tagline: '易地而处', kind: 'story',
    blurb: '女子治外，男子治内。林之洋被强留入宫，唐敖揭榜治河，两人隔着宫墙寻找出路。',
    moral: '身受其困，才知人之所困。', chart: { x: 86, y: 66 },
    palette: { sky: '#b8c8c1', horizon: '#f2e4d8', fog: '#e4ded4', water: '#4f8490', grass: '#82a281', sand: '#e3cfad', accent: '#a85e72' },
  },
  penglai: {
    id: 'penglai', order: '终', name: '小蓬莱', tagline: '镜花水月', kind: 'finale',
    blurb: '海上仙山，云气缭绕。六枚镜花在镜台相聚，海外见闻也终于有了回响。',
    moral: '镜中之花，水中之月；所见所历，皆在一心。', chart: { x: 94, y: 38 },
    palette: { sky: '#e8c9cf', horizon: '#fbf0e4', fog: '#f3e6e4', water: '#6a92a8', grass: '#9fc28d', sand: '#f0dfc0', accent: '#d96a8a' },
  },
}

export const HUB_PALETTE = { sky: '#86b9c4', horizon: '#f3e8cc', fog: '#e7e1c8', water: '#3b7f8f', grass: '#7fb27a', sand: '#e8d6a8', accent: '#3e8e7e' }
