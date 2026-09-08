const XLSX = require('xlsx');
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
  if (hasDate && !allInteger) return 'date';
  if (allInteger) return 'integer';
  if (hasDate) return 'date';
  return 'number';
}

/**
 * 读取 Excel/CSV 文件，第一行作为列名
 * @returns {{ header: Array<{key,label,type}>, rows: Array<object> }}
 */
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new HttpError(400, 'Excel 文件中没有工作表');
  const sheet = workbook.Sheets[sheetName];

  // 先取第一行作为表头
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
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
    let key = rawLabel.replace(/\s+/g, '_') || `column_${c + 1}`;
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

module.exports = { parseExcelFile, inferColumnType, TYPE_MAP };
