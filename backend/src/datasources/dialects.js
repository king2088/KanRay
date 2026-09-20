const mysql = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m', year: '%Y' };
    return `DATE_FORMAT(${mysql.quoteIdent(field)}, '${map[unit] || map.month}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'TEXT', date: 'DATE', boolean: 'TINYINT(1)' },
  placeholder: () => '?',
  now: 'NOW()',
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'dup',
  insertIgnore(sql) {
    // INSERT OR IGNORE INTO → INSERT IGNORE INTO（MySQL/MariaDB）
    return String(sql).replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT IGNORE INTO');
  },
};

const pg = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATE_TRUNC('${map[unit] || 'month'}', ${pg.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE PRECISION', string: 'TEXT', date: 'DATE', boolean: 'BOOLEAN' },
  placeholder: (i) => `$${i}`,
  now: 'now()',
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'conflict',
  insertIgnore(sql) {
    // 仅处理真正的 INSERT OR IGNORE；普通 INSERT 原样返回（避免破坏普通语句）
    const s = String(sql);
    if (!/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi.test(s)) return s;
    const base = s.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
    const valIdx = base.toUpperCase().indexOf(' VALUES ');
    if (valIdx === -1) return base;
    // 深度感知找到 VALUES 列表的闭合括号（兼容 now() 等函数括号）
    let depth = 0;
    for (let i = valIdx + 8; i < base.length; i++) {
      const ch = base[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          return base.slice(0, i + 1) + ' ON CONFLICT DO NOTHING' + base.slice(i + 1);
        }
      }
    }
    return base;
  },
};

const clickhouse = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'toDayOfMonth', week: 'toWeek', month: 'toStartOfMonth', year: 'toStartOfYear' };
    const fn = map[unit] || 'toStartOfMonth';
    return `${fn}(${clickhouse.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'Int64', number: 'Float64', string: 'String', date: 'Date', boolean: 'UInt8' },
  placeholder: () => `?`,
  now: 'now()',
  agg: { count: 'COUNT', count_distinct: 'uniqExact', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `trimBoth(${name})`,
  upsertSyntax: 'none',
};

const mssql = {
  quoteIdent: (name) => `[${String(name).replace(/]/g, ']]')}]`,
  limit: (sql, n) => sql.replace(/^SELECT\s+/i, `SELECT TOP (${Number(n)}) `),
  paginate: (sql, limit, offset) => `${sql} OFFSET ${Number(offset)} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`,
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATETRUNC('${map[unit] || 'month'}', ${mssql.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'FLOAT', string: 'NVARCHAR(MAX)', date: 'DATE', boolean: 'BIT' },
  placeholder: (i) => '@p' + Math.max(0, i - 1),
  now: 'SYSDATETIME()',
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `LTRIM(RTRIM(${name}))`,
  upsertSyntax: 'merge',
};

const oracle = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} FETCH FIRST ${Number(n)} ROWS ONLY`, // Oracle 12c+
  paginate: (sql, limit, offset) => `${sql} OFFSET ${Number(offset)} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`,
  dateTrunc: (field, unit) => {
    const map = { day: 'DD', week: 'IW', month: 'MONTH', year: 'YEAR' };
    return `TRUNC(${oracle.quoteIdent(field)}, '${map[unit] || 'MONTH'}')`;
  },
  typeMapping: { integer: 'NUMBER(19)', number: 'NUMBER', string: 'VARCHAR2(4000)', date: 'DATE', boolean: 'NUMBER(1)' },
  placeholder: (i) => `:${i}`,
  now: 'SYSTIMESTAMP',
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'merge',
};

const presto = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `date_trunc('${map[unit] || 'month'}', ${presto.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'VARCHAR', date: 'DATE', boolean: 'BOOLEAN' },
  placeholder: () => '?',
  now: 'current_timestamp',
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `trim(${name})`,
  upsertSyntax: 'none',
};

const sqlite = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m', year: '%Y' };
    return `strftime('${map[unit] || map.month}', ${sqlite.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'INTEGER', number: 'REAL', string: 'TEXT', date: 'TEXT', boolean: 'INTEGER' },
  placeholder: () => '?',
  now: "datetime('now')",
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'conflict',
  insertIgnore(sql) {
    // SQLite 原生支持 INSERT OR IGNORE，无需转换
    return sql;
  },
};

// 无 OFFSET 方言（Hive/MaxCompute）的行号窗口模拟：保留原 ORDER BY 以保证分页窗口有序，
// 供主键对账等「按序分页 + 归并」语义使用。可解析失败时退回 LIMIT（忽略 OFFSET）兜底。
function paginateByPageNumber(sql, limit, offset) {
  const base = String(sql).trim().replace(/;\s*$/, '');
  const m = base.match(/^SELECT\s+((?:.|\n)+?)\s+FROM\s+(.+)$/is);
  if (!m) return `${base} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  let proj = m[1].trim();
  const fromPart = m[2].trim();
  let from = fromPart;
  let orderBy = '';
  const om = fromPart.match(/\s+ORDER\s+BY\s+(.+?)\s*$/is);
  if (om) { orderBy = om[1].trim(); from = fromPart.slice(0, om.index).trim(); }
  if (/^(\*|COUNT\(|ROW_NUMBER\(|DISTINCT\s)/i.test(proj)) {
    return `${base} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  }
  const projParts = proj.split(',').map((s) => s.trim()).filter(Boolean);
  const ord = orderBy || projParts[0] || '1';
  const rn = `ROW_NUMBER() OVER (ORDER BY ${ord}) AS __rn`;
  const inner = `SELECT ${proj}, ${rn} FROM ${from}`;
  const outerOrder = orderBy ? ` ORDER BY ${ord}` : '';
  return `SELECT ${proj} FROM ( ${inner} ) __p WHERE __rn > ${Number(offset)} AND __rn <= ${Number(offset) + Number(limit)}${outerOrder}`;
}

// 通用聚合映射
const STD_AGG = { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' };

const db2 = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} FETCH FIRST ${Number(n)} ROWS ONLY`,
  paginate: (sql, limit, offset) => `${sql} OFFSET ${Number(offset)} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`,
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATE_TRUNC('${map[unit] || 'month'}', ${db2.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'VARCHAR(4000)', date: 'DATE', boolean: 'SMALLINT' },
  placeholder: () => '?',
  now: 'CURRENT TIMESTAMP',
  agg: STD_AGG,
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'merge',
};

const dameng = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'DD', week: 'IW', month: 'MONTH', year: 'YEAR' };
    return `TRUNC(${dameng.quoteIdent(field)}, '${map[unit] || 'MONTH'}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'VARCHAR(4000)', date: 'DATE', boolean: 'BIT' },
  placeholder: () => '?',
  now: 'CURRENT_TIMESTAMP',
  agg: STD_AGG,
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'merge',
};

const hive = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => paginateByPageNumber(sql, limit, offset),
  dateTrunc: (field, unit) => {
    const map = { day: 'DD', week: 'WEEK', month: 'MM', year: 'YYYY' };
    return `trunc(${hive.quoteIdent(field)}, '${map[unit] || 'MM'}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'STRING', date: 'DATE', boolean: 'BOOLEAN' },
  placeholder: () => '?',
  now: 'current_timestamp',
  agg: STD_AGG,
  trim: (name) => `trim(${name})`,
  upsertSyntax: 'none',
};

const impala = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'DAY', week: 'WEEK', month: 'MONTH', year: 'YEAR' };
    return `TRUNC(${impala.quoteIdent(field)}, '${map[unit] || 'MONTH'}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'STRING', date: 'DATE', boolean: 'BOOLEAN' },
  placeholder: () => '?',
  now: 'now()',
  agg: STD_AGG,
  trim: (name) => `trim(${name})`,
  upsertSyntax: 'none',
};

const maxcompute = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  paginate: (sql, limit, offset) => paginateByPageNumber(sql, limit, offset),
  dateTrunc: (field, unit) => {
    const map = { day: 'yyyy-MM-dd', week: 'yyyy-ww', month: 'yyyy-MM', year: 'yyyy' };
    return `DATE_FORMAT(${maxcompute.quoteIdent(field)}, '${map[unit] || 'yyyy-MM'}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'STRING', date: 'DATETIME', boolean: 'BOOLEAN' },
  placeholder: () => '?',
  now: 'getdate()',
  agg: STD_AGG,
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'none',
};

const esRest = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  // ES SQL 无 OFFSET，provider 自游标/截断解释末尾的 LIMIT n OFFSET m
  paginate: (sql, limit, offset) => `${sql} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATE_TRUNC('${map[unit] || 'month'}', ${esRest.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'long', number: 'double', string: 'keyword', date: 'date', boolean: 'boolean' },
  placeholder: () => '?',
  now: 'CURRENT_TIMESTAMP',
  agg: STD_AGG,
  trim: (name) => `TRIM(${name})`,
  upsertSyntax: 'none',
};

const mariadb = mysql;

module.exports = {
  mysql, mariadb, pg, clickhouse, mssql, oracle, presto, sqlite,
  db2, dameng, hive, impala, maxcompute, 'es-rest': esRest,
  // 非 SQL 源复用 sqlite 方言作为本地物化查询方言
  http: sqlite,
  file: sqlite,
};