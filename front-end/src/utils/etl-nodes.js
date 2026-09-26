// ETL 节点元数据的唯一来源。
// 此前 EtlBuilderTab 的 NODE_META 与 EtlNodeCard 的 NODE_ICON/NODE_TITLE
// 各维护一份中文名与缩写，节点类型一增就漏改；现统一由词典驱动。
// 颜色属于视觉常量，不进词典；label/short 按语言取自 dataset.etl.node.*。
// 纯模块：走 tr 并用相对路径引入，保证 node 测试脚本可直接 import。
import { tr } from '../i18n/translate.js'

const KEY = 'dataset.etl.node.'

const DEFS = [
  { type: 'source', color: '#67c23a' },
  { type: 'join', color: '#909399' },
  { type: 'filter', color: '#e6a23c' },
  { type: 'columnSelect', color: '#9b59b6' },
  { type: 'dedup', color: '#1abc9c' },
  { type: 'valueReplace', color: '#e67e22' },
  { type: 'nullReplace', color: '#e74c3c' },
  { type: 'trim', color: '#3498db' },
  { type: 'sqlNode', color: '#34495e' },
  { type: 'aggregate', color: '#409eff' },
  { type: 'output', color: '#f56c6c' },
]

// 调色板与自动布局共用的节点顺序（不含 output，output 恒在链尾）。
export const ETL_NODE_ORDER = DEFS.filter((d) => d.type !== 'output').map((d) => d.type)

const BY_TYPE = new Map(DEFS.map((d) => [d.type, d]))

export function etlNodeColor(type) {
  return BY_TYPE.get(type)?.color || '#409eff'
}

export function etlNodeLabel(type) {
  return BY_TYPE.has(type) ? tr(`${KEY}${type}.label`) : String(type ?? '')
}

export function etlNodeShort(type) {
  return BY_TYPE.has(type) ? tr(`${KEY}${type}.short`) : ''
}
