// 数据集字段类型标签的唯一来源。
// 此前该映射在 FieldConfigPanel / ChartBuilder / DatasetDetail /
// DatasetQueryDialog 各有一份副本，且形参名 t 与翻译函数 t 撞名。
// 纯模块：走 tr 并用相对路径引入，保证 node 测试脚本可直接 import。
import { tr } from '../i18n/translate.js'

const KEYS = {
  string: 'dataset.fieldType.string',
  integer: 'dataset.fieldType.integer',
  number: 'dataset.fieldType.number',
  date: 'dataset.fieldType.date',
  boolean: 'dataset.fieldType.boolean',
}

export function fieldTypeLabel(type) {
  const key = KEYS[type]
  return key ? tr(key) : String(type ?? '')
}
