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
    const decLine = body.split('\n').map((l) => l.trim()).find((l) => /^decimals\b/.test(l));
    assert.ok(decLine, `${d}.js 的 metrics DDL 缺少 decimals 列，实际: ${body.replace(/\s+/g, ' ')}`);
    // 两种语序都合法：Oracle 的 CREATE TABLE 内联列定义要求 DEFAULT 在 NOT NULL 之前，
    // 其余方言两种语序都收。末尾用 ,? 是因为 decimals 是列清单中间的一列、行尾带逗号
    //（若锚死 $ 不带逗号，5 个方言会被误判为不合法）。
    assert.match(decLine.replace(/\s+/g, ' '),
      /^decimals INTEGER (?:NOT NULL DEFAULT 0|DEFAULT 0 NOT NULL),?$/,
      `${d}.js 的 decimals 列定义应为 INTEGER + NOT NULL + DEFAULT 0（两种语序皆可），实际: ${decLine}`);
  }
});

test('schema.js 的 needCols 为既有 metrics 库兜底 decimals 列', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.js'), 'utf8');
  const start = src.indexOf('const needCols = {');
  assert.ok(start >= 0, 'schema.js 缺少 needCols 定义');
  // 只在 needCols 块内找 metrics: 行，避免命中文件里更早出现的同名 key
  const blockEnd = src.indexOf('\n  };', start);
  assert.ok(blockEnd > start, 'needCols 块未正常闭合');
  const block = src.slice(start, blockEnd);
  const line = block.split('\n').map((l) => l.trim()).find((l) => l.startsWith('metrics:'));
  assert.ok(line, `needCols 里没有 metrics 条目，实际块内容: ${block.replace(/\s+/g, ' ')}`);
  assert.match(line, /^metrics:\s*\[\['decimals',\s*'INTEGER NOT NULL DEFAULT 0'\]\],?$/,
    `needCols.metrics 缺少 decimals 兜底列，实际: ${line}`);
});
