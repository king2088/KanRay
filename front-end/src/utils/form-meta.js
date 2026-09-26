export const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'static']

export const ENUM_TYPES = ['select', 'radio', 'checkbox']

export function isValidKey(key) {
  return typeof key === 'string' && KEY_RE.test(key)
}