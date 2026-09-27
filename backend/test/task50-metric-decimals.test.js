// 指标库小数位（decimals）跨层契约：
//   1) 5 个方言的基表 DDL 都要预埋 metrics.decimals，且默认值都是 0
//   2) schema.js 的 needCols 兜底既有旧库
//
// 为什么不复用 task45：task45 跑的是真 sqlite（只覆盖 sqlite 方言），
// 这里的第 1 条是源码契约——mysql/postgres/mssql/oracle 没有 live 实例可跑，
// 但列漏预埋会在生产建库时才炸，必须在 CI 就拦住。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIALECTS = ['sqlite', 'mysql', 'postgres', 'mssql', 'oracle'];
const DDL_DIR = path.join(__dirname, '..', 'src', 'db', 'ddl');

test('5 个方言的 metrics 基表 DDL 都预埋 decimals 且默认 0', () => {
  for (const d of DIALECTS) {
    const src = fs.readFileSync(path.join(DDL_DIR, `${d}.js`), 'utf8');
    // 只取 metrics 的列定义段：截到该建表语句收尾的右括号（DDL 里统一是 2 空格缩进的 `\n  )`）。
    // 不能用 indexOf(')')——它会停在 REFERENCES datasets(id) / VARCHAR(36) 这类内嵌括号上。
    const stmt = /CREATE TABLE(?: IF NOT EXISTS)? metrics \(([\s\S]*?)\n {2}\)/.exec(src);
    assert.ok(stmt, `${d}.js 缺少 metrics 建表语句`);
    const body = stmt[1];
    assert.match(body, /\bdecimals\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0\b/i,
      `${d}.js 的 metrics DDL 缺少 "decimals INTEGER NOT NULL DEFAULT 0"，实际: ${body.replace(/\s+/g, ' ')}`);
  }
});

test('schema.js 的 needCols 为既有 metrics 库兜底 decimals 列', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.js'), 'utf8');
  const start = src.indexOf('const needCols = {');
  assert.ok(start >= 0, 'schema.js 缺少 needCols 定义');
  const line = src.slice(start, src.indexOf('\n', src.indexOf('metrics:', start)));
  assert.match(line, /metrics:\s*\[\['decimals',\s*'INTEGER NOT NULL DEFAULT 0'\]\]/,
    `needCols.metrics 缺少 decimals 兜底列，实际: ${line.trim()}`);
});
