const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

function loadConfig(envOverrides = {}, fileJson = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kbcfg-'));
  fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify(fileJson));
  // 保存旧值以便恢复
  const saved = {};
  for (const k of ['DATA_DIR', 'DB_TYPE', 'DB_URL', 'DB_PATH']) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.DATA_DIR = tmp;
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) { delete process.env[k]; } else { process.env[k] = v; }
  }
  delete require.cache[require.resolve('../src/config')];
  const cfg = require('../src/config');
  // 恢复环境变量
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  delete require.cache[require.resolve('../src/config')];
  return cfg;
}

test('默认 SQLite — db.type / dbPath', () => {
  const cfg = loadConfig({}, {});
  assert.equal(cfg.db.type, 'sqlite');
  assert.ok(cfg.dbPath.includes('kanban.db'));
  assert.equal(cfg.db.url, '');
});

test('config.json 指定 postgres', () => {
  const cfg = loadConfig({}, { db: { type: 'postgres', url: 'postgresql://u:p@h:5432/kanban' } });
  assert.equal(cfg.db.type, 'postgres');
  assert.equal(cfg.db.url, 'postgresql://u:p@h:5432/kanban');
  // dbPath 应返回 url（非 sqlite）
  assert.equal(cfg.dbPath, cfg.db.url);
});

test('config.json 指定 mysql', () => {
  const cfg = loadConfig({}, { db: { type: 'mysql', url: 'mysql://u:p@h:3306/kanban' } });
  assert.equal(cfg.db.type, 'mysql');
  assert.equal(cfg.db.url, 'mysql://u:p@h:3306/kanban');
});

test('env 覆盖 config.json', () => {
  const cfg = loadConfig(
    { DB_TYPE: 'mysql', DB_URL: 'mysql://root:pass@127.0.0.1:3306/kanban' },
    { db: { type: 'postgres', url: 'postgresql://x' } }
  );
  assert.equal(cfg.db.type, 'mysql');
  assert.equal(cfg.db.url, 'mysql://root:pass@127.0.0.1:3306/kanban');
});

test('非法 DB_TYPE 抛出可读错误', () => {
  assert.throws(
    () => loadConfig({ DB_TYPE: 'mongodb' }, {}),
    /DB_TYPE|sqlite|mysql|mariadb|postgres|sqlserver|oracle/i
  );
});

test('支持 mariadb 类型', () => {
  const cfg = loadConfig({ DB_TYPE: 'mariadb', DB_URL: 'mysql://u:p@h:3306/kanban' });
  assert.equal(cfg.db.type, 'mariadb');
});

test('支持 sqlserver 类型', () => {
  const cfg = loadConfig({ DB_TYPE: 'sqlserver', DB_URL: 'mssql://u:p@h:1433/db' });
  assert.equal(cfg.db.type, 'sqlserver');
});

test('支持 oracle 类型', () => {
  const cfg = loadConfig({ DB_TYPE: 'oracle', DB_URL: 'oracle://u:p@h:1521/FREEPDB1' });
  assert.equal(cfg.db.type, 'oracle');
});

test('config.json 的 sqlitePath 被正确解析', () => {
  const cfg = loadConfig({}, { db: { type: 'sqlite', sqlitePath: '/custom/path.db' } });
  assert.equal(cfg.db.sqlitePath, '/custom/path.db');
  assert.equal(cfg.dbPath, cfg.db.sqlitePath);
});

test('config.json 解析失败抛出可读错误', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kbcfg-'));
  fs.writeFileSync(path.join(tmp, 'config.json'), '{invalid json');
  const saved = process.env.DATA_DIR;
  process.env.DATA_DIR = tmp;
  delete require.cache[require.resolve('../src/config')];
  assert.throws(() => require('../src/config'), /config\.json 解析失败/);
  if (saved === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = saved;
  delete require.cache[require.resolve('../src/config')];
});

test('db.type 校验 — 大小写不敏感', () => {
  const cfg = loadConfig({ DB_TYPE: 'Postgres', DB_URL: 'postgresql://x' });
  assert.equal(cfg.db.type, 'postgres');
});
