const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../src/db/index');
const { ensureSchema } = require('../src/db/schema');

function freshTables(store) {
  return store.all("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
}

function freshCols(store, table) {
  return store.all(`PRAGMA table_info(${table})`).map((c) => c.name);
}

test('初始化 DDL：新建库包含全部业务表', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbddl-'));
  const store = createStore({ type: 'sqlite', sqlitePath: path.join(dir, 'init.db') });
  ensureSchema(store);

  const tables = freshTables(store);
  for (const t of ['users', 'roles', 'permissions', 'role_permissions', 'user_roles',
    'datasets', 'dataset_fields', 'metrics', 'charts', 'dashboards', 'dashboard_shares',
    'data_sources', 'audit_logs', 'refresh_tokens', 'api_keys',
    'sync_configs', 'sync_logs', 'sync_locks', 'sync_jobs',
    'big_screens', 'big_screen_shares', 'big_screen_templates',
    'forms', 'form_shares']) {
    assert.ok(tables.includes(t), `初始化后应存在表 ${t}`);
  }
  store.close();
});

test('初始化 DDL：核心表包含运行时依赖的关键列', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbddl-'));
  const store = createStore({ type: 'sqlite', sqlitePath: path.join(dir, 'init.db') });
  ensureSchema(store);

  const cases = {
    big_screen_shares: ['big_screen_id', 'token', 'password_hash', 'expires_at', 'is_active'],
    big_screens: ['components', 'thumbnail', 'created_at', 'updated_at'],
    forms: ['schema_json', 'submit_config', 'table_name', 'dataset_id', 'submission_seq'],
    form_shares: ['form_id', 'token', 'password_hash', 'expires_at', 'is_active'],
    big_screen_templates: ['components', 'thumbnail'],
    api_keys: ['key_hash', 'key_prefix', 'scopes', 'status', 'expires_at'],
    refresh_tokens: ['token_hash', 'expires_at', 'revoked_at'],
    sync_configs: ['watermark_field', 'watermark_kind', 'sync_interval_seconds', 'last_sync_status'],
    sync_jobs: ['trigger_type', 'lease_until', 'attempts'],
  };
  for (const [table, cols] of Object.entries(cases)) {
    const actual = freshCols(store, table);
    for (const c of cols) {
      assert.ok(actual.includes(c), `${table} 应包含列 ${c}`);
    }
  }
  store.close();
});

test('初始化 DDL：各方言建表脚本包含关键表与列', () => {
  const dir = path.join(__dirname, '..', 'src', 'db', 'ddl');
  const dialects = ['mysql', 'postgres', 'mssql', 'oracle'];
  for (const d of dialects) {
    const text = fs.readFileSync(path.join(dir, `${d}.js`), 'utf8');
    for (const token of ['big_screens', 'big_screen_shares', 'big_screen_templates',
      'forms', 'form_shares', 'api_keys', 'audit_logs',
      'sync_configs', 'sync_locks', 'sync_jobs', 'submission_seq',
      'watermark_kind', 'sync_interval_seconds', 'revoked_at']) {
      assert.ok(text.includes(token), `${d}.js 应包含 ${token}`);
    }
  }
});