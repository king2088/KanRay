// backend/src/utils/datetime.js
// 应用统一时间表示：'YYYY-MM-DD HH:MM:SS'（无时区标记，与 SQLite 存储格式一致）。
// 远程驱动（pg/mysql/mssql/oracle）会把时间列解析成 Date 对象，JSON 序列化后变成
// ISO 字符串（2026-09-19T07:14:54.999Z），与 SQLite 路径不一致；在驱动行映射层统一。
const pad = (n) => String(n).padStart(2, '0');
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/;

// Date → 本地墙钟字符串（驱动把无时区时间按进程时区解析，故用本地 getter 还原），
// 字符串 → 截断为秒（去掉 T / 毫秒 / 时区后缀）
function toNaiveDateTime(v) {
  if (v == null) return v;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} `
      + `${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  }
  if (typeof v === 'string') {
    const m = v.match(DATETIME_RE);
    if (m) return `${m[1]} ${m[2]}`;
  }
  return v;
}

function normalizeRowDates(row) {
  if (!row || typeof row !== 'object' || row instanceof Date) return row;
  let changed = false;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nv = (v instanceof Date) || (typeof v === 'string' && DATETIME_RE.test(v))
      ? toNaiveDateTime(v)
      : v;
    if (nv !== v) changed = true;
    out[k] = nv;
  }
  return changed ? out : row;
}

function normalizeRowsDates(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(normalizeRowDates);
}


// 解析应用统一时间 'YYYY-MM-DD HH:MM:SS'（无时区标记）为 UTC Date。
// 驱动均以字符串返回该格式（translate 前），此处补上时区标记转成可比较的时间戳。
function parseNaiveUtc(ts) {
  if (!ts) return null;
  const s = String(ts).trim();
  if (!s) return null;
  const m = s.match(DATETIME_RE);
  if (!m) return null;
  return new Date(`${m[1]}T${m[2]}Z`);
}

module.exports = { toNaiveDateTime, normalizeRowDates, normalizeRowsDates, parseNaiveUtc };
