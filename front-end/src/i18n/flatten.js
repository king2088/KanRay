// 展平嵌套词典为 "a.b.c" -> value 的单层对象，供键对齐校验使用。
export function flattenMessages(source, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(source || {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenMessages(value, path, out)
    } else {
      out[path] = value
    }
  }
  return out
}
