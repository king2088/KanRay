/**
 * 将后端存储的裸 UTC 时间字符串按指定时区格式化显示。
 * 后端存储格式为 "YYYY-MM-DD HH:MM:SS"（UTC，无时区标识）。
 * 兼容输入：纯日期、带毫秒、带已有时区后缀（Z / ±HH:MM）。
 * 说明：本函数刻意固定使用 'zh-CN' 取数值字段，保证输出恒为 YYYY-MM-DD HH:mm:ss。
 * 不要改为跟随界面语言——Intl 在 en-US 下会把字段顺序变成 MM-DD-YYYY，与全站日期展示不一致。
 * 需要随语言变化的月份/星期/数字格式，请在本文件之外用 toLocaleString(locale) 处理。
 * @param {string|null} s - 时间字符串
 * @param {string} tz - IANA 时区标识符，默认 'Asia/Shanghai'
 * @returns {string} 格式化后的本地时间字符串，无法解析时原样返回
 */
export function formatDateTime(s, tz = 'Asia/Shanghai') {
  if (!s) return '-'
  const raw = String(s).trim()
  // 纯日期（YYYY-MM-DD）：不做时区换算，原样显示
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // 统一转成 "YYYY-MM-DD HH:MM:SS" 并剥掉已带时区标记，视为 UTC
  const normalized = raw
    .replace('T', ' ')
    .replace(/\.\d+(Z)?$/i, '')
    .replace(/[Z]$/i, '')
    .replace(/[+-]\d{2}:?\d{2}$/, '')
    .replace(' ', 'T')
  const date = new Date(`${normalized}Z`)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-')
}