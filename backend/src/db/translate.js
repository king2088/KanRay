// src/db/translate.js
// 可移植 SQL → 方言 SQL：
//  - `?`  → dialect.placeholder(i)（逐位置计数）
//  - `"ident"` → dialect.quoteIdent(ident)
//  - datetime('now') → dialect.now
//  - options.quoteAliases：把 `AS <ident>` 别名用 dialect.quoteIdent 包裹，
//    防止 PG 等方言把未加引号别名折叠为小写（SQLite 驱动不使用本模块，行为天然一致）
// 逐字符扫描，跳过单引号字符串字面量；对已含字面量字符串的 SQL 安全。

function translate(sql, dialect, options = {}) {
  // 方言转译：INSERT OR IGNORE（SQLite 方言）→ 对应数据库语法
  if (dialect && dialect.insertIgnore) sql = dialect.insertIgnore(sql);

  let out = '';
  let paramIndex = 0;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];

    // 单引号字符串字面量 — 原样跳过
    if (ch === "'") {
      let j = i + 1;
      let escaped = false;
      while (j < n) {
        if (sql[j] === '\\' && !escaped) { escaped = true; j++; continue; }
        if (sql[j] === "'" && escaped) { escaped = false; j++; continue; }
        if (sql[j] === "'" && j + 1 < n && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'" && !escaped) break;
        escaped = false;
        j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '?') {
      paramIndex += 1;
      out += dialect.placeholder(paramIndex);
      i += 1;
    } else if (ch === '"') {
      // 标识符引用 — 取到闭合引号
      let j = i + 1;
      while (j < n && sql[j] !== '"') {
        if (sql[j] === '"' && j + 1 < n && sql[j + 1] === '"') j += 2;
        else j++;
      }
      const ident = sql.slice(i + 1, j).replace(/""/g, '"');
      out += dialect.quoteIdent(ident);
      i = j + 1;
    } else if (
      ch === 'd' &&
      sql.slice(i, i + 15).toLowerCase() === "datetime('now')"
    ) {
      out += dialect.now;
      i += 15;
    } else if (options.quoteAliases && (ch === 'A' || ch === 'a') &&
      sql.slice(i, i + 2).toLowerCase() === 'as' &&
      (i === 0 ? !/[A-Za-z0-9_$]/.test(' ') : !/[A-Za-z0-9_$]/.test(sql[i - 1])) &&
      !/[A-Za-z0-9_$]/.test(sql[i + 2] || '')) {
      // 引用 `AS <ident>` 别名：保留大小写（避免 PG 折叠为小写破坏驼峰别名）
      // ident 允许含中文等非 ASCII 字符（聚合维度别名 `__dim_<字段>__` 常见中文）
      out += 'AS';
      i += 2;
      let j = i;
      while (j < n && sql[j] === ' ') j++;
      let k = j;
      while (k < n && !/[\s,;()'"#)]/.test(sql[k])) k++;
      if (j < n && sql[j] !== '#' && sql[j] !== '(' && sql[j] !== ',' && sql[j] !== '.' && sql[j] !== ';' && sql[j] !== ')' && sql[j] !== '"' && k > j) {
        out += ' ' + dialect.quoteIdent(sql.slice(j, k));
        i = k;
      } else {
        out += sql.slice(i, j);
        i = j;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

module.exports = { translate };
