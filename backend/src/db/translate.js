// src/db/translate.js
// 可移植 SQL → 方言 SQL：
//  - `?`  → dialect.placeholder(i)（逐位置计数）
//  - `"ident"` → dialect.quoteIdent(ident)
//  - datetime('now') → dialect.now
// 逐字符扫描，跳过单引号字符串字面量；对已含字面量字符串的 SQL 安全。

function translate(sql, dialect) {
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
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

module.exports = { translate };
