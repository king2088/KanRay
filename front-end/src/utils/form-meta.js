export const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'static']

export const ENUM_TYPES = ['select', 'radio', 'checkbox']

export const TYPE_LABELS = {
  text: '单行文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  select: '下拉选择',
  radio: '单选',
  checkbox: '多选',
  static: '说明文字',
}

export function isValidKey(key) {
  return typeof key === 'string' && KEY_RE.test(key)
}