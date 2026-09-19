// src/datasources/portable-sql.js
// 把「可移植 SQL」转成目标数据源方言，供同步引擎生成的源端查询使用。
// 同步引擎（sync.service）统一以 `?` 占位符与 `LIMIT n [OFFSET m]` 生成 SQL，
// 但各方言语法不同：
//   pg/mysql: `?` + `LIMIT n [OFFSET m]`
//   mssql:    `@p0, @p1…` + `SELECT TOP (n)` / `OFFSET m ROWS FETCH NEXT n ROWS ONLY`
//   oracle:   `:1, :2…` + `FETCH FIRST n ROWS ONLY` / `OFFSET m ROWS FETCH NEXT n ROWS ONLY`
// 逐字符扫描并跳过单引号字符串字面量，避免误替换字面量里的 `?`。
function toDialect(sql, dialect) {
  let out = '';
  let idx = 0;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") break;
        j += 1;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '?') {
      idx += 1;
      out += dialect.placeholder(idx);
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return rewriteLimit(out, dialect);
}

// 把末尾的 `LIMIT n [OFFSET m]` 转成方言写法；无则该语句原样返回。
function rewriteLimit(sql, dialect) {
  const m = sql.match(/\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?\s*;?\s*$/i);
  if (!m) return sql;
  const limit = Number(m[1]);
  const base = sql.slice(0, m.index);
  if (m[2] != null) return dialect.paginate(base, limit, Number(m[2]));
  return dialect.limit(base, limit);
}

module.exports = { toDialect, rewriteLimit };
