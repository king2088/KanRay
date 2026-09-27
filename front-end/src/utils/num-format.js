// 统一的数值格式化出口：小数位由指标自身的 decimals 决定。
//
// 语义（见 docs/superpowers/specs/2026-09-27-metric-decimals-design.md）：
//   decimals == null   非库指标：最多 2 位、不补零（保持既有行为）
//   decimals 0..10     库指标：固定小数位、不足补零
//   值非数字            返回 '-'
//
// 关键点：接口 /api/charts/:id/data 返回的指标值是**字符串**（实测 '76.989306'）。
// 旧实现 `if (typeof n !== 'number') return String(n)` 会让 toLocaleString 的
// maximumFractionDigits 完全失效，所以这里统一 Number() 强转后再格式化。
// 与后端 backend/src/engines/metrics.js 的 LIB_MAX_DECIMALS 一致。

export const LIB_MAX_DECIMALS = 10

// 非库指标的既有行为：最多 2 位、不补零
const DEFAULT_MAX_DECIMALS = 2

/**
 * 把任意输入归一为合法的小数位配置。
 * 非法值（null/undefined/NaN/非整数/越界/非数值）一律退回 null = 维持现状行为，
 * 不让脏数据把 toLocaleString 变成 RangeError。
 * @param {*} v
 * @returns {number|null}
 */
export function normalizeDecimals(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isInteger(n)) return null
  if (n < 0 || n > LIB_MAX_DECIMALS) return null
  return n
}

/**
 * 按小数位配置格式化一个数值。
 *
 * 调用方注意：decimals 必须**无条件**透传，不要写 `m.decimals ? m.decimals : null`
 * 这类真值兜底——decimals 的默认值就是 0，绝大多数库指标带的都是 0，
 * 真值判断会把它们全渲染成「最多 2 位、不补零」的非库样式。缺省/非法值传 null 即可，
 * 内联指标（响应里根本没有 decimals 键）传 m.decimals 自然就是 undefined，安全。
 *
 * @param {*} value 原始值，允许是字符串数字
 * @param {number|null|undefined} decimals 归一化后的小数位；null/undefined = 维持现状
 * @param {string} locale BCP-47 语言标签
 * @returns {string}
 */
export function formatNumber(value, decimals, locale = 'zh-CN') {
  if (value === null || value === undefined || value === '') return '-'
  // 先强转：value 常是后端返回的字符串数字，不转则小数位配置完全不生效
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '-'
  const d = normalizeDecimals(decimals)
  if (d === null) {
    return n.toLocaleString(locale, { maximumFractionDigits: DEFAULT_MAX_DECIMALS })
  }
  return n.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })
}
