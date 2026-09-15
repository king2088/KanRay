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
};

const mariadb = mysql;

module.exports = { mysql, mariadb, pg, clickhouse, mssql, oracle, presto, sqlite };