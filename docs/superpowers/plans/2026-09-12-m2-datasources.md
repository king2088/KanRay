# M2 数据源接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-datasource support for 22 database types with a unified driver registry + protocol family provider architecture, covering CRUD, connection testing, schema browsing, table-to-dataset registration, and chart query integration.

**Architecture:** Driver registry (22 entries) + 6 protocol family providers (mysql, pg, clickhouse, mssql, es-rest, http) + AES-256-GCM encrypted config storage + SQL dialect abstraction + SqlDataProvider bridging external databases into the existing chart/dashboard pipeline.

**Tech Stack:** Node.js, Express 5, better-sqlite3, mysql2, pg, mssql, zod, AES-256-GCM, Vue 3, Element Plus, playwright-core CDP.

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `backend/src/datasources/drivers.js` | 22-entry driver registry (type, name, category, family, status, capabilities, defaultPort, fields schema) |
| `backend/src/datasources/crypto.js` | AES-256-GCM encrypt/decrypt/mask for passwords |
| `backend/src/datasources/dialects.js` | SQL dialect per family: quoteIdent, limit, dateTrunc, buildAggSql |
| `backend/src/datasources/providers/index.js` | Provider factory: getProvider(family) + connection pool cache |
| `backend/src/datasources/providers/mysql-family.js` | mysql2/promise pool for MySQL/MariaDB/TiDB/Doris/StarRocks |
| `backend/src/datasources/providers/pg-family.js` | pg Pool for PostgreSQL/Greenplum/KingbaseES/GaussDB/Redshift |
| `backend/src/datasources/providers/clickhouse.js` | Native HTTP client for ClickHouse |
| `backend/src/datasources/providers/mssql.js` | mssql package (tedious) for SQL Server |
| `backend/src/datasources/providers/elasticsearch.js` | REST client for ES: _cluster/health + _cat/indices + _mapping |
| `backend/src/datasources/providers/api-service.js` | Generic HTTP probe (configurable method/headers/expected status) |
| `backend/src/datasources/sql-data-provider.js` | SqlDataProvider: buildAggSql → runQuery → {columns, rows} |
| `backend/src/services/datasource.service.js` | CRUD, test, schema browse, register-table (with audit) |
| `backend/src/routes/datasource.routes.js` | /api/datasources routes (requireUser + requirePermission) |
| `backend/test/task11-drivers.test.js` | Registry completeness, field schema validation |
| `backend/test/task12-crypto.test.js` | AES round-trip, tamper detection, mask |
| `backend/test/task13-dialects.test.js` | Dialect functions unit tests |
| `backend/test/task14-datasource-api.test.js` | CRUD/403/owner isolation/password sanitization (mock provider) |
| `backend/test/task15-engine-sql.test.js` | source_type dispatch + SqlDataProvider (mock provider) |
| `front-end/src/views/DataSourceList.vue` | Datasource list page |
| `front-end/src/views/DataSourceDetail.vue` | Datasource detail + schema tree |
| `front-end/src/views/DataSourceFormDialog.vue` | Create/edit dialog with dynamic form |

### Modified files
| File | Change |
|---|---|
| `backend/src/db.js` | Add `data_sources` table + idempotent `datasets` ALTER |
| `backend/src/services/access.service.js` | Add `datasource → data_sources` to RESOURCE_TABLES |
| `backend/src/engines/query-engine.js` | Dispatch by `dataset.source_type` (sql vs excel) |
| `backend/src/app.js` | Mount `/api/datasources` routes |
| `backend/src/seeds.js` | No change needed — datasource permissions already built-in |
| `backend/test/helpers/db.js` | Add `data_sources` DELETE to resetDb |
| `front-end/src/api/index.js` | Add `datasourceApi` |
| `front-end/src/router/menu.js` | Add 数据源 menu item |
| `front-end/src/router/index.js` | Add datasource routes |
| `front-end/src/views/DatasetList.vue` | Add source badge + "从数据库创建" entry |

---

## Task 11: Driver Registry + Crypto + Dialects

**Files:**
- Create: `backend/src/datasources/drivers.js`
- Create: `backend/src/datasources/crypto.js`
- Create: `backend/src/datasources/dialects.js`
- Create: `backend/test/task11-drivers.test.js`
- Create: `backend/test/task12-crypto.test.js`
- Create: `backend/test/task13-dialects.test.js`

- [ ] **Step 1: Write failing test for drivers registry**

Create `backend/test/task11-drivers.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const drivers = require('../src/datasources/drivers');

test('drivers registry has 22 entries', () => {
  assert.equal(drivers.length, 22);
});

test('each driver has required fields', () => {
  for (const d of drivers) {
    assert.ok(d.type, `missing type in ${JSON.stringify(d)}`);
    assert.ok(d.name, `missing name in ${d.type}`);
    assert.ok(d.category, `missing category in ${d.type}`);
    assert.ok(d.family, `missing family in ${d.type}`);
    assert.ok(['tested', 'compatible', 'planned'].includes(d.status), `invalid status in ${d.type}`);
    assert.ok(d.capabilities && typeof d.capabilities.test === 'boolean', `missing capabilities.test in ${d.type}`);
    assert.ok(d.defaultPort > 0 || d.defaultPort === null, `invalid defaultPort in ${d.type}`);
    assert.ok(Array.isArray(d.fields), `missing fields array in ${d.type}`);
  }
});

test('tested drivers have full capabilities', () => {
  const tested = drivers.filter((d) => d.status === 'tested');
  for (const d of tested) {
    assert.equal(d.capabilities.test, true, `${d.type} should support test`);
  }
});

test('planned drivers are disabled (capabilities false)', () => {
  const planned = drivers.filter((d) => d.status === 'planned');
  for (const d of planned) {
    assert.equal(d.capabilities.browse, false, `${d.type} browse should be false`);
    assert.equal(d.capabilities.dataset, false, `${d.type} dataset should be false`);
  }
});

test('field schemas have name, label, type, required', () => {
  for (const d of drivers) {
    for (const f of d.fields) {
      assert.ok(f.name, `missing field name in ${d.type}`);
      assert.ok(f.label, `missing field label in ${d.type}`);
      assert.ok(['text', 'number', 'boolean', 'select'].includes(f.type), `invalid field type ${f.type} in ${d.type}`);
      assert.equal(typeof f.required, 'boolean', `missing required in ${d.type}.${f.name}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/test/task11-drivers.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write driver registry**

Create `backend/src/datasources/drivers.js`:

```js
/**
 * 22 种数据源驱动注册表
 * status: 'tested'（本期实测）| 'compatible'（协议兼容）| 'planned'（待接入）
 * family: 'mysql' | 'pg' | 'clickhouse' | 'mssql' | 'es-rest' | 'http'
 */
module.exports = [
  { type: 'mysql', name: 'MySQL', category: '关系型', family: 'mysql', status: 'tested', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 3306, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 3306 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'postgres', name: 'PostgreSQL', category: '关系型', family: 'pg', status: 'tested', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 5432, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 5432 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'sqlserver', name: 'SQL Server', category: '关系型', family: 'mssql', status: 'tested', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 1433, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 1433 },
    { name: 'database', label: '数据库', type: 'text', required: true, default: 'master' },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'mariadb', name: 'MariaDB', category: '关系型', family: 'mysql', status: 'tested', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 3306, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 3306 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'tidb', name: 'TiDB', category: '关系型·国产', family: 'mysql', status: 'tested', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 4000, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 4000 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: false, default: '' },
  ]},
  { type: 'clickhouse', name: 'ClickHouse', category: '分析型', family: 'clickhouse', status: 'tested', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 8123, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 8123 },
    { name: 'database', label: '数据库', type: 'text', required: true, default: 'default' },
    { name: 'user', label: '用户名', type: 'text', required: true, default: 'default' },
    { name: 'password', label: '密码', type: 'password', required: false, default: '' },
  ]},
  { type: 'elasticsearch', name: 'Elasticsearch', category: '其他', family: 'es-rest', status: 'tested', capabilities: { test: true, browse: true, dataset: false }, defaultPort: 9200, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 9200 },
    { name: 'user', label: '用户名', type: 'text', required: false, default: '' },
    { name: 'password', label: '密码', type: 'password', required: false, default: '' },
  ]},
  { type: 'api', name: 'API/Web Service', category: '其他', family: 'http', status: 'tested', capabilities: { test: true, browse: false, dataset: false }, defaultPort: null, fields: [
    { name: 'url', label: 'URL', type: 'text', required: true },
    { name: 'method', label: '请求方法', type: 'select', required: true, options: ['GET', 'POST'], default: 'GET' },
    { name: 'headers', label: '请求头(JSON)', type: 'text', required: false, default: '{}' },
    { name: 'expectedStatus', label: '期望状态码', type: 'number', required: false, default: 200 },
  ]},
  { type: 'doris', name: 'Apache Doris', category: '分析型', family: 'mysql', status: 'compatible', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 9030, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 9030 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'starrocks', name: 'StarRocks', category: '分析型', family: 'mysql', status: 'compatible', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 9030, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 9030 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'greenplum', name: 'Greenplum', category: '关系型', family: 'pg', status: 'compatible', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 5432, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 5432 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'kingbase', name: '人大金仓 KingbaseES', category: '关系型·国产', family: 'pg', status: 'compatible', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 54321, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 54321 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'gaussdb', name: 'GaussDB', category: '国产', family: 'pg', status: 'compatible', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 5432, fields: [
    { name: 'host', label: '主机', type: 'text', required: true, default: '127.0.0.1' },
    { name: 'port', label: '端口', type: 'number', required: true, default: 5432 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'redshift', name: 'Amazon Redshift', category: '其他', family: 'pg', status: 'compatible', capabilities: { test: true, browse: true, dataset: true }, defaultPort: 5439, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 5439 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'oracle', name: 'Oracle', category: '关系型', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 1521, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 1521 },
    { name: 'service_name', label: '服务名', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'db2', name: 'DB2', category: '关系型', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 50000, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 50000 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'dameng', name: '达梦 DM', category: '国产', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 5236, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 5236 },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'gbase', name: '南大通用 GBASE', category: '国产', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 5258, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 5258 },
    { name: 'database', label: '数据库', type: 'text', required: true },
    { name: 'user', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
  ]},
  { type: 'hive', name: 'Apache Hive', category: '分析型', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 10000, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 10000 },
    { name: 'database', label: '数据库', type: 'text', required: true },
  ]},
  { type: 'impala', name: 'Apache Impala', category: '分析型', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 21050, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 21050 },
    { name: 'database', label: '数据库', type: 'text', required: true },
  ]},
  { type: 'presto', name: 'Presto', category: '分析型', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: 8080, fields: [
    { name: 'host', label: '主机', type: 'text', required: true },
    { name: 'port', label: '端口', type: 'number', required: true, default: 8080 },
    { name: 'catalog', label: 'Catalog', type: 'text', required: true },
    { name: 'schema', label: 'Schema', type: 'text', required: true },
  ]},
  { type: 'maxcompute', name: '阿里云 MaxCompute', category: '其他', family: 'none', status: 'planned', capabilities: { test: false, browse: false, dataset: false }, defaultPort: null, fields: [
    { name: 'endpoint', label: 'Endpoint', type: 'text', required: true },
    { name: 'access_key_id', label: 'AccessKey ID', type: 'text', required: true },
    { name: 'access_key_secret', label: 'AccessKey Secret', type: 'password', required: true },
    { name: 'project', label: 'Project', type: 'text', required: true },
  ]},
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/test/task11-drivers.test.js`
Expected: PASS

- [ ] **Step 5: Write failing test for crypto**

Create `backend/test/task12-crypto.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('../src/datasources/crypto');

test('encrypt then decrypt returns original', () => {
  const plain = 'Kanban@123';
  const enc = crypto.encrypt(plain);
  assert.notEqual(enc, plain, 'encrypted should differ from plain');
  const dec = crypto.decrypt(enc);
  assert.equal(dec, plain);
});

test('tampered ciphertext throws', () => {
  const enc = crypto.encrypt('secret');
  // corrupt last 2 chars
  const tampered = enc.slice(0, -2) + (enc.slice(-2) === 'aa' ? 'bb' : 'aa');
  assert.throws(() => crypto.decrypt(tampered), /decrypt/i);
});

test('mask hides password', () => {
  const masked = crypto.mask('my-secret-pw');
  assert.equal(masked, 'my-s****');
  assert.equal(crypto.mask(''), '');
  assert.equal(crypto.mask(null), '');
  assert.equal(crypto.mask(undefined), '');
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test backend/test/task12-crypto.test.js`
Expected: FAIL — module not found

- [ ] **Step 7: Write crypto module**

Create `backend/src/datasources/crypto.js`:

```js
const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const KEY = getOrCreateKey();

function getOrCreateKey() {
  const raw = process.env.DATASOURCE_SECRET || 'kanban-dev-datasource-secret-32b!';
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * AES-256-GCM encrypt: returns base64 string with iv:tag:ciphertext
 */
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/**
 * AES-256-GCM decrypt: throws on tamper
 */
function decrypt(cipherText) {
  const [ivB64, tagB64, dataB64] = String(cipherText).split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Mask password for safe display: first 4 chars + asterisks
 */
function mask(plain) {
  if (!plain) return '';
  const s = String(plain);
  if (s.length <= 4) return '****';
  return s.slice(0, 4) + '*'.repeat(s.length - 4);
}

module.exports = { encrypt, decrypt, mask };
```

- [ ] **Step 8: Run crypto test to verify it passes**

Run: `node --test backend/test/task12-crypto.test.js`
Expected: PASS

- [ ] **Step 9: Write failing test for dialects**

Create `backend/test/task13-dialects.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dialects = require('../src/datasources/dialects');

test('mysql quoteIdent uses backticks', () => {
  assert.equal(dialects.mysql.quoteIdent('col'), '`col`');
  assert.equal(dialects.mysql.quoteIdent('my table'), '`my table`');
});

test('pg quoteIdent uses double quotes', () => {
  assert.equal(dialects.pg.quoteIdent('col'), '"col"');
});

test('clickhouse quoteIdent uses double quotes', () => {
  assert.equal(dialects.clickhouse.quoteIdent('col'), '"col"');
});

test('mssql quoteIdent uses brackets', () => {
  assert.equal(dialects.mssql.quoteIdent('col'), '[col]');
});

test('mysql limit uses LIMIT n', () => {
  assert.equal(dialects.mysql.limit('SELECT * FROM t', 10), 'SELECT * FROM t LIMIT 10');
});

test('mssql limit uses TOP n', () => {
  assert.equal(dialects.mssql.limit('SELECT * FROM t', 10), 'SELECT TOP (10) * FROM t');
});

test('mysql dateTrunc uses DATE_FORMAT', () => {
  const sql = dialects.mysql.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATE_FORMAT'), 'should use DATE_FORMAT');
  assert.ok(sql.includes('%Y-%m'), 'should use %Y-%m pattern');
});

test('pg dateTrunc uses DATE_TRUNC', () => {
  const sql = dialects.pg.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATE_TRUNC'), 'should use DATE_TRUNC');
});

test('clickhouse dateTrunc uses toStartOfMonth', () => {
  const sql = dialects.clickhouse.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('toStartOfMonth'), 'should use toStartOfMonth');
});

test('mssql dateTrunc uses DATETRUNC', () => {
  const sql = dialects.mssql.dateTrunc('created_at', 'month');
  assert.ok(sql.includes('DATETRUNC'), 'should use DATETRUNC');
});

test('all dialects have quoteIdent, limit, dateTrunc, typeMapping, placeholder', () => {
  for (const [name, d] of Object.entries(dialects)) {
    assert.equal(typeof d.quoteIdent, 'function', `${name} missing quoteIdent`);
    assert.equal(typeof d.limit, 'function', `${name} missing limit`);
    assert.equal(typeof d.dateTrunc, 'function', `${name} missing dateTrunc`);
    assert.ok(d.typeMapping, `${name} missing typeMapping`);
    assert.equal(typeof d.placeholder, 'function', `${name} missing placeholder`);
  }
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `node --test backend/test/task13-dialects.test.js`
Expected: FAIL — module not found

- [ ] **Step 11: Write dialects module**

Create `backend/src/datasources/dialects.js`:

```js
const mysql = {
  quoteIdent: (name) => `\`${String(name).replace(/`/g, '``')}\``,
  limit: (sql, n) => `${sql} LIMIT ${Number(n)}`,
  dateTrunc: (field, unit) => {
    const map = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m', year: '%Y' };
    return `DATE_FORMAT(${mysql.quoteIdent(field)}, '${map[unit] || map.month}')`;
  },
  typeMapping: { integer: 'BIGINT', number: 'DOUBLE', string: 'TEXT', date: 'DATE', boolean: 'TINYINT(1)' },
  placeholder: (i) => '?',
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
  placeholder: (i) => `{val${i}}`,
  agg: { count: 'COUNT', count_distinct: 'uniqExact', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
};

const mssql = {
  quoteIdent: (name) => `[${String(name).replace(/]/g, ']]')}]`,
  limit: (sql, n) => {
    // Replace SELECT ... FROM with SELECT TOP (n) ... FROM
    return sql.replace(/^SELECT\s+/i, `SELECT TOP (${Number(n)}) `);
  },
  dateTrunc: (field, unit) => {
    const map = { day: 'day', week: 'week', month: 'month', year: 'year' };
    return `DATETRUNC('${map[unit] || 'month'}', ${mssql.quoteIdent(field)})`;
  },
  typeMapping: { integer: 'BIGINT', number: 'FLOAT', string: 'NVARCHAR(MAX)', date: 'DATE', bit: 'BIT' },
  placeholder: (i) => `@p${i}`,
  agg: { count: 'COUNT', count_distinct: 'COUNT(DISTINCT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN' },
};

module.exports = { mysql, pg, clickhouse, mssql };
```

- [ ] **Step 12: Run dialects test to verify it passes**

Run: `node --test backend/test/task13-dialects.test.js`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add backend/src/datasources/ backend/test/task11-drivers.test.js backend/test/task12-crypto.test.js backend/test/task13-dialects.test.js
git commit -m "feat(m2): driver registry + AES-256-GCM crypto + SQL dialects"
```

---

## Task 12: data_sources Table + CRUD/Test API + RBAC

**Files:**
- Modify: `backend/src/db.js` (add data_sources table + datasets ALTER)
- Modify: `backend/src/services/access.service.js` (add datasource to RESOURCE_TABLES)
- Create: `backend/src/services/datasource.service.js`
- Create: `backend/src/routes/datasource.routes.js`
- Modify: `backend/src/app.js` (mount routes)
- Modify: `backend/test/helpers/db.js` (add data_sources DELETE to resetDb)
- Create: `backend/test/task14-datasource-api.test.js`

- [ ] **Step 1: Add data_sources table + datasets ALTER to db.js**

Add at the end of the existing db.exec block in `backend/src/db.js` (after the refresh_tokens index), before the `ensureDatasetTable` function:

```js
// M2: data_sources 表
db.exec(`
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  owner_id INTEGER,
  last_test_at TEXT,
  last_test_ok INTEGER,
  last_test_msg TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_data_sources_owner ON data_sources(owner_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
`);

// M2: datasets 增列（幂等 ALTER）
const dsCols = db.prepare("PRAGMA table_info('datasets')").all().map((c) => c.name);
if (!dsCols.includes('source_type')) db.exec("ALTER TABLE datasets ADD COLUMN source_type TEXT NOT NULL DEFAULT 'excel'");
if (!dsCols.includes('datasource_id')) db.exec("ALTER TABLE datasets ADD COLUMN datasource_id INTEGER");
if (!dsCols.includes('schema_name')) db.exec("ALTER TABLE datasets ADD COLUMN schema_name TEXT");
if (!dsCols.includes('table_name_ext')) db.exec("ALTER TABLE datasets ADD COLUMN table_name_ext TEXT");
```

- [ ] **Step 2: Add datasource to access.service.js RESOURCE_TABLES**

In `backend/src/services/access.service.js`, add `datasource` entries:

```js
const RESOURCE_TABLES = {
  dataset: 'datasets', datasets: 'datasets',
  chart: 'charts', charts: 'charts',
  dashboard: 'dashboards', dashboards: 'dashboards',
  datasource: 'data_sources', datasources: 'data_sources',
};
```

- [ ] **Step 3: Update test helpers resetDb**

In `backend/test/helpers/db.js`, add `data_sources` DELETE:

```js
function resetDb() {
  db.exec(`
    DELETE FROM user_roles; DELETE FROM role_permissions; DELETE FROM refresh_tokens;
    DELETE FROM audit_logs; DELETE FROM users; DELETE FROM roles; DELETE FROM permissions;
    DELETE FROM datasets; DELETE FROM charts; DELETE FROM dashboards;
    DELETE FROM data_sources;
  `);
  seed();
}
```

- [ ] **Step 4: Create datasource service**

Create `backend/src/services/datasource.service.js`:

```js
const db = require('../db');
const HttpError = require('../utils/http-error');
const { encrypt, decrypt, mask } = require('../datasources/crypto');
const drivers = require('../datasources/drivers');
const providers = require('../datasources/providers');
const audit = require('./audit.service');

function getDriverMeta(type) {
  const d = drivers.find((x) => x.type === type);
  if (!d) throw new HttpError(400, `不支持的数据源类型: ${type}`);
  return d;
}

function safeConfig(config, driverMeta) {
  const cfg = { ...config };
  const pwFields = (driverMeta.fields || []).filter((f) => f.type === 'password');
  for (const f of pwFields) {
    if (cfg[f.name]) cfg[f.name] = encrypt(cfg[f.name]);
  }
  return cfg;
}

function safeConfigMasked(config, driverMeta) {
  const cfg = { ...config };
  const pwFields = (driverMeta.fields || []).filter((f) => f.type === 'password');
  for (const f of pwFields) {
    if (cfg[f.name]) cfg[f.name] = '********';
  }
  return cfg;
}

function decryptConfig(config) {
  const cfg = { ...config };
  // Try to decrypt all password-like fields (iv:tag:ciphertext format)
  for (const [k, v] of Object.entries(cfg)) {
    if (typeof v === 'string' && v.includes(':') && v.split(':').length === 3) {
      try { cfg[k] = decrypt(v); } catch (e) { /* not encrypted */ }
    }
  }
  return cfg;
}

function toPublic(row) {
  if (!row) return null;
  const driverMeta = getDriverMeta(row.type);
  return {
    ...row,
    config: safeConfigMasked(row.config ? JSON.parse(row.config) : {}, driverMeta),
    is_active: !!row.is_active,
    last_test_ok: row.last_test_ok != null ? !!row.last_test_ok : null,
  };
}

function toPublicDetail(row) {
  return toPublic(row);
}

function list(ownerId) {
  const rows = db.prepare('SELECT * FROM data_sources WHERE owner_id = ? ORDER BY id DESC').all(ownerId);
  return rows.map(toPublic);
}

function get(id, ownerId) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  return toPublicDetail(row);
}

function create({ name, type, config }, ownerId, req) {
  const driverMeta = getDriverMeta(type);
  if (driverMeta.status === 'planned') throw new HttpError(400, `${driverMeta.name} 暂不支持接入`);
  const cfg = safeConfig(config || {}, driverMeta);
  const r = db.prepare(
    'INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)'
  ).run(String(name || '').trim().slice(0, 100), type, JSON.stringify(cfg), ownerId);
  const id = Number(r.lastInsertRowid);
  audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.create', resourceType: 'datasource', resourceId: id, detail: { name, type } }, req);
  return get(id, ownerId);
}

function update(id, { name, type, config, is_active }, ownerId, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(type || row.type);
  const curConfig = row.config ? JSON.parse(row.config) : {};
  let cfg;
  if (config) {
    // Password fields: if value is '********', keep existing encrypted value
    const pwFields = (driverMeta.fields || []).filter((f) => f.type === 'password');
    cfg = { ...curConfig, ...config };
    for (const f of pwFields) {
      if (cfg[f.name] === '********') cfg[f.name] = curConfig[f.name];
    }
    cfg = safeConfig(cfg, driverMeta);
  } else {
    cfg = curConfig;
  }
  db.prepare(
    "UPDATE data_sources SET name = ?, type = ?, config = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(
    name !== undefined ? String(name).trim().slice(0, 100) : row.name,
    type || row.type,
    JSON.stringify(cfg),
    is_active !== undefined ? (is_active ? 1 : 0) : row.is_active,
    id
  );
  audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.update', resourceType: 'datasource', resourceId: id, detail: { name, type } }, req);
  return get(id, ownerId);
}

function remove(id, ownerId, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) throw new HttpError(404, '数据源不存在');
  const dsCount = db.prepare('SELECT COUNT(*) n FROM datasets WHERE datasource_id = ?').get(id).n;
  if (dsCount > 0) throw new HttpError(400, `该数据源已被 ${dsCount} 个数据集引用，请先删除关联数据集`);
  db.prepare('DELETE FROM data_sources WHERE id = ?').run(id);
  audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.delete', resourceType: 'datasource', resourceId: id, detail: { name: row.name } }, req);
  return true;
}

async function testConnection(config, type) {
  const driverMeta = getDriverMeta(type);
  if (driverMeta.status === 'planned') throw new HttpError(400, `${driverMeta.name} 暂不支持`);
  const provider = providers.getProvider(driverMeta.family);
  if (!provider) throw new HttpError(500, `未知协议族: ${driverMeta.family}`);
  const cfg = decryptConfig(config || {});
  const result = await provider.testConnection(cfg, type);
  return result;
}

async function testSaved(id, ownerId, req) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  const cfg = decryptConfig(row.config ? JSON.parse(row.config) : {});
  const provider = providers.getProvider(driverMeta.family);
  let ok = false, msg = '';
  try {
    const result = await provider.testConnection(cfg, row.type);
    ok = result.ok;
    msg = result.message || '';
  } catch (e) {
    msg = e.message;
  }
  db.prepare(
    "UPDATE data_sources SET last_test_at = datetime('now'), last_test_ok = ?, last_test_msg = ? WHERE id = ?"
  ).run(ok ? 1 : 0, msg, id);
  audit.log({ userId: ownerId, email: req?.user?.email, action: 'datasource.test', resourceType: 'datasource', resourceId: id, detail: { ok, msg } }, req);
  return { ok, message: msg };
}

async function listSchemas(id, ownerId) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const cfg = decryptConfig(row.config ? JSON.parse(row.config) : {});
  const provider = providers.getProvider(driverMeta.family);
  return provider.listSchemas(cfg, row.type);
}

async function listTables(id, ownerId, schema) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const cfg = decryptConfig(row.config ? JSON.parse(row.config) : {});
  const provider = providers.getProvider(driverMeta.family);
  return provider.listTables(cfg, row.type, schema);
}

async function listColumns(id, ownerId, schema, table) {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  if (!driverMeta.capabilities.browse) throw new HttpError(400, `${driverMeta.name} 不支持 Schema 浏览`);
  const cfg = decryptConfig(row.config ? JSON.parse(row.config) : {});
  const provider = providers.getProvider(driverMeta.family);
  return provider.listColumns(cfg, row.type, schema, table);
}

module.exports = {
  getDriverMeta, list, get, create, update, remove,
  testConnection, testSaved, listSchemas, listTables, listColumns,
};
```

- [ ] **Step 5: Create datasource routes**

Create `backend/src/routes/datasource.routes.js`:

```js
const express = require('express');
const { z } = require('zod');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const datasourceService = require('../services/datasource.service');
const drivers = require('../datasources/drivers');

const router = express.Router();

// GET /api/datasources/drivers
router.get('/drivers', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  ok(res, drivers.map((d) => ({
    type: d.type, name: d.name, category: d.category,
    status: d.status, capabilities: d.capabilities,
    defaultPort: d.defaultPort, fields: d.fields,
  })));
});

// GET /api/datasources
router.get('/', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  const items = datasourceService.list(req.user.id);
  ok(res, items);
});

// POST /api/datasources/test (unconfigured test)
router.post('/test', requireUser, requirePermission('datasource', 'create'), async (req, res) => {
  const { type, config } = req.body;
  if (!type || !config) throw new (require('../utils/http-error'))(400, '缺少 type 或 config');
  const result = await datasourceService.testConnection(config, type);
  ok(res, result);
});

// POST /api/datasources
router.post('/', requireUser, requirePermission('datasource', 'create'), (req, res) => {
  const { name, type, config } = req.body;
  if (!name || !type) throw new (require('../utils/http-error'))(400, '缺少名称或类型');
  const ds = datasourceService.create({ name, type, config }, req.user.id, req);
  ok(res, ds, '数据源创建成功');
});

// GET /api/datasources/:id
router.get('/:id', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const ds = datasourceService.get(id, req.user.id);
  if (!ds) throw new (require('../utils/http-error'))(404, '数据源不存在');
  ok(res, ds);
});

// PATCH /api/datasources/:id
router.patch('/:id', requireUser, requirePermission('datasource', 'update'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const ds = datasourceService.update(id, req.body, req.user.id, req);
  ok(res, ds, '更新成功');
});

// DELETE /api/datasources/:id
router.delete('/:id', requireUser, requirePermission('datasource', 'delete'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  datasourceService.remove(id, req.user.id, req);
  ok(res, true, '删除成功');
});

// POST /api/datasources/:id/test
router.post('/:id/test', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const result = await datasourceService.testSaved(id, req.user.id, req);
  ok(res, result);
});

// GET /api/datasources/:id/schemas
router.get('/:id/schemas', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const schemas = await datasourceService.listSchemas(id, req.user.id);
  ok(res, schemas);
});

// GET /api/datasources/:id/schemas/:schema/tables
router.get('/:id/schemas/:schema/tables', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const tables = await datasourceService.listTables(id, req.user.id, req.params.schema);
  ok(res, tables);
});

// GET /api/datasources/:id/schemas/:schema/tables/:table/columns
router.get('/:id/schemas/:schema/tables/:table/columns', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const columns = await datasourceService.listColumns(id, req.user.id, req.params.schema, req.params.table);
  ok(res, columns);
});

module.exports = router;
```

- [ ] **Step 6: Mount datasource routes in app.js**

In `backend/src/app.js`, add after the existing route imports:

```js
const datasourceRoutes = require('./routes/datasource.routes');
```

And add after the `adminRoutes` mount:

```js
app.use('/api/datasources', datasourceRoutes);
```

- [ ] **Step 7: Write failing test for datasource API**

Create `backend/test/task14-datasource-api.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const jwtUtil = require('../src/utils/jwt');

let server; let base;
let adminToken;

before(async () => {
  resetDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const admin = authService.login('admin@kanban.local', 'admin123');
  adminToken = admin.accessToken;
});

function auth(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

test('GET /api/datasources/drivers returns 22 drivers', async () => {
  const res = await fetch(`${base}/api/datasources/drivers`, { headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.length, 22);
  assert.ok(body.data[0].type);
  assert.ok(body.data[0].fields);
});

test('GET /api/datasources returns empty list initially', async () => {
  const res = await fetch(`${base}/api/datasources`, { headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.length, 0);
});

test('POST /api/datasources creates a mysql datasource', async () => {
  const res = await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      name: 'Test MySQL',
      type: 'mysql',
      config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' },
    }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.name, 'Test MySQL');
  assert.equal(body.data.type, 'mysql');
  // Password should be masked
  assert.equal(body.data.config.password, '********');
});

test('GET /api/datasources/:id returns detail with masked password', async () => {
  const res = await fetch(`${base}/api/datasources/1`, { headers: auth(adminToken) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.config.password, '********');
});

test('PATCH /api/datasources/:id updates name', async () => {
  const res = await fetch(`${base}/api/datasources/1`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Renamed MySQL' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.name, 'Renamed MySQL');
});

test('DELETE /api/datasources/:id deletes', async () => {
  const res = await fetch(`${base}/api/datasources/1`, {
    method: 'DELETE',
    headers: auth(adminToken),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 0);
});

test('non-admin user cannot access others datasources', async () => {
  // Create a second user
  const u = authService.register({ email: 'other@x.com', password: 'Password123!', name: 'Other' });
  const userToken = jwtUtil.signAccess({ sub: u.id });
  // Create a datasource as admin
  await fetch(`${base}/api/datasources`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Admin DS', type: 'mysql', config: { host: '127.0.0.1', port: 3306, database: 'test', user: 'root', password: 'pw' } }),
  });
  // Other user should not see it
  const res = await fetch(`${base}/api/datasources`, { headers: auth(userToken) });
  const body = await res.json();
  assert.equal(body.data.length, 0);
});

test('unauthenticated returns 401', async () => {
  const res = await fetch(`${base}/api/datasources`);
  assert.equal(res.status, 401);
});

test('POST /api/datasources/test returns provider error for invalid config', async () => {
  const res = await fetch(`${base}/api/datasources/test`, {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ type: 'mysql', config: { host: '127.0.0.1', port: 1, database: 'x', user: 'root', password: 'x' } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  // Provider should return ok:false (connection refused)
  assert.equal(body.data.ok, false);
});

test('关闭临时 HTTP 服务', () => {
  server?.close();
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `node --test backend/test/task14-datasource-api.test.js`
Expected: FAIL — providers module not found

- [ ] **Step 9: Write stub providers**

Create `backend/src/datasources/providers/index.js`:

```js
const mysqlFamily = require('./mysql-family');
const pgFamily = require('./pg-family');
const clickhouse = require('./clickhouse');
const mssql = require('./mssql');
const elasticsearch = require('./elasticsearch');
const apiService = require('./api-service');

const MAP = {
  mysql: mysqlFamily,
  pg: pgFamily,
  clickhouse,
  mssql,
  'es-rest': elasticsearch,
  http: apiService,
};

function getProvider(family) {
  return MAP[family] || null;
}

module.exports = { getProvider };
```

Create `backend/src/datasources/providers/mysql-family.js`:

```js
const mysql = require('mysql2/promise');

async function testConnection(cfg, type) {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host, port: cfg.port, user: cfg.user,
      password: cfg.password || '', database: cfg.database,
      connectTimeout: 5000,
    });
    await conn.ping();
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

async function listSchemas(cfg) {
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    connectTimeout: 5000,
  });
  try {
    const [rows] = await conn.query('SHOW DATABASES');
    return rows.map((r) => ({ name: r.Database }));
  } finally {
    await conn.end().catch(() => {});
  }
}

async function listTables(cfg, type, schema) {
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    connectTimeout: 5000,
  });
  try {
    const [rows] = await conn.query(
      'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [schema]
    );
    return rows.map((r) => ({ name: r.name, type: r.type === 'BASE TABLE' ? 'table' : 'view' }));
  } finally {
    await conn.end().catch(() => {});
  }
}

async function listColumns(cfg, type, schema, table) {
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    connectTimeout: 5000,
  });
  try {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      role: /int|float|double|decimal|numeric|bigint|smallint|tinyint/.test(r.type) ? 'metric' : 'dimension',
    }));
  } finally {
    await conn.end().catch(() => {});
  }
}

async function runQuery(cfg, sql, params = []) {
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    connectTimeout: 5000,
  });
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    await conn.end().catch(() => {});
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };
```

Create `backend/src/datasources/providers/pg-family.js`:

```js
const { Pool } = require('pg');

function makePool(cfg) {
  return new Pool({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password || '', database: cfg.database,
    max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
  });
}

async function testConnection(cfg) {
  const pool = makePool(cfg);
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    await pool.end();
  }
}

async function listSchemas(cfg) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      "SELECT schema_name AS name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name"
    );
    return rows;
  } finally {
    await pool.end();
  }
}

async function listTables(cfg, type, schema) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      'SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
      [schema]
    );
    return rows.map((r) => ({ name: r.name, type: r.type === 'BASE TABLE' ? 'table' : 'view' }));
  } finally {
    await pool.end();
  }
}

async function listColumns(cfg, type, schema, table) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(
      `SELECT column_name AS name, data_type AS type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      role: /int|float|double|decimal|numeric|bigint|smallint/.test(r.type) ? 'metric' : 'dimension',
    }));
  } finally {
    await pool.end();
  }
}

async function runQuery(cfg, sql, params = []) {
  const pool = makePool(cfg);
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } finally {
    await pool.end();
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };
```

Create `backend/src/datasources/providers/clickhouse.js`:

```js
const http = require('http');

function request(cfg, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: cfg.host, port: cfg.port,
      path: path + (cfg.database ? `?database=${cfg.database}` : ''),
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'text/plain',
        ...(cfg.user ? { 'X-ClickHouse-User': cfg.user } : {}),
        ...(cfg.password ? { 'X-ClickHouse-Key': cfg.password } : {}),
      },
      timeout: 5000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`ClickHouse ${res.statusCode}: ${data.slice(0, 200)}`));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function testConnection(cfg) {
  try {
    const r = await request(cfg, '/ping');
    return { ok: r.trim() === 'Ok.' || r.includes('Ok'), message: r.trim() };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas(cfg) {
  const data = await request(cfg, '/?query=SELECT+name+FROM+system.databases+ORDER+BY+name');
  const lines = data.trim().split('\n').filter(Boolean);
  return lines.map((l) => ({ name: l.trim() }));
}

async function listTables(cfg, type, schema) {
  const data = await request(cfg, `/?query=SELECT+name,+engine+FROM+system.tables+WHERE+database='${schema.replace(/'/g, "''")}'`);
  const lines = data.trim().split('\n').filter(Boolean);
  return lines.map((l) => {
    const [name, engine] = l.split('\t');
    return { name: name.trim(), type: engine && engine.includes('VIEW') ? 'view' : 'table' };
  });
}

async function listColumns(cfg, type, schema, table) {
  const data = await request(cfg, `/?query=SELECT+name,+type+FROM+system.columns+WHERE+database='${schema.replace(/'/g, "''")}'AND+table='${table.replace(/'/g, "''")}'+ORDER+BY+position`);
  const lines = data.trim().split('\n').filter(Boolean);
  return lines.map((l) => {
    const [name, colType] = l.split('\t');
    return {
      name: name.trim(),
      type: colType ? colType.trim() : 'String',
      role: /Float|Int|UInt|Decimal|Double/.test(colType) ? 'metric' : 'dimension',
    };
  });
}

async function runQuery(cfg, sql, params = []) {
  let query = sql;
  // Replace ? with {0}, {1}, etc. for ClickHouse
  params.forEach((p, i) => {
    query = query.replace('?', typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : String(p));
  });
  const data = await request(cfg, '/?default_format=TabSeparatedWithNames', query);
  const lines = data.trim().split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line) => {
    const vals = line.split('\t');
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = vals[i] !== undefined ? vals[i].trim() : null; });
    return row;
  });
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };
```

Create `backend/src/datasources/providers/mssql.js`:

```js
const sql = require('mssql');

const CONFIG_MAP = {
  sqlserver: { ...cfg => ({
    server: cfg.host, port: cfg.port, database: cfg.database,
    user: cfg.user, password: cfg.password,
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 5000 },
  })},
};

function makeConfig(cfg) {
  return {
    server: cfg.host, port: cfg.port, database: cfg.database,
    user: cfg.user, password: cfg.password,
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 5000 },
    pool: { max: 5, idleTimeoutMillis: 10000 },
  };
}

async function testConnection(cfg) {
  try {
    const pool = await sql.connect(makeConfig(cfg));
    await pool.request().query('SELECT 1');
    pool.close();
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas(cfg) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const result = await pool.request().query(
      "SELECT name FROM sys.schemas WHERE name NOT IN ('sys','guest','INFORMATION_SCHEMA','db_owner') ORDER BY name"
    );
    return result.recordset.map((r) => ({ name: r.name }));
  } finally {
    pool.close();
  }
}

async function listTables(cfg, type, schema) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const result = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .query(
        "SELECT t.name AS name, t.type_desc AS type FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = @schema ORDER BY t.name"
      );
    return result.recordset.map((r) => ({
      name: r.name,
      type: r.type.includes('VIEW') ? 'view' : 'table',
    }));
  } finally {
    pool.close();
  }
}

async function listColumns(cfg, type, schema, table) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const result = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('table', sql.NVarChar, table)
      .query(
        `SELECT c.name, tp.name AS type
         FROM sys.columns c
         JOIN sys.types tp ON c.user_type_id = tp.user_type_id
         JOIN sys.tables t ON c.object_id = t.object_id
         JOIN sys.schemas s ON t.schema_id = s.schema_id
         WHERE s.name = @schema AND t.name = @table
         ORDER BY c.column_id`
      );
    return result.recordset.map((r) => ({
      name: r.name,
      type: r.type,
      role: /int|float|decimal|numeric|money|real/.test(r.type) ? 'metric' : 'dimension',
    }));
  } finally {
    pool.close();
  }
}

async function runQuery(cfg, sqlQuery, params = []) {
  const pool = await sql.connect(makeConfig(cfg));
  try {
    const req = pool.request();
    params.forEach((p, i) => req.input(`p${i}`, p));
    const result = await req.query(sqlQuery);
    return result.recordset;
  } finally {
    pool.close();
  }
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };
```

Create `backend/src/datasources/providers/elasticsearch.js`:

```js
const http = require('http');

function request(cfg, method, path, body) {
  return new Promise((resolve, reject) => {
    const auth = cfg.user && cfg.password
      ? Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')
      : null;
    const options = {
      hostname: cfg.host, port: cfg.port,
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Basic ${auth}` } : {}),
      },
      timeout: 5000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`ES ${res.statusCode}: ${data.slice(0, 200)}`));
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testConnection(cfg) {
  try {
    const health = await request(cfg, 'GET', '/_cluster/health');
    return { ok: true, message: `集群状态: ${health.status}` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas(cfg) {
  const indices = await request(cfg, 'GET', '/_cat/indices?format=json');
  const schemas = [...new Set(indices.map((i) => i.index).filter((n) => !n.startsWith('.')))];
  return schemas.map((name) => ({ name }));
}

async function listTables(cfg, type, schema) {
  // ES indices are treated as "tables"
  const indices = await request(cfg, 'GET', `/${schema}/_mapping`);
  return Object.keys(indices).map((name) => ({ name, type: 'table' }));
}

async function listColumns(cfg, type, schema, table) {
  const mapping = await request(cfg, 'GET', `/${table}/_mapping`);
  const props = mapping[table]?.mappings?.properties || {};
  return Object.entries(props).map(([name, def]) => ({
    name,
    type: def.type || 'text',
    role: ['integer', 'long', 'float', 'double', 'keyword'].includes(def.type) ? 'metric' : 'dimension',
  }));
}

module.exports = { testConnection, listSchemas, listTables, listColumns };
```

Create `backend/src/datasources/providers/api-service.js`:

```js
const http = require('http');
const https = require('https');

async function testConnection(cfg) {
  const url = cfg.url;
  if (!url) return { ok: false, message: '缺少 URL' };
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const headers = cfg.headers ? JSON.parse(cfg.headers) : {};
      const options = {
        hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search, method: cfg.method || 'GET',
        headers, timeout: 5000,
      };
      const req = mod.request(options, (res) => {
        const expected = cfg.expectedStatus || 200;
        if (res.statusCode === Number(expected)) {
          resolve({ ok: true, message: `状态码 ${res.statusCode}` });
        } else {
          resolve({ ok: false, message: `期望 ${expected}，实际 ${res.statusCode}` });
        }
        res.resume();
      });
      req.on('error', (e) => resolve({ ok: false, message: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: '连接超时' }); });
      req.end();
    } catch (e) {
      resolve({ ok: false, message: e.message });
    }
  });
}

module.exports = { testConnection };
```

- [ ] **Step 10: Run test to verify it passes**

Run: `node --test backend/test/task14-datasource-api.test.js`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add backend/src/db.js backend/src/services/access.service.js backend/src/services/datasource.service.js backend/src/routes/datasource.routes.js backend/src/app.js backend/test/helpers/db.js backend/test/task14-datasource-api.test.js backend/src/datasources/providers/
git commit -m "feat(m2): datasource CRUD API + RBAC + provider stubs"
```

---

## Task 13: MySQL/PG Family Providers (Live Docker)

- [x] **Step 1: Start Docker containers (user runs manually)**

User: `docker compose -f backend/scripts/datasource-live/docker-compose.yml up -d mysql postgres mariadb tidb`

- [x] **Step 2: Live smoke test — mysql-family**

User runs: `node -e "
const mysqlFamily = require('./backend/src/datasources/providers/mysql-family');
async function test() {
  const cfg = { host: '127.0.0.1', port: 13306, user: 'root', password: 'Kanban@123', database: 'testdb' };
  console.log('testConnection:', await mysqlFamily.testConnection(cfg, 'mysql'));
  console.log('listSchemas:', JSON.stringify(await mysqlFamily.listSchemas(cfg)));
  console.log('listTables:', JSON.stringify(await mysqlFamily.listTables(cfg, 'mysql', 'testdb')));
  console.log('listColumns:', JSON.stringify(await mysqlFamily.listColumns(cfg, 'mysql', 'testdb', 'sales')));
}
test().catch(console.error);
"`

Expected: All return data, testConnection {ok:true}

- [x] **Step 3: Live smoke test — postgres**

User runs: `node -e "
const pgFamily = require('./backend/src/datasources/providers/pg-family');
async function test() {
  const cfg = { host: '127.0.0.1', port: 15432, user: 'postgres', password: 'Kanban@123', database: 'testdb' };
  console.log('testConnection:', await pgFamily.testConnection(cfg));
  console.log('listSchemas:', JSON.stringify(await pgFamily.listSchemas(cfg)));
  console.log('listTables:', JSON.stringify(await pgFamily.listTables(cfg, 'pg', 'public')));
}
test().catch(console.error);
"`

Expected: All return data, testConnection {ok:true}

- [x] **Step 4: Live smoke test — mariadb (mysql family)**

Same as mysql but port 13307. Expected: all pass.

- [x] **Step 5: Live smoke test — tidb (mysql family)**

Same as mysql but port 14000, password ''. Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add backend/src/datasources/providers/mysql-family.js backend/src/datasources/providers/pg-family.js
git commit -m "feat(m2): mysql/pg family providers verified against live Docker"
```

---

## Task 14: ClickHouse + MSSQL Providers (Live Docker)

- [x] **Step 1: Start Docker containers (user runs manually)**

User: `docker compose -f backend/scripts/datasource-live/docker-compose.yml up -d clickhouse mssql`

- [x] **Step 2: Live smoke test — clickhouse**

User runs: `node -e "
const ch = require('./backend/src/datasources/providers/clickhouse');
async function test() {
  const cfg = { host: '127.0.0.1', port: 18123, user: 'default', password: 'Kanban@123', database: 'testdb' };
  console.log('testConnection:', await ch.testConnection(cfg));
  console.log('listSchemas:', JSON.stringify(await ch.listSchemas(cfg)));
  console.log('listTables:', JSON.stringify(await ch.listTables(cfg, 'clickhouse', 'testdb')));
}
test().catch(console.error);
"`

Expected: All return data, testConnection {ok:true}

- [x] **Step 3: Live smoke test — mssql**

User runs: `node -e "
const mssqlProvider = require('./backend/src/datasources/providers/mssql');
async function test() {
  const cfg = { host: '127.0.0.1', port: 11433, user: 'sa', password: 'Kanban@123', database: 'master' };
  console.log('testConnection:', await mssqlProvider.testConnection(cfg));
  console.log('listSchemas:', JSON.stringify(await mssqlProvider.listSchemas(cfg)));
  console.log('listTables:', JSON.stringify(await mssqlProvider.listTables(cfg, 'mssql', 'dbo')));
}
test().catch(console.error);
"`

Expected: All return data, testConnection {ok:true}

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(m2): clickhouse/mssql providers verified against live Docker"
```

---

## Task 15: ES + API Providers (Live Docker)

- [ ] **Step 1: Start Docker containers (user runs manually)**

User: `docker compose -f backend/scripts/datasource-live/docker-compose.yml up -d elasticsearch`

- [ ] **Step 2: Live smoke test — elasticsearch**

User runs: `node -e "
const es = require('./backend/src/datasources/providers/elasticsearch');
async function test() {
  const cfg = { host: '127.0.0.1', port: 19200 };
  console.log('testConnection:', await es.testConnection(cfg));
  console.log('listSchemas:', JSON.stringify(await es.listSchemas(cfg)));
}
test().catch(console.error);
"`

Expected: testConnection {ok:true, message containing '集群状态'}

- [ ] **Step 3: Live smoke test — API service**

User runs: `node -e "
const api = require('./backend/src/datasources/providers/api-service');
async function test() {
  console.log('testConnection:', await api.testConnection({ url: 'https://httpbin.org/get', method: 'GET', expectedStatus: 200 }));
}
test().catch(console.error);
"`

Expected: testConnection {ok:true}

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(m2): ES/API providers verified against live Docker"
```

---

## Task 16: SqlDataProvider + register-table

**Files:**
- Create: `backend/src/datasources/sql-data-provider.js`
- Modify: `backend/src/services/dataset.service.js` (add registerSqlDataset)
- Modify: `backend/src/routes/datasource.routes.js` (add register-table endpoint)
- Modify: `backend/src/engines/query-engine.js` (dispatch by source_type)
- Create: `backend/test/task15-engine-sql.test.js`

- [ ] **Step 1: Write SqlDataProvider**

Create `backend/src/datasources/sql-data-provider.js`:

```js
const dialects = require('./dialects');
const providers = require('./providers');
const { getDriverMeta, decryptConfig } = require('../services/datasource.service');

/**
 * Build and run aggregation SQL for external datasource
 */
async function query(dataset, { dimensions, metrics, filters, sort, limit }) {
  const db = require('../db');
  const ds = db.prepare('SELECT * FROM datasets WHERE id = ?').get(dataset.id);
  if (!ds || ds.source_type !== 'sql') throw new Error('Not a SQL dataset');

  const dsConfig = ds.datasource_id
    ? db.prepare('SELECT * FROM data_sources WHERE id = ?').get(ds.datasource_id)
    : null;
  if (!dsConfig) throw new Error('数据源不存在');

  const driverMeta = getDriverMeta(dsConfig.type);
  const dialect = dialects[driverMeta.family];
  if (!dialect) throw new Error(`未知方言: ${driverMeta.family}`);

  const cfg = decryptConfig(JSON.parse(dsConfig.config));
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || !provider.runQuery) throw new Error('该数据源不支持查询');

  const schema = ds.schema_name;
  const table = ds.table_name_ext;
  const q = dialect.quoteIdent;
  const ph = dialect.placeholder;

  // Build SELECT
  const dimExprs = (dimensions || []).map((d, i) => {
    if (d.granularity) return `${dialect.dateTrunc(d.field, d.granularity)} AS ${q(`dim_${i}`)}`;
    return `${q(d.field)} AS ${q(`dim_${i}`)}`;
  });

  const metricExprs = (metrics || []).map((m, i) => {
    const agg = dialect.agg[m.agg] || 'COUNT';
    if (m.agg === 'count') return `${agg}(*) AS ${q(`m_${i}`)}`;
    if (m.agg === 'count_distinct') return `${agg}(${q(m.field)})) AS ${q(`m_${i}`)}`;
    return `${agg}(${q(m.field)}) AS ${q(`m_${i}`)}`;
  });

  const allExprs = [...dimExprs, ...metricExprs];
  const qualifiedTable = schema ? `${q(schema)}.${q(table)}` : q(table);

  let paramIdx = 0;
  const params = [];
  const whereClauses = (filters || []).map((f) => {
    const op = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE', in: 'IN' }[f.op];
    if (!op) throw new Error(`不支持的操作: ${f.op}`);
    if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [];
      params.push(...arr);
      paramIdx += arr.length;
      return `${q(f.field)} ${op} (${arr.map(() => ph(paramIdx - arr.length + arr.indexOf(f.value) + 1)).join(', ')})`;
    }
    if (f.op === 'contains') {
      params.push(`%${f.value}%`);
      paramIdx++;
      return `${q(f.field)} LIKE ${ph(paramIdx)}`;
    }
    params.push(f.value);
    paramIdx++;
    return `${q(f.field)} ${op} ${ph(paramIdx)}`;
  });

  let sql = `SELECT ${allExprs.join(', ')} FROM ${qualifiedTable}`;
  if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;
  if (dimExprs.length) sql += ` GROUP BY ${dimExprs.map((_, i) => `dim_${i}`).join(', ')}`;
  if (sort) sql = dialect.limit(sql, sort);
  if (limit) sql = dialect.limit(sql, limit);

  const rows = await provider.runQuery(cfg, sql, params);

  return {
    dimensions: (dimensions || []).map((d) => ({ field: d.field, label: d.label || d.field })),
    metrics: (metrics || []).map((m) => ({ field: m.field, agg: m.agg, label: m.label || m.field })),
    rows: rows.map((r) => {
      const row = {};
      (dimensions || []).forEach((d, i) => { row[d.field] = r[`dim_${i}`]; });
      (metrics || []).forEach((m, i) => { row[m.field] = r[`m_${i}`]; });
      return row;
    }),
    elapsedMs: 0,
    sql,
  };
}

module.exports = { query };
```

- [ ] **Step 2: Add registerSqlDataset to dataset.service.js**

Add to `backend/src/services/dataset.service.js`:

```js
function registerSqlDataset(name, datasourceId, schemaName, tableName, fields, ownerId) {
  const ins = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, schema_name, table_name_ext, owner_id)
     VALUES (?, ?, 0, ?, ?, 'sql', ?, ?, ?, ?)`
  );
  const info = ins.run(name, name, fields.length, tableName, datasourceId, schemaName, tableName, ownerId);
  const datasetId = Number(info.lastInsertRowid);

  const insField = db.prepare(
    'INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)'
  );
  fields.forEach((f, i) => {
    insField.run(datasetId, f.name, f.label || f.name, f.type || 'string', i);
  });

  return getDataset(datasetId);
}
```

And add `registerSqlDataset` to the module.exports.

- [ ] **Step 3: Add register-table endpoint to datasource routes**

Add to `backend/src/routes/datasource.routes.js`:

```js
// POST /api/datasources/:id/register-table
router.post('/:id/register-table', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { schema, table, name } = req.body;
  if (!table) throw new (require('../utils/http-error'))(400, '缺少表名');
  const columns = await datasourceService.listColumns(id, req.user.id, schema, table);
  const ds = require('../services/dataset.service').registerSqlDataset(
    name || table, id, schema, table,
    columns.map((c) => ({ name: c.name, label: c.name, type: c.role === 'metric' ? 'number' : 'string' })),
    req.user.id
  );
  ok(res, ds, '数据集创建成功');
});
```

- [ ] **Step 4: Modify query-engine.js for source_type dispatch**

In `backend/src/engines/query-engine.js`, modify the `aggregate` function to dispatch by `source_type`:

```js
const sqlDataProvider = require('../datasources/sql-data-provider');

function aggregate(query) {
  const ds = getDatasetOrThrow(query.datasetId);

  // SQL 数据集走 SqlDataProvider
  if (ds.source_type === 'sql') {
    return sqlDataProvider.query(ds, query);
  }

  // Excel 数据集走原有逻辑（以下保持不变）
  const fields = getFieldsOrThrow(query.datasetId);
  // ... existing code ...
```

Insert the `if (ds.source_type === 'sql')` block after getting `ds` and before getting `fields`.

- [ ] **Step 5: Write failing test for SqlDataProvider**

Create `backend/test/task15-engine-sql.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const datasetService = require('../src/services/dataset.service');
const sqlDataProvider = require('../src/datasources/sql-data-provider');

before(() => {
  resetDb();
});

test('registerSqlDataset creates dataset with source_type=sql', () => {
  // Insert a mock data_sources row
  db.prepare("INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)")
    .run('Test MySQL', 'mysql', '{"host":"127.0.0.1","port":13306}', 1);

  const ds = datasetService.registerSqlDataset(
    'Sales Table', 1, 'testdb', 'sales',
    [{ name: 'id', label: 'ID', type: 'integer' }, { name: 'amount', label: 'Amount', type: 'number' }],
    1
  );
  assert.equal(ds.source_type, 'sql');
  assert.equal(ds.datasource_id, 1);
  assert.equal(ds.schema_name, 'testdb');
  assert.equal(ds.table_name_ext, 'sales');
  assert.equal(ds.fields.length, 2);
});

test('existing aggregate still works for excel datasets', () => {
  // Create a regular Excel dataset
  const ds = datasetService.createDataset('Test Excel', [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'val', label: 'Value', type: 'number' },
  ], [{ name: 'A', val: 10 }, { name: 'B', val: 20 }], 1);

  const queryEngine = require('../src/engines/query-engine');
  const result = queryEngine.aggregate({
    datasetId: ds.id,
    dimensions: [{ field: 'name' }],
    metrics: [{ field: 'val', agg: 'sum' }],
    filters: [],
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]['dim:name'].value, 'A');
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test backend/test/task15-engine-sql.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/datasources/sql-data-provider.js backend/src/services/dataset.service.js backend/src/routes/datasource.routes.js backend/src/engines/query-engine.js backend/test/task15-engine-sql.test.js
git commit -m "feat(m2): SqlDataProvider + register-table + query engine dispatch"
```

---

## Task 17: Frontend DataSource Pages + CDP E2E

**Files:**
- Create: `front-end/src/views/DataSourceList.vue`
- Create: `front-end/src/views/DataSourceDetail.vue`
- Create: `front-end/src/views/DataSourceFormDialog.vue`
- Modify: `front-end/src/api/index.js` (add datasourceApi)
- Modify: `front-end/src/router/menu.js` (add menu item)
- Modify: `front-end/src/router/index.js` (add routes)
- Modify: `front-end/src/views/DatasetList.vue` (add source badge)

- [ ] **Step 1: Add datasourceApi to api/index.js**

Add to `front-end/src/api/index.js`:

```js
export const datasourceApi = {
  drivers: () => http.get('/datasources/drivers'),
  list: () => http.get('/datasources'),
  get: (id) => http.get(`/datasources/${id}`),
  create: (payload) => http.post('/datasources', payload),
  update: (id, payload) => http.patch(`/datasources/${id}`, payload),
  remove: (id) => http.delete(`/datasources/${id}`),
  test: (payload) => http.post('/datasources/test', payload),
  testSaved: (id) => http.post(`/datasources/${id}/test`),
  schemas: (id) => http.get(`/datasources/${id}/schemas`),
  tables: (id, schema) => http.get(`/datasources/${id}/schemas/${schema}/tables`),
  columns: (id, schema, table) => http.get(`/datasources/${id}/schemas/${schema}/tables/${table}/columns`),
  registerTable: (id, payload) => http.post(`/datasources/${id}/register-table`, payload),
}
```

- [ ] **Step 2: Add datasource menu item**

In `front-end/src/router/menu.js`, add to `MENU_ITEMS`:

```js
export const MENU_ITEMS = [
  { path: '/datasources', title: '数据源', icon: 'Coin' },
  { path: '/datasets', title: '数据管理', icon: 'FolderOpened' },
  { path: '/charts', title: '图表中心', icon: 'PieChart' },
  { path: '/dashboards', title: '看板中心', icon: 'Odometer' },
]
```

And update `activeMenuOf`:

```js
export function activeMenuOf(path) {
  if (path.startsWith('/admin')) return path
  if (path.startsWith('/datasources')) return '/datasources'
  if (path.startsWith('/dashboards')) return '/dashboards'
  if (path.startsWith('/charts')) return '/charts'
  return '/datasets'
}
```

- [ ] **Step 3: Add datasource routes**

In `front-end/src/router/index.js`, add to the children array:

```js
{ path: 'datasources', name: 'datasources', component: () => import('../views/DataSourceList.vue'), meta: { title: '数据源' } },
{ path: 'datasources/new', name: 'datasource-new', component: () => import('../views/DataSourceDetail.vue'), meta: { title: '新建数据源' } },
{ path: 'datasources/:id', name: 'datasource-detail', component: () => import('../views/DataSourceDetail.vue'), meta: { title: '数据源详情' } },
```

- [ ] **Step 4: Create DataSourceList.vue**

Create `front-end/src/views/DataSourceList.vue`:

```vue
<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">数据源</h2>
        <div class="page-desc">管理外部数据库连接，作为图表与看板的数据基础</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="showForm = true">
          <el-icon style="margin-right: 6px"><Plus /></el-icon>新建数据源
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">数据源列表</div>
        <div class="page-card__header-right">
          <el-tag type="info" effect="plain">共 {{ list.length }} 条</el-tag>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" empty-text="还没有数据源，点击右上角「新建数据源」开始">
        <el-table-column prop="name" label="名称" min-width="180">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Coin /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/datasources/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.type)">{{ typeName(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近测试" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.last_test_ok === true" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="row.last_test_ok === false" type="danger" size="small">失败</el-tag>
            <span v-else class="cell-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/datasources/${row.id}`)">详情</el-button>
            <el-button link type="primary" size="small" @click="editRow = row; showForm = true">编辑</el-button>
            <el-button link type="primary" size="small" @click="testOne(row)" :loading="testingId === row.id">测试</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <DataSourceFormDialog
      v-model="showForm"
      :edit-row="editRow"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { datasourceApi } from '@/api'
import DataSourceFormDialog from './DataSourceFormDialog.vue'

const list = ref([])
const loading = ref(false)
const showForm = ref(false)
const editRow = ref(null)
const testingId = ref(null)

function typeName(type) {
  const map = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlserver: 'SQL Server', mariadb: 'MariaDB', tidb: 'TiDB', clickhouse: 'ClickHouse', elasticsearch: 'Elasticsearch', api: 'API/Web Service', oracle: 'Oracle', db2: 'DB2', dameng: '达梦', gbase: 'GBASE', hive: 'Hive', impala: 'Impala', presto: 'Presto', maxcompute: 'MaxCompute', doris: 'Doris', starrocks: 'StarRocks', greenplum: 'Greenplum', kingbase: 'KingbaseES', gaussdb: 'GaussDB', redshift: 'Redshift' }
  return map[type] || type
}

function statusType(type) {
  const map = { mysql: '', postgres: '', sqlserver: '', mariadb: '', tidb: '', clickhouse: 'warning', elasticsearch: 'info', api: 'info' }
  return map[type] || 'info'
}

async function load() {
  loading.value = true
  try { list.value = await datasourceApi.list() } finally { loading.value = false }
}

async function testOne(row) {
  testingId.value = row.id
  try {
    const res = await datasourceApi.testSaved(row.id)
    ElMessage[res.ok ? 'success' : 'error'](`测试${res.ok ? '成功' : '失败'}: ${res.message}`)
    load()
  } finally { testingId.value = null }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除数据源「${row.name}」？`, '删除确认', { type: 'warning' })
  await datasourceApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

function onSaved() { showForm.value = false; editRow.value = null; load() }

onMounted(load)
</script>

<style scoped>
.cell-name { display: flex; align-items: center; gap: 8px; }
.cell-name__icon { width: 26px; height: 26px; border-radius: 6px; background: var(--app-primary-light); color: var(--app-primary); display: flex; align-items: center; justify-content: center; }
.cell-muted { color: var(--app-text-secondary); font-size: 13px; }
</style>
```

- [ ] **Step 5: Create DataSourceFormDialog.vue**

Create `front-end/src/views/DataSourceFormDialog.vue` (abbreviated — key parts shown):

```vue
<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="editRow ? '编辑数据源' : '新建数据源'" width="560px" destroy-on-close>
    <el-form :model="form" label-width="100px">
      <el-form-item label="数据源类型" required>
        <el-select v-model="form.type" placeholder="请选择" :disabled="!!editRow" style="width: 100%">
          <el-option-group v-for="cat in groupedDrivers" :key="cat.category" :label="cat.category">
            <el-option v-for="d in cat.items" :key="d.type" :value="d.type" :label="d.name" :disabled="d.status === 'planned'">
              <span>{{ d.name }}</span>
              <el-tag v-if="d.status === 'planned'" size="small" type="info" style="margin-left: 8px">暂不支持</el-tag>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="请输入数据源名称" maxlength="100" />
      </el-form-item>
      <template v-if="currentDriver">
        <el-form-item v-for="f in currentDriver.fields" :key="f.name" :label="f.label" :required="f.required">
          <el-input v-if="f.type === 'text' || f.type === 'password'" v-model="form.config[f.name]" :placeholder="f.default || ''" :type="f.type === 'password' ? 'password' : 'text'" />
          <el-input-number v-else-if="f.type === 'number'" v-model="form.config[f.name]" :min="1" :max="65535" />
          <el-select v-else-if="f.type === 'select'" v-model="form.config[f.name]">
            <el-option v-for="opt in f.options" :key="opt" :value="opt" :label="opt" />
          </el-select>
        </el-form-item>
      </template>
    </el-form>
    <div v-if="testResult" style="margin-top: 8px">
      <el-alert :type="testResult.ok ? 'success' : 'error'" :title="testResult.message" show-icon />
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button :loading="testing" @click="doTest">测试连接</el-button>
      <el-button type="primary" :loading="saving" @click="doSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { datasourceApi } from '@/api'

const props = defineProps({ modelValue: Boolean, editRow: Object })
const emit = defineEmits(['update:modelValue', 'saved'])

const drivers = ref([])
const form = ref({ name: '', type: '', config: {} })
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)

const groupedDrivers = computed(() => {
  const map = {}
  for (const d of drivers.value) {
    if (!map[d.category]) map[d.category] = { category: d.category, items: [] }
    map[d.category].items.push(d)
  }
  return Object.values(map)
})

const currentDriver = computed(() => drivers.value.find((d) => d.type === form.value.type))

watch(() => props.editRow, (row) => {
  if (row) {
    form.value = { name: row.name, type: row.type, config: { ...row.config } }
  } else {
    form.value = { name: '', type: '', config: {} }
  }
  testResult.value = null
}, { immediate: true })

async function loadDrivers() {
  drivers.value = await datasourceApi.drivers()
}

async function doTest() {
  if (!form.value.type) return ElMessage.warning('请选择数据源类型')
  testing.value = true
  testResult.value = null
  try {
    const res = await datasourceApi.test({ type: form.value.type, config: form.value.config })
    testResult.value = res
  } finally { testing.value = false }
}

async function doSave() {
  if (!form.value.name.trim()) return ElMessage.warning('请输入名称')
  if (!form.value.type) return ElMessage.warning('请选择类型')
  saving.value = true
  try {
    if (props.editRow) {
      await datasourceApi.update(props.editRow.id, form.value)
    } else {
      await datasourceApi.create(form.value)
    }
    ElMessage.success('保存成功')
    emit('saved')
  } finally { saving.value = false }
}

loadDrivers()
</script>
```

- [ ] **Step 6: Create DataSourceDetail.vue**

Create `front-end/src/views/DataSourceDetail.vue` (abbreviated):

```vue
<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ ds?.name || '数据源详情' }}</h2>
        <div class="page-desc">{{ ds?.type }} · {{ ds?.is_active ? '启用' : '停用' }}</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">返回</el-button>
        <el-button type="primary" :loading="testing" @click="doTest">测试连接</el-button>
      </div>
    </div>

    <el-card v-if="ds" shadow="never" style="margin-bottom: 16px">
      <div style="display: flex; gap: 40px; font-size: 13px; color: var(--app-text-secondary)">
        <div><strong>类型：</strong>{{ ds.type }}</div>
        <div><strong>最近测试：</strong>
          <el-tag v-if="ds.last_test_ok === true" type="success" size="small">成功</el-tag>
          <el-tag v-else-if="ds.last_test_ok === false" type="danger" size="small">失败</el-tag>
          <span v-else>未测试</span>
          <span v-if="ds.last_test_msg"> — {{ ds.last_test_msg }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>Schema 浏览</template>
      <el-tree
        v-if="schemas.length"
        :data="schemaTree"
        lazy
        :load="loadNode"
        node-key="id"
      >
        <template #default="{ node, data }">
          <span>{{ data.label }}</span>
          <el-button v-if="data.type === 'table'" link type="primary" size="small" style="margin-left: 8px" @click.stop="createDataset(data)">创建数据集</el-button>
        </template>
      </el-tree>
      <el-empty v-else description="暂无 Schema 数据" />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { datasourceApi } from '@/api'

const route = useRoute()
const router = useRouter()
const ds = ref(null)
const loading = ref(false)
const testing = ref(false)
const schemas = ref([])
const tablesMap = ref({})
const columnsMap = ref({})

const schemaTree = computed(() =>
  schemas.value.map((s) => ({
    id: `schema-${s.name}`, label: s.name, type: 'schema', children: [],
  }))
)

async function load() {
  if (!route.params.id) return
  loading.value = true
  try {
    ds.value = await datasourceApi.get(route.params.id)
    schemas.value = await datasourceApi.schemas(route.params.id)
  } finally { loading.value = false }
}

async function loadNode(node, resolve) {
  const id = route.params.id
  const data = node.data
  if (data.type === 'schema') {
    const tables = await datasourceApi.tables(id, data.label)
    resolve(tables.map((t) => ({
      id: `${data.label}-${t.name}`, label: t.name, type: 'table', schema: data.label, children: [],
    })))
  } else if (data.type === 'table') {
    const cols = await datasourceApi.columns(id, data.schema, data.label)
    resolve(cols.map((c) => ({
      id: `${data.schema}-${data.label}-${c.name}`, label: `${c.name} (${c.type})`, type: 'column', isLeaf: true,
    })))
  } else {
    resolve([])
  }
}

async function doTest() {
  testing.value = true
  try {
    const res = await datasourceApi.testSaved(route.params.id)
    ElMessage[res.ok ? 'success' : 'error'](`测试${res.ok ? '成功' : '失败'}: ${res.message}`)
    ds.value = await datasourceApi.get(route.params.id)
  } finally { testing.value = false }
}

async function createDataset(data) {
  const { value: dsName } = await ElMessageBox.prompt('请输入数据集名称', '创建数据集', {
    inputValue: data.label, confirmButtonText: '创建', cancelButtonText: '取消', inputValidator: (v) => !!v?.trim() || '名称不能为空',
  })
  await datasourceApi.registerTable(route.params.id, { schema: data.schema, table: data.label, name: dsName.trim() })
  ElMessage.success('数据集创建成功')
}

onMounted(load)
</script>
```

- [ ] **Step 7: Update DatasetList.vue — add source badge**

In `front-end/src/views/DatasetList.vue`, modify the table to show a source badge in the name column:

```vue
<el-table-column prop="name" label="名称" min-width="180">
  <template #default="{ row }">
    <div class="cell-name">
      <div class="cell-name__icon"><el-icon><Files /></el-icon></div>
      <el-link type="primary" @click="$router.push(`/datasets/${row.id}`)">{{ row.name }}</el-link>
      <el-tag v-if="row.source_type === 'sql'" type="success" size="small" effect="plain" style="margin-left: 4px">数据库</el-tag>
    </div>
  </template>
</el-table-column>
```

- [ ] **Step 8: Build and verify no errors**

Run: `cd front-end && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 9: Commit**

```bash
git add front-end/src/views/DataSourceList.vue front-end/src/views/DataSourceDetail.vue front-end/src/views/DataSourceFormDialog.vue front-end/src/api/index.js front-end/src/router/menu.js front-end/src/router/index.js front-end/src/views/DatasetList.vue
git commit -m "feat(m2): datasource frontend pages + router + API client"
```

---

## Task 18: Full Regression + Live E2E + README + Security Checklist

**Files:**
- Modify: `README.md` (M2 section)
- Modify: `需求清单-第二阶段.md` (check DB-01~05)
- Modify: `docs/superpowers/plans/2026-09-12-m2-datasources.md` (check all tasks)

- [ ] **Step 1: Run backend unit tests**

Run: `cd backend && npm test`
Expected: All tests pass (existing M1 + new M2 tests)

- [ ] **Step 2: Run frontend build**

Run: `cd front-end && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Start backend dev server**

Run: `cd backend && npm run dev`
Expected: Server starts on port 3001

- [ ] **Step 4: Start frontend dev server**

Run: `cd front-end && npm run dev`
Expected: Server starts on port 5173

- [ ] **Step 5: Run CDP e2e — config-panel**

Create `/tmp/probe-config-panel.mjs` and run with playwright-core. Test: navigate to http://localhost:5173, login as admin, go to /datasources, create MySQL datasource, test connection, browse schema tree, create dataset, go to /charts, create chart from SQL dataset.

- [ ] **Step 6: Run mac e2e — config-panel (from M1)**

Run existing mac e2e script. Expected: All tests pass.

- [ ] **Step 7: Run rbac e2e (from M1)**

Run existing rbac e2e script. Expected: All tests pass.

- [ ] **Step 8: Security self-check**

| Item | Status |
|---|---|
| Passwords AES-256-GCM encrypted | ✓ crypto.js |
| API never returns plaintext passwords | ✓ safeConfigMasked |
| SQL injection: identifiers from catalog only | ✓ provider listQueries |
| SQL injection: values via parameterized queries | ✓ placeholder system |
| RBAC: datasource:* permissions enforced | ✓ requirePermission |
| RBAC: owner isolation via access.service | ✓ assertResource |
| Docker passwords: env vars only, not hardcoded | ✓ docker-compose.yml |

- [ ] **Step 9: Update README**

Add M2 section to README.md covering data source support, architecture, Docker setup, and production notes (DATASOURCE_SECRET env var).

- [ ] **Step 10: Update 需求清单**

Mark DB-01~05 as `[已实现 M2]` in `需求清单-第二阶段.md`.

- [ ] **Step 11: Commit**

```bash
git add README.md 需求清单-第二阶段.md
git commit -m "docs(m2): README + requirements checklist update"
```

- [ ] **Step 12: Full regression — final commit**

```bash
cd backend && npm test && cd ../front-end && npm run build
git add -A && git commit -m "chore(m2): final regression pass"
```
