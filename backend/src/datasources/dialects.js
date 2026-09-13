const mysql = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  dateTrunc: (field, unit) => {
    const map = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m', year: '%Y' };
    return `DATE_FORMAT(${mysql.quoteIdent(field)}, '${map[unit] || map.month}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'TEXT', date: 'DATE', boolean: 'TINYINT(1)' },
  placeholder: () => '?',
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
};

const pg = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATE_TRUNC('${map[unit] || 'month'}', ${pg.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE PRECISION', string: 'TEXT', date: 'DATE', boolean: 'BOOLEAN' },
  placeholder: (i) => `$${i}`,
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
};

const clickhouse = {
  quoteIdent: (name) => `"${String(name).replace(/"/g, '""')}"`,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  dateTrunc: (field, unit) => {
    const map = { day: 'toDayOfMonth', week: 'toWeek', month: 'toStartOfMonth', year: 'toStartOfYear' };
    const fn = map[unit] || 'toStartOfMonth';
    return `${fn}(${clickhouse.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'Int64', number: 'Float64', string: 'String', date: 'Date', boolean: 'UInt8' },
  placeholder: () => `?`,
  agg: { count: 'COUNT', count_distinct: 'uniqExact', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
};

const mssql = {
  quoteIdent: (name) => `[${String(name).replace(/]/g, ']]')}]`,
  limit: (sql, n) => sql.replace(/^SELECT\s+/i, `SELECT TOP (${Number(n)}) `),
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATETRUNC('${map[unit] || 'month'}', ${mssql.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'FLOAT', string: 'NVARCHAR(MAX)', date: 'DATE', boolean: 'BIT' },
  placeholder: () => `@p0`,
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
};

module.exports = { mysql, pg, clickhouse, mssql };