const path = require('path');
const fs = require('fs');
const { readSheet } = require('read-excel-file/node');
const config = require('../config');
const HttpError = require('../utils/http-error');

const TYPE_MAP = {
  string: 'TEXT',
  number: 'REAL',
  integer: 'INTEGER',
  date: 'TEXT',
  boolean: 'INTEGER',
};

/**
 * 推断单列值的类型
 * @param {Array} values
 */
function inferColumnType(values) {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'string';

  let hasString = false;
  let hasDate = false;
  let allInteger = true;

  for (const raw of nonEmpty) {
    if (raw instanceof Date) {
      hasDate = true;
      continue;
    }
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      if (!Number.isInteger(raw)) allInteger = false;
      continue;
    }
    if (typeof raw === 'boolean') {
      continue;
    }
    const s = String(raw).trim();
    if (s === '') continue;
    // 日期字符串格式
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
      hasDate = true;
      continue;
    }
    // 纯整数或纯数字字符串
    if (/^\d+$/.test(s)) {
      continue; // 整数串，保持 allInteger
    }
    if (/^-?\d+(\.\d+)?$/.test(s) && !Number.isNaN(Number(s))) {
      allInteger = false;
      continue;
    }
    hasString = true;
  }

  if (hasString) return 'string';
  if (hasDate) return 'date';
  if (allInteger) return 'integer';
  return 'number';
}

/**
 * 解析 CSV 文本为二维数组（字符串/数字/布尔），兼容带引号、转义引号与 \r\n
 */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (row.length > 0 || field !== '') { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

function csvCellValue(raw) {
  const v = String(raw).trim();
  if (v === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(v) && !Number.isNaN(Number(v))) return Number(v);
  const low = v.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  return v;
}

/**
 * 二维矩阵 → 标准列头/行记录
 */
function matrixToResult(matrix) {
  if (!matrix || matrix.length === 0) throw new HttpError(400, '上传的文件没有数据行');

  const headerRow = matrix[0];
  const dataRows = matrix.slice(1).filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''));

  if (dataRows.length === 0) throw new HttpError(400, '上传的文件除了表头没有数据行');
  if (dataRows.length > config.upload.maxRows) {
    throw new HttpError(400, `数据行数 ${dataRows.length} 超过上限 ${config.upload.maxRows}`);
  }

  // 标准化列名并保证唯一
  const colCount = headerRow.length;
  const header = [];
  const used = new Set();
  for (let c = 0; c < colCount; c += 1) {
    const rawLabel = headerRow[c] == null ? '' : String(headerRow[c]).trim();
    // 列名白名单：仅保留字母（含中文/非 ASCII）、数字、下划线，其余非法字符替换为 _，
    // 避免生成不可引用的 SQL 标识符（列名会进入本地表列名与聚合别名）。
    let key = rawLabel.replace(/\s+/g, '_')
      .replace(/[^\p{L}\p{N}_]/gu, '_')
      .replace(/_+/g, '_');
    // 不以数字开头，空则回退占位列名
    if (!key || /^\d/.test(key)) key = `column_${c + 1}`;
    let finalKey = key;
    let n = 2;
    while (used.has(finalKey)) {
      finalKey = `${key}_${n}`;
      n += 1;
    }
    used.add(finalKey);
    header.push({ key: finalKey, label: rawLabel || `列${c + 1}`, type: 'string' });
  }

  // 逐列推断类型
  for (let c = 0; c < colCount; c += 1) {
    const colValues = dataRows.map((r) => r[c] ?? null);
    header[c].type = inferColumnType(colValues);
  }

  // 转为对象数组（按 key）
  const rows = dataRows.map((r) => {
    const obj = {};
    for (let c = 0; c < colCount; c += 1) obj[header[c].key] = r[c] ?? null;
    return obj;
  });

  return { header, rows };
}

/**
 * 读取 Excel/CSV 文件，第一行作为列名
 * @param {string} filePath 文件路径
 * @param {{ sheet?: string|number }} [opts] sheet：工作表名或 0 基序号（缺省第一张表）
 * @returns {Promise<{ header: Array<{key,label,type}>, rows: Array<object> }>}
 */
async function parseExcelFile(filePath, opts = {}) {
  const ext = path.extname(filePath).toLowerCase();
  let matrix;
  if (ext === '.csv') {
    const text = await fs.promises.readFile(filePath, 'utf8');
    matrix = parseCsv(text).map((r) => r.map(csvCellValue));
  } else if (ext === '.xls') {
    // 旧版二进制 XLS 走 SheetJS；与 .xlsx 一样产出二维数组
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const name = resolveSheet(wb.SheetNames, opts.sheet);
    matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
  } else {
    // 返回二维数组：每行是数组，值类型为 string | number | boolean | Date | null
    try {
      matrix = await readSheet(filePath, pickSheet(opts.sheet));
    } catch (e) {
      if (/not found|worksheet/i.test(String(e.message))) {
        throw new HttpError(400, `工作表不存在: ${opts.sheet}`);
      }
      throw e;
    }
  }
  return matrixToResult(matrix);
}

// 工作表选择：字符串工作表名或 0 基整数序号；缺省取第一张表。
// readSheet 的 sheetNumber 为 1 基，这里把用户可见的 0 基序号 +1 后透传。
function pickSheet(sheet) {
  if (sheet == null || sheet === '') return undefined;
  const n = Number(sheet);
  if (Number.isInteger(n) && !Number.isNaN(n) && String(sheet).trim() === String(n)) return n + 1;
  return String(sheet);
}

function resolveSheet(names, sheet) {
  if (!names.length) throw new HttpError(400, '文件没有工作表');
  if (sheet == null || sheet === '') return names[0];
  const target = String(sheet).trim();
  const n = Number(target);
  if (Number.isInteger(n) && !Number.isNaN(n) && String(target) === String(n)) {
    if (n >= 0 && n < names.length) return names[n];
    throw new HttpError(400, `工作表序号不存在: ${sheet}（共 ${names.length} 张表）`);
  }
  if (names.includes(target)) return target;
  throw new HttpError(400, `工作表不存在: ${sheet}（可选: ${names.join(', ')}）`);
}

module.exports = { parseExcelFile, inferColumnType, TYPE_MAP };