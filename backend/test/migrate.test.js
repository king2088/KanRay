const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../src/db/index');
const { ensureSchema } = require('../src/db/schema');
const { migrate, parseConn } = require('../src/migrate');

test('parseConn 解析 TYPE@URL', () => {
  assert.deepEqual(parseConn('sqlite@data/kanban.db'), { type: 'sqlite', url: 'data/kanban.db' });
  assert.deepEqual(parseConn('postgres@postgresql://u:p@h:5432/kb'), { type: 'postgres', url: 'postgresql://u:p@h:5432/kb' });
  assert.throws(() => parseConn('mongo@x'), /不支持的类型/);
  assert.throws(() => parseConn('npe'), /TYPE@URL/);
});

test('sqlite -> sqlite：元数据 + 数据表全量迁移，保留 ID', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbmig-'));
  const srcPath = path.join(dir, 'src.db');
  const dstPath = path.join(dir, 'dst.db');

  const src = createStore({ type: 'sqlite', sqlitePath: srcPath });
  ensureSchema(src);
  src.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', ['a@kb.local', '$hash', '甲']);
  src.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', ['b@kb.local', '$hash', '乙']);
  src.run('INSERT INTO roles (code, name, is_builtin) VALUES (?, ?, ?)', ['ops', '运维', 0]);
  src.run('CREATE TABLE ds_1 (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT, cnt INTEGER)');
  src.run('INSERT INTO ds_1 (id, v, cnt) VALUES (?, ?, ?)', [1, 'hello', 10]);
  src.run('INSERT INTO ds_1 (id, v, cnt) VALUES (?, ?, ?)', [2, 'world', 20]);
  src.close();

  const res = await migrate(parseConn(`sqlite@${srcPath}`), parseConn(`sqlite@${dstPath}`), {});
  const byTable = Object.fromEntries(res.tables.map((t) => [t.table, t.rows]));
  assert.equal(byTable.users, 2, 'users 2 行');
  assert.equal(byTable.roles, 1, 'roles 1 行');
  assert.equal(byTable.ds_1, 2, '数据表 ds_1 2 行');

  const dst = createStore({ type: 'sqlite', sqlitePath: dstPath });
  const users = dst.all('SELECT id, email, name FROM users ORDER BY id');
  assert.equal(users.length, 2);
  assert.equal(users[0].id, 1, 'ID 应保留');
  assert.equal(users[0].name, '甲');
  assert.equal(users[1].id, 2);

  const ds = dst.all('SELECT id, v, cnt FROM ds_1 ORDER BY id');
  assert.equal(ds.length, 2);
  assert.equal(ds[0].v, 'hello');
  assert.equal(ds[0].cnt, 10);
  assert.equal(ds[1].id, 2);
  dst.close();
});

test('sqlite -> sqlite：--tables 只迁移指定表', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbmig-'));
  const srcPath = path.join(dir, 'src2.db');
  const dstPath = path.join(dir, 'dst2.db');

  const src = createStore({ type: 'sqlite', sqlitePath: srcPath });
  ensureSchema(src);
  src.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', ['a@kb.local', '$hash', '甲']);
  src.run('INSERT INTO roles (code, name, is_builtin) VALUES (?, ?, ?)', ['ops', '运维', 0]);
  src.close();

  const res = await migrate(parseConn(`sqlite@${srcPath}`), parseConn(`sqlite@${dstPath}`), { tables: 'users' });
  assert.deepEqual(res.tables.map((t) => t.table), ['users']);

  const dst = createStore({ type: 'sqlite', sqlitePath: dstPath });
  assert.equal(dst.all('SELECT * FROM users').length, 1);
  dst.close();
});

test('dry-run 只统计不写入', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbmig-'));
  const srcPath = path.join(dir, 'src3.db');
  const dstPath = path.join(dir, 'dst3.db');

  const src = createStore({ type: 'sqlite', sqlitePath: srcPath });
  ensureSchema(src);
  src.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', ['a@kb.local', '$hash', '甲']);
  src.close();

  const res = await migrate(parseConn(`sqlite@${srcPath}`), parseConn(`sqlite@${dstPath}`), { dryRun: true });
  assert.ok(res.dryRun);
  assert.equal(res.tables.find((t) => t.table === 'users').rows, 1);
  assert.ok(!fs.existsSync(dstPath), 'dry-run 不应落库');
});
test('ensureSchema 为旧库 forms 表补齐 submission_seq 列', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbmig-'));
  const dbPath = path.join(dir, 'legacy-forms.db');
  const store = createStore({ type: 'sqlite', sqlitePath: dbPath });

  // 旧版 forms 表：无 submission_seq（早于该列上线的库形态）
  store.run(`CREATE TABLE forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', schema_json TEXT NOT NULL DEFAULT '{}',
    submit_config TEXT NOT NULL DEFAULT '{}', table_name TEXT, dataset_id INTEGER,
    owner_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);

  ensureSchema(store);

  const cols = store.all('PRAGMA table_info(forms)').map((c) => c.name);
  assert.ok(cols.includes('submission_seq'), '应补齐 submission_seq');

  // 既有行默认值 0
  store.run('INSERT INTO forms (name, owner_id, schema_json) VALUES (?, ?, ?)', ['旧表单', 1, '{}']);
  const row = store.all('SELECT submission_seq FROM forms WHERE name = ?', ['旧表单'])[0];
  assert.equal(row.submission_seq, 0, 'submission_seq 默认 0');

  // 幂等：重复 ensureSchema 不报错、不产生重复列
  ensureSchema(store);
  const again = store.all('PRAGMA table_info(forms)').filter((c) => c.name === 'submission_seq');
  assert.equal(again.length, 1, '不应重复加列');
  store.close();
});
