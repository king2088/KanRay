import { h } from 'vue'

const svg = (children) => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.7,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}, children)

// ① 九宫格单元格：框 + 点
const cell = (cx, cy) => () => svg([
  h('rect', { x: 3.2, y: 3.2, width: 17.6, height: 17.6, rx: 3, fill: 'none' }),
  h('circle', { cx, cy, r: 2.1, fill: 'currentColor', stroke: 'none' }),
])
const XS = [7, 12, 17], YS = [7, 12, 17]
export const posTopLeft = cell(XS[0], YS[0])
export const posTopCenter = cell(XS[1], YS[0])
export const posTopRight = cell(XS[2], YS[0])
export const posMidLeft = cell(XS[0], YS[1])
export const posMidCenter = cell(XS[1], YS[1])
export const posMidRight = cell(XS[2], YS[1])
export const posBotLeft = cell(XS[0], YS[2])
export const posBotCenter = cell(XS[1], YS[2])
export const posBotRight = cell(XS[2], YS[2])

// ② 方向：三格方块
const blk = (x, y, op) => h('rect', { x, y, width: 4.6, height: 5.6, rx: 1.2, fill: 'currentColor', stroke: 'none', opacity: op })
export const dirH = () => svg([blk(3.5, 9.2, 1), blk(9.7, 9.2, 0.6), blk(15.9, 9.2, 0.28)])
export const dirV = () => svg([blk(9.2, 3.5, 1), blk(9.2, 9.7, 0.6), blk(9.2, 15.9, 0.28)])

// ③ 数据标签位置：柱子 + 点
const bar = () => h('rect', { x: 7, y: 9.2, width: 10, height: 5.6, rx: 1.5, fill: 'currentColor', stroke: 'none', opacity: 0.85 })
const dot = (cx, cy, fill = 'currentColor') => h('circle', { cx, cy, r: 2, fill, stroke: 'none' })
export const lblTop = () => svg([bar(), dot(12, 4.6)])
export const lblBot = () => svg([bar(), dot(12, 19.4)])
export const lblLeft = () => svg([bar(), dot(4.6, 12)])
export const lblRight = () => svg([bar(), dot(19.4, 12)])
export const lblIn = () => svg([bar(), dot(12, 12, '#fff')])

// ④ 饼图标签：圆 + 点
const ring = () => h('circle', { cx: 11.5, cy: 12, r: 7 })
export const pieOut = () => svg([ring(), dot(20, 12)])
export const pieIn = () => svg([ring(), dot(14.6, 15.4)])
export const pieCenter = () => svg([ring(), dot(11.5, 12)])
