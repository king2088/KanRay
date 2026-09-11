import { h } from 'vue'

const svg = (children) => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.7,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}, children)

// ① 九宫格单元格：按方位偏移的实心点（位置由点所在格内角落表达 + 3×3 网格本身）
const posDotAt = (cx, cy) => () => svg([
  h('circle', { cx, cy, r: 4.2, fill: 'currentColor', stroke: 'none' }),
])
const PX = [5, 12, 19], PY = [5, 12, 19] // left/center/right · top/middle/bottom
export const posTopLeft = posDotAt(PX[0], PY[0])
export const posTopCenter = posDotAt(PX[1], PY[0])
export const posTopRight = posDotAt(PX[2], PY[0])
export const posMidLeft = posDotAt(PX[0], PY[1])
export const posMidCenter = posDotAt(PX[1], PY[1])
export const posMidRight = posDotAt(PX[2], PY[1])
export const posBotLeft = posDotAt(PX[0], PY[2])
export const posBotCenter = posDotAt(PX[1], PY[2])
export const posBotRight = posDotAt(PX[2], PY[2])

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

// ⑤ 图例对齐：文本行对齐预览
export const alignAuto = () => svg([
  h('path', { d: 'M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3' }),
])
const ln = (x1, y, x2) => h('line', { x1, y1: y, x2, y2: y })
export const alignLeft = () => svg([ln(3, 5, 18), ln(3, 9, 14), ln(3, 13, 17), ln(3, 17, 11)])
export const alignCenter = () => svg([ln(5, 5, 19), ln(3, 9, 21), ln(6, 13, 18), ln(8, 17, 16)])
export const alignRight = () => svg([ln(6, 5, 21), ln(10, 9, 21), ln(7, 13, 21), ln(13, 17, 21)])
