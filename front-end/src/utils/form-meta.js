// 纯模块：走 tr 并用相对路径引入，保证 node 测试脚本可直接 import。
import { tr } from '../i18n/translate.js'

export const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'static']

export const ENUM_TYPES = ['select', 'radio', 'checkbox']

// 字段类型是英文码，展示文案由词典给出；此处是设计器面板、渲染器与测试共用的单一来源。
export const TYPE_LABEL_KEYS = Object.fromEntries(FIELD_TYPES.map((f) => [f, `form.fieldType.${f}`]))

export function typeLabel(type) {
  const key = TYPE_LABEL_KEYS[type]
  return key ? tr(key) : String(type ?? '')
}

export function isValidKey(key) {
  return typeof key === 'string' && KEY_RE.test(key)
}