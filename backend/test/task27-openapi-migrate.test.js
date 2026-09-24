// T1：开放 API 凭证表 api_keys 建表 + 多方言 DDL 幂等
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../src/db/index');
const { ensureSchema } = require('../src/db/schema');
const { uuidv7 } = require('../src/utils/uuidv7');

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbauthkey-'));
  return createStore({ type: 'sqlite', sqlitePath: path.join(dir, 't.db') });
}

const EXPECTED_COLUMNS = ['id', 'name', 'type', 'user_id', 'key_hash', 'key_prefix', 'scopes', 'status', 'expires_at', 'last_used_at', 'created_by', 'created_at', 'updated_at'];

test('sqlite ensureSchema 创建 api_keys 表且含全部列', () => {
  const store = freshStore();
  ensureSchema(store);
  const rows = store.all("SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'");
  assert.equal(rows.length, 1, 'api_keys 表应存在');
  const cols = store.all("PRAGMA table_info('api_keys')").map((c) => c.name);
  for (const c of EXPECTED_COLUMNS) assert.ok(cols.includes(c), `缺少列 ${c}`);
  store.close();
});

test('api_keys key_hash 唯一约束', () => {
  const store = freshStore();
  ensureSchema(store);
  const admin = uuidv7();
  store.run('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [admin, 'admin@kanray.local', 'hash', '管理员']);
  store.run('INSERT INTO api_keys (id, name, type, user_id, key_hash, key_prefix, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv7(), 'a', 'static', admin, 'h1', 'kan_live_x', '[]']);
  assert.throws(() => store.run('INSERT INTO api_keys (id, name, type, user_id, key_hash, key_prefix, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv7(), 'b', 'static', admin, 'h1', 'kan_live_x', '[]']), /UNIQUE/i);
  store.close();
});

test('老库升级路径：DROP 后 ensureSchema 重跑自动重建（幂等）', () => {
  const store = freshStore();
  ensureSchema(store);
  store.exec('DROP TABLE api_keys');
  ensureSchema(store); // runDdl 的 IF NOT EXISTS 建表路径
  const rows = store.all("SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'");
  assert.equal(rows.length, 1, '重跑 ensureSchema 应重建 api_keys');
  store.close();
});

test('5 个方言 DDL 数组均含 api_keys 建表语句', () => {
  const names = ['sqlite', 'mysql', 'postgres', 'mssql', 'oracle'];
  for (const n of names) {
    const ddl = require(`../src/db/ddl/${n}`);
    const joined = ddl.join('\n');
    assert.match(joined, /CREATE TABLE(?:\s+IF NOT EXISTS)?[ (]+"?api_keys"?/i, `${n} 缺少 api_keys 建表`);
    for (const col of ['key_hash', 'key_prefix', 'scopes', 'status', 'user_id']) {
      assert.match(joined, new RegExp(`"?(?:${col}|user_id)"?`, 'i'), `${n} DDL 缺少列 ${col}`);
    }
  }
});