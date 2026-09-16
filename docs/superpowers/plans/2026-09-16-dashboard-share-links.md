# 看板分享链接（公开只读）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让看板创建者能创建带密码、可设置过期时间的多条分享链接，访客通过公开链接 + 密码只读查看看板。

**Architecture:** 新增 `dashboard_shares` 表存储分享记录；分「管理路由」(`/api/dashboards/:id/shares`、`/api/shares/:shareId`，需登录+`dashboard:share` 权限+资源所有权)与「公开路由」(`/api/public/shares/:token/*`，无登录态)两套。公开访问走 meta→verify(签发 24h share JWT)→dashboard/chart data 流程，复用现有 `query-engine` 取数。前端新增公开页 `/s/:token`（密码门禁 + 复用 DashboardCanvas 只读渲染）+ 管理侧 ShareDialog。

**Tech Stack:** Express 5 + better-sqlite3（跨 6 方言 DDL）、bcryptjs、jsonwebtoken、express-rate-limit、Vue 3 + Element Plus、Vite。

**前置设计文档：** `docs/superpowers/specs/2026-09-16-dashboard-share-links-design.md`

**用户约定：** 每次任务小步提交，只提交自己改动的文件，不得整批大提交。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `backend/src/db/ddl/{sqlite,mysql,postgres,mssql,oracle}.js` | 新增 `dashboard_shares` 表 DDL |
| `backend/src/services/share.service.js` | 分享记录 CRUD + token 生成 + 状态校验 + 公开看板载荷/图表数据组装 |
| `backend/src/utils/jwt.js` | 新增 `signShare` / `verifyShare`（typ:'share'，24h） |
| `backend/src/utils/http-error.js` | 支持自定义 `code`（默认=status） |
| `backend/src/middleware/response.js` | errorHandler 透传 `err.code` |
| `backend/src/middleware/share-auth.js` | `requireShareToken` / `requireShareJwt` |
| `backend/src/routes/share.routes.js` | 管理路由（dashSharesRouter + sharesRouter） |
| `backend/src/routes/public-share.routes.js` | 公开路由（meta/verify/dashboard/data）+ 限流 |
| `backend/src/app.js` | 挂载新路由 |
| `backend/src/seeds.js` | 新增权限位 `dashboard:share` + editor 角色授权 |
| `backend/test/share.test.js` | 后端全链路集成测试 |
| `front-end/src/api/share.js` | 公开分享 axios 实例 + shareApi |
| `front-end/src/api/index.js` | dashboardApi 增加 shares/createShare/updateShare/deleteShare |
| `front-end/src/router/index.js` | `/s/:token` 公开路由 + 守卫放行 |
| `front-end/src/views/ShareBoardView.vue` | 门禁 + 只读看板页 |
| `front-end/src/components/dashboard/ShareDialog.vue` | 管理侧分享弹窗 |
| `front-end/src/views/DashboardList.vue` | 行操增加「分享」入口 |
| `front-end/src/components/dashboard/ChartTile.vue` | 支持 `inject('shareApiOverride')` 覆盖数据源 |
| `front-end/src/components/dashboard/DashboardCanvas.vue` | 同上（loadChartData 走覆盖源） |

---

## Task 1: 数据层 — dashboard_shares 表

**Files:**
- Modify: `backend/src/db/ddl/sqlite.js`
- Modify: `backend/src/db/ddl/mysql.js`
- Modify: `backend/src/db/ddl/postgres.js`
- Modify: `backend/src/db/ddl/mssql.js`
- Modify: `backend/src/db/ddl/oracle.js`

- [ ] **Step 1: sqlite DDL** — 在 `sqlite.js` 末尾 `sync_locks` 语句之后追加：

```js
  `CREATE TABLE IF NOT EXISTS dashboard_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT, dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    expires_at TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id)',
```

- [ ] **Step 2: mysql DDL** — 在 `mysql.js` 的 `sync_locks` 之前追加：

```js
  `CREATE TABLE IF NOT EXISTS dashboard_shares (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, dashboard_id BIGINT NOT NULL,
    token VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME, is_active TINYINT(1) NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dashboard_shares_token (token),
    KEY idx_dashboard_shares_dashboard (dashboard_id),
    CONSTRAINT fk_dashboard_shares_dash FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
  )`,
```

- [ ] **Step 3: postgres DDL** — 在 `postgres.js`（有 IF NOT EXISTS）中 `sync_locks` 之前追加：

```js
  `CREATE TABLE IF NOT EXISTS dashboard_shares (
    id BIGSERIAL PRIMARY KEY, dashboard_id BIGINT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    expires_at TIMESTAMP, is_active SMALLINT NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id)',
```

- [ ] **Step 4: mssql DDL** — 在 `mssql.js`（无 IF NOT EXISTS）中 `sync_locks` 之前追加：

```js
  `CREATE TABLE dashboard_shares (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, dashboard_id BIGINT NOT NULL,
    token NVARCHAR(64) NOT NULL, password_hash NVARCHAR(255) NOT NULL,
    expires_at DATETIME2, is_active BIT NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_dashboard_shares_token UNIQUE (token),
    CONSTRAINT fk_dashboard_shares_dash FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id)',
```

- [ ] **Step 5: oracle DDL** — 在 `oracle.js`（无 IF NOT EXISTS）中 `sync_locks` 之前追加：

```js
  `CREATE TABLE "dashboard_shares" (
    "id" NUMBER(19) GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "dashboard_id" NUMBER(19) NOT NULL,
    "token" VARCHAR2(64) NOT NULL, "password_hash" VARCHAR2(255) NOT NULL,
    "expires_at" TIMESTAMP, "is_active" NUMBER(1) NOT NULL DEFAULT 1, "created_by" NUMBER(19) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP,
    CONSTRAINT uq_dashboard_shares_token UNIQUE ("token"),
    CONSTRAINT fk_dashboard_shares_dash FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_dashboard_shares_dashboard ON "dashboard_shares"("dashboard_id")',
```

> `schema.js` 的 `runDdl` 已按方言统一执行 DDL，无需额外改动——sqlite/mysql/mariadb/postgres 走 `IF NOT EXISTS`，mssql/oracle 走「查表存在性跳过」，老库启动即自动建表。

- [ ] **Step 6: 验证建表**

Run（backend 目录）:
```
node -e "process.env.DB_PATH='/tmp/kanban-share-ddl.db'; const db=require('./src/db'); const store=require('./src/db'); const r=store.all(\"SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_shares'\"); console.log(r.length===1?'OK':JSON.stringify(r)); require('fs').unlinkSync('/tmp/kanban-share-ddl.db')"
```
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/ddl/
git commit -m "feat(backend): dashboard_shares 表 DDL（6 方言）"
```

---

## Task 2: HttpError code + share JWT

**Files:**
- Modify: `backend/src/utils/http-error.js`
- Modify: `backend/src/middleware/response.js`
- Modify: `backend/src/utils/jwt.js`
- Test: `backend/test/task2-share-jwt.test.js`

- [ ] **Step 1: 写失败测试** — Create `backend/test/task2-share-jwt.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../src/utils/http-error');
const { signShare, verifyShare } = require('../src/utils/jwt');

test('HttpError 支持自定义 code（默认=status）', () => {
  const a = new HttpError(403, '已过期', null, 40301);
  assert.equal(a.status, 403);
  assert.equal(a.code, 40301);
  const b = new HttpError(404, '不存在');
  assert.equal(b.code, 404);
});

test('signShare/verifyShare 签发与校验（24h）', () => {
  const tok = signShare({ shareId: 7, dashboardId: 9, token: 'abc123' });
  const p = verifyShare(tok);
  assert.equal(p.type, 'share');
  assert.equal(p.shareId, 7);
  assert.equal(p.dashboardId, 9);
  assert.equal(p.token, 'abc123');
});

test('verifyShare 拒绝非 share 类型令牌', () => {
  const { signAccess } = require('../src/utils/jwt');
  const tok = signAccess({ sub: 1 });
  assert.throws(() => verifyShare(tok), (e) => e.status === 401);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/task2-share-jwt.test.js`（backend 目录）
Expected: FAIL —— `signShare`/`verifyShare` is not a function，HttpError 无 `code` 字段

- [ ] **Step 3: 实现**

`backend/src/utils/http-error.js` 改为：

```js
class HttpError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code !== undefined ? code : status;
  }
}

module.exports = HttpError;
```

`backend/src/middleware/response.js` 中 errorHandler 内改用 `err.code`：

```js
  const body = { code: (err && err.code !== undefined) ? err.code : status, message, data: null };
```

`backend/src/utils/jwt.js` 追加（放 `verifyRefresh` 之后、`module.exports` 之前）：

```js
// 分享态令牌有效期（秒）：24h
const SHARE_MAX_AGE_SEC = 24 * 3600;

// 签发分享态访问令牌（typ:'share'，载荷含 shareId/dashboardId/token）
function signShare(payload) {
  return jwt.sign({ ...payload, type: 'share' }, config.auth.jwtSecret, { expiresIn: SHARE_MAX_AGE_SEC });
}

// 校验分享态令牌，失败统一 401
function verifyShare(token) {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    if (decoded.type !== 'share') throw new HttpError(401, '分享凭证无效');
    return decoded;
  } catch (e) {
    if (e.name === 'TokenExpiredError') throw new HttpError(401, '分享凭证已过期');
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, '分享凭证无效');
  }
}
```

并在 `module.exports` 中加入：`signShare, verifyShare, SHARE_MAX_AGE_SEC`。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/task2-share-jwt.test.js`（backend 目录）
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/http-error.js backend/src/middleware/response.js backend/src/utils/jwt.js backend/test/task2-share-jwt.test.js
git commit -m "feat(backend): HttpError 自定义 code + 分享态 JWT 签发/校验"
```

---

## Task 3: share.service

**Files:**
- Create: `backend/src/services/share.service.js`
- Test: `backend/test/task3-share-service.test.js`

- [ ] **Step 1: 写失败测试** — Create `backend/test/task3-share-service.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-share-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const shareService = require('../src/services/share.service');

test('service 准备物料', async () => {
  await resetDb();
  await db.prepare('INSERT INTO dashboards (name, layout, owner_id) VALUES (?, ?, ?)').run('分享看板', '[]', 1);
});

test('createShare 校验 password 长度与过期时间', async () => {
  await assert.rejects(() => shareService.createShare({ dashboardId: 1, password: '12', expiresAt: null, userId: 1 }), (e) => e.status === 400);
  await assert.rejects(() => shareService.createShare({ dashboardId: 1, password: '1234', expiresAt: '2000-01-01T00:00:00.000Z', userId: 1 }), (e) => e.status === 400);
});

test('createShare/listShares/updateShare/deleteShare 全链路', async () => {
  const s = await shareService.createShare({ dashboardId: 1, password: 'pass1234', expiresAt: null, userId: 1 });
  assert.ok(s.id > 0);
  assert.equal(s.token.length, 22); // 16 字节 base64url
  assert.equal(s.passwordHash, undefined); // 管理视图不应含哈希
  assert.equal(s.isActive, 1);

  const list = await shareService.listShares(1);
  assert.equal(list.length, 1);
  assert.equal(list[0].passwordHash, undefined);

  const updated = await shareService.updateShare(s.id, { expiresAt: '2099-01-01T00:00:00.000Z', isActive: false });
  assert.equal(updated.isActive, 0);
  assert.equal(updated.expiresAt, '2099-01-01T00:00:00.000Z');

  const byToken = await shareService.getShareByToken(s.token);
  assert.equal(byToken.token, s.token);
  assert.ok(byToken.passwordHash);

  // shareState 判定
  assert.equal(shareService.shareState(byToken), 'inactive');
  await shareService.updateShare(s.id, { isActive: true });
  const active = await shareService.getShareByToken(s.token);
  assert.equal(shareService.shareState(active), 'active');

  await shareService.deleteShare(s.id);
  assert.equal((await shareService.listShares(1)).length, 0);
});

test('getDashboardRenderView 返回布局与图表元信息且不含敏感字段', async () => {
  await db.prepare('CREATE TABLE di_share_demo (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_demo (category, sales) VALUES (?, ?)').run('A', 10);
  const ds = await db.prepare('INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run('演示', 'x', 1, 2, 'di_share_demo', 1);
  const dsId = Number(ds.lastInsertRowid);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'sales', '销售额', 'number', 1);
  const cfg = JSON.stringify({ dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }] });
  const ch = await db.prepare('INSERT INTO charts (name, dataset_id, chart_type, config, owner_id) VALUES (?, ?, ?, ?, ?)').run('柱状图', dsId, 'bar', cfg, 1);
  const chartId = Number(ch.lastInsertRowid);
  const layout = JSON.stringify([{ id: 'c1', type: 'chart', chartId, w: 6, h: 2, hPx: 300, col: 1, top: 0 }]);
  await db.prepare('UPDATE dashboards SET layout = ? WHERE id = 1').run(layout);

  const s = await shareService.createShare({ dashboardId: 1, password: 'pass1234', expiresAt: null, userId: 1 });
  const view = await shareService.getDashboardRenderView(1);
  assert.equal(view.name, '分享看板');
  assert.equal(view.charts.length, 1);
  assert.equal(view.charts[0].config.metrics[0].field, 'sales');
  const raw = JSON.stringify(view);
  assert.equal(raw.includes('password_hash'), false);
  assert.equal(raw.includes('data_sources'), false);

  const data = await shareService.getChartData({ dashboardId: 1, token: s.token }, chartId);
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.rows[0]['metric:sales'].value, 10);

  // chart 不在布局中 -> 404
  await assert.rejects(() => shareService.getChartData({ dashboardId: 1, token: s.token }, 99999), (e) => e.status === 404);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/task3-share-service.test.js`（backend 目录）
Expected: FAIL —— module not found

- [ ] **Step 3: 实现** — Create `backend/src/services/share.service.js`:

```js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const HttpError = require('../utils/http-error');
const { getDashboardOrThrow } = require('./dashboard.service');
const { getChartOrThrow, listCharts } = require('./chart.service');
const queryEngine = require('../engines/query-engine');

const SELECT_SHARE = `
  SELECT s.id, s.dashboard_id AS dashboardId, s.dashboard_id AS dashboard_id, s.token,
         s.expires_at AS expiresAt, s.expires_at AS expires_at, s.is_active AS isActive,
         s.is_active AS is_active, s.created_by AS createdBy, s.created_by AS created_by,
         s.created_at AS createdAt, s.created_at AS created_at, s.updated_at AS updatedAt,
         s.updated_at AS updated_at
  FROM dashboard_shares s
`;

function generateToken() {
  return crypto.randomBytes(16).toString('base64url');
}

function stripPassword(row) {
  if (!row) return row;
  const { passwordHash, password_hash, ...rest } = row;
  return { ...rest, isActive: Number(row.isActive !== undefined ? row.isActive : row.is_active) };
}

function validatePassword(password) {
  if (!password || String(password).length < 4 || String(password).length > 64) {
    throw new HttpError(400, '分享密码需为 4-64 位');
  }
  return String(password);
}

function parseExpiresAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new HttpError(400, '过期时间格式不正确');
  if (d.getTime() <= Date.now()) throw new HttpError(400, '过期时间必须晚于当前时间');
  return d.toISOString();
}

async function getShare(id) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.id = ?`).get(Number(id))) || null;
}

async function getShareOrThrow(id) {
  const s = await getShare(id);
  if (!s) throw new HttpError(404, '分享不存在');
  return s;
}

async function getShareByToken(token) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.token = ?`).get(String(token || ''))) || null;
}

async function createShare({ dashboardId, password, expiresAt, userId }) {
  const hash = await bcrypt.hash(validatePassword(password), 10);
  const info = await db.prepare(
    'INSERT INTO dashboard_shares (dashboard_id, token, password_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(Number(dashboardId), generateToken(), hash, parseExpiresAt(expiresAt), Number(userId));
  return stripPassword(await getShare(Number(info.lastInsertRowid)));
}

async function listShares(dashboardId) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.dashboard_id = ? ORDER BY s.id DESC`).all(Number(dashboardId)))
    .map(stripPassword);
}

async function updateShare(id, body = {}) {
  await getShareOrThrow(id);
  const fields = [];
  const params = [];
  if (body.password !== undefined) {
    fields.push('password_hash = ?');
    params.push(await bcrypt.hash(validatePassword(body.password), 10));
  }
  if (body.expiresAt !== undefined) {
    fields.push('expires_at = ?');
    params.push(parseExpiresAt(body.expiresAt));
  }
  if (body.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(body.isActive ? 1 : 0);
  }
  if (fields.length) {
    params.push(id);
    await db.prepare(`UPDATE dashboard_shares SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  }
  return stripPassword(await getShare(id));
}

async function deleteShare(id) {
  await getShareOrThrow(id);
  await db.prepare('DELETE FROM dashboard_shares WHERE id = ?').run(Number(id));
  return true;
}

function shareState(share, now = Date.now()) {
  if (!share) return 'not_found';
  if (!Number(share.isActive !== undefined ? share.isActive : share.is_active)) return 'inactive';
  const exp = share.expiresAt !== undefined ? share.expiresAt : share.expires_at;
  if (exp && new Date(exp).getTime() <= now) return 'expired';
  return 'active';
}

function assertShareUsable(share, now = Date.now()) {
  const st = shareState(share, now);
  if (st === 'inactive') throw new HttpError(403, '分享已被关闭', null, 40302);
  if (st === 'expired') throw new HttpError(403, '分享链接已过期', null, 40301);
  if (st === 'not_found') throw new HttpError(404, '分享不存在或已被删除');
  return share;
}

async function getDashboardName(id) {
  return (await db.prepare('SELECT id, name FROM dashboards WHERE id = ?').get(Number(id))) || null;
}

function collectChartIds(layout) {
  const out = [];
  const walk = (arr) => {
    (arr || []).forEach((it) => {
      if (!it || typeof it !== 'object') return;
      if (it.type === 'chart' && it.chartId !== undefined && it.chartId !== null) out.push(Number(it.chartId));
      if (Array.isArray(it.children)) walk(it.children);
    });
  };
  walk(layout);
  return out;
}

async function getDashboardRenderView(dashboardId) {
  const dash = await getDashboardOrThrow(dashboardId);
  const ids = collectChartIds(dash.layout);
  const charts = ids.length ? await listCharts({ ids }) : [];
  return {
    id: dash.id,
    name: dash.name,
    layout: dash.layout,
    gap: dash.gap,
    cardStyle: dash.cardStyle,
    charts: charts.map((c) => ({ id: c.id, name: c.name, chartType: c.chartType, config: c.config })),
  };
}

async function getDashboardLayoutInShare(share) {
  const dash = await getDashboardOrThrow(Number(share.dashboardId));
  return dash.layout;
}

async function getChartData(share, chartId) {
  const ids = collectChartIds(await getDashboardLayoutInShare(share));
  if (!ids.includes(Number(chartId))) throw new HttpError(404, '图表不存在');
  const chart = await getChartOrThrow(Number(chartId));
  return queryEngine.aggregate({
    datasetId: chart.datasetId,
    ...chart.config,
    filters: [],
  });
}

module.exports = {
  generateToken,
  stripPassword,
  getShare,
  getShareOrThrow,
  getShareByToken,
  createShare,
  listShares,
  updateShare,
  deleteShare,
  shareState,
  assertShareUsable,
  getDashboardName,
  getDashboardRenderView,
  getChartData,
  collectChartIds,
};
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/task3-share-service.test.js`（backend 目录）
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/share.service.js backend/test/task3-share-service.test.js
git commit -m "feat(backend): share.service 分享 CRUD + 公开载荷组装"
```

---

## Task 4: 权限 seed

**Files:**
- Modify: `backend/src/seeds.js`

- [ ] **Step 1: 先在现有测试验证权限缺失会怎样（已有测试可复用）** —— 直接改代码：

`backend/src/seeds.js` 的 `PERMISSIONS` 数组，在 `['dashboard:delete', '删除看板'],` 之后插入：

```js
  ['dashboard:share', '分享看板'],
```

`backend/src/seeds.js` 的 `editor` 角色 permissions 数组追加：

```js
  { code: 'editor', name: '看板编辑者', description: '构建图表与排版看板，可看数据集', isBuiltin: 1, permissions: ['dataset:read', 'chart:read', 'chart:create', 'chart:update', 'chart:delete', 'dashboard:read', 'dashboard:create', 'dashboard:update', 'dashboard:delete', 'dashboard:share'] },
```

> admin 用 `ALL`、analyst 排除 user:/role:/audit:/system:config 后自动获得 `dashboard:share`，无需改动。

- [ ] **Step 2: 验证 seed 生效**

Run（backend 目录）:
```
node -e "process.env.DB_PATH='/tmp/kanban-seed-share.db'; const db=require('./src/db'); require('./src/seeds').seed().then(async()=>{ const p=db.get('SELECT id FROM permissions WHERE code = ?',['dashboard:share']); const c=db.get('SELECT COUNT(*) n FROM role_permissions rp WHERE rp.permission_id=?',[p.id]); console.log('perm', !!p, 'linked', c.n); require('fs').unlinkSync('/tmp/kanban-seed-share.db'); })"
```
Expected: `perm true linked 3`（admin/analyst/editor 三角色）

- [ ] **Step 3: Commit**

```bash
git add backend/src/seeds.js
git commit -m "feat(backend): 新增 dashboard:share 权限并授权 admin/analyst/editor"
```

---

## Task 5: 管理路由

**Files:**
- Create: `backend/src/routes/share.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/test/task5-share-routes.test.js`

- [ ] **Step 1: 写失败测试** — Create `backend/test/task5-share-routes.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-shares-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const chartService = require('../src/services/chart.service');
const dashboardService = require('../src/services/dashboard.service');

let server; let base;

test('启动临时服务并准备数据', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

  await db.prepare('CREATE TABLE di_share_route (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_route (category, sales) VALUES (?, ?)').run('A', 10);
  const ds = await db.prepare('INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run('路由测试', 'x', 1, 2, 'di_share_route', 1);
  const dsId = Number(ds.lastInsertRowid);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'sales', '销售额', 'number', 1);
  const chart = await chartService.createChart({
    name: '柱状图', chartType: 'bar', datasetId: dsId,
    config: { dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }], options: {} },
  }, 1);
  const layout = [{ id: 'c1', type: 'chart', chartId: chart.id, w: 6, h: 2, hPx: 300, col: 1, top: 0 }];
  const dash = await dashboardService.createDashboard('分享看板', 1);
  await dashboardService.updateDashboard(dash.id, { layout });
  global.__dashId = dash.id;
});

async function api(path, { method = 'POST', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined && !['GET', 'HEAD'].includes(method)) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + path, opts);
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function login(email, password) {
  const r = await api('/api/auth/login', { body: { email, password } });
  return r.json?.data?.accessToken;
}

test('viewer 无 dashboard:share 权限被拒', async () => {
  const u = await authService.register({ email: 'viewer@t.com', password: 'pass1234', name: '观众' });
  await db.prepare('INSERT INTO user_roles SELECT ?, id FROM roles WHERE code = ?').run(u.id, 'viewer');
  const token = await login('viewer@t.com', 'pass1234');
  const r = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: 'pass1234' } });
  assert.equal(r.status, 403);
});

test('analyst 非 owner 创建他人分享被拒', async () => {
  const token = await login('admin@kanban.local', 'admin123');
  const r = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: 'pass1234' } });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.token);
  global.__shareId = r.json.data.id;

  const u = await authService.register({ email: 'analyst@t.com', password: 'pass1234', name: '分析师' });
  await db.prepare('INSERT INTO user_roles SELECT ?, id FROM roles WHERE code = ?').run(u.id, 'analyst');
  const t2 = await login('analyst@t.com', 'pass1234');
  const r2 = await api(`/api/dashboards/9999/shares`, { method: 'POST', token: t2, body: { password: 'pass1234' } });
  assert.equal(r2.status, 404); // 不存在看板
  const r3 = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token: t2, body: { password: 'pass1234' } });
  assert.equal(r3.status, 403); // 非 owner
});

test('list/patch/delete 分享', async () => {
  const token = await login('admin@kanban.local', 'admin123');
  const list = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'GET', token });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.json.data));

  const bad = await api(`/api/dashboards/${global.__dashId}/shares`, { method: 'POST', token, body: { password: '12' } });
  assert.equal(bad.status, 400);

  const patched = await api(`/api/shares/${global.__shareId}`, { method: 'PATCH', token, body: { expiresAt: '2099-01-01T00:00:00.000Z', isActive: false } });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.data.isActive, 0);

  const del = await api(`/api/shares/${global.__shareId}`, { method: 'DELETE', token });
  assert.equal(del.status, 200);
});

test('清理', async () => {
  await new Promise((r) => server.close(r));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/task5-share-routes.test.js`（backend 目录）
Expected: FAIL —— `/api/dashboards/:id/shares` 404 Not Found

- [ ] **Step 3: 实现管理路由** — Create `backend/src/routes/share.routes.js`:

```js
const express = require('express');
const { z } = require('zod');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const shareService = require('../services/share.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');

const dashSharesRouter = express.Router({ mergeParams: true });
const sharesRouter = express.Router();

const createSchema = z.object({
  password: z.string().min(4).max(64),
  expiresAt: z.string().optional().nullable(),
}).strict();

const patchSchema = z.object({
  password: z.string().min(4).max(64).optional(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

// POST /api/dashboards/:id/shares
dashSharesRouter.post('/:id/shares', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dashboard', id, req.user, rbac);
  const p = createSchema.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '分享参数不正确', p.error.flatten());
  const share = await shareService.createShare({ dashboardId: id, password: p.data.password, expiresAt: p.data.expiresAt, userId: req.user.id });
  ok(res, share, '分享创建成功');
});

// GET /api/dashboards/:id/shares
dashSharesRouter.get('/:id/shares', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dashboard', id, req.user, rbac);
  ok(res, await shareService.listShares(id));
});

// PATCH /api/shares/:shareId
sharesRouter.patch('/:shareId', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const shareId = Number(req.params.shareId);
  const share = await shareService.getShareOrThrow(shareId);
  await access.assertResource('dashboard', share.dashboardId, req.user, rbac);
  const p = patchSchema.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '分享参数不正确', p.error.flatten());
  ok(res, await shareService.updateShare(shareId, p.data), '分享更新成功');
});

// DELETE /api/shares/:shareId
sharesRouter.delete('/:shareId', requireUser, requirePermission('dashboard', 'share'), async (req, res) => {
  const shareId = Number(req.params.shareId);
  const share = await shareService.getShareOrThrow(shareId);
  await access.assertResource('dashboard', share.dashboardId, req.user, rbac);
  await shareService.deleteShare(shareId);
  ok(res, true, '分享删除成功');
});

module.exports = { dashSharesRouter, sharesRouter };
```

- [ ] **Step 4: 挂载路由** — `backend/src/app.js` 修改：

在 `const datasourceRoutes = require('./routes/datasource.routes');` 后追加：

```js
const { dashSharesRouter, sharesRouter } = require('./routes/share.routes');
```

在 `app.use('/api/dashboards', dashboardRoutes);` 后追加：

```js
app.use('/api/dashboards', dashSharesRouter);
app.use('/api/shares', sharesRouter);
```

- [ ] **Step 5: 运行确认通过**

Run: `node --test test/task5-share-routes.test.js`（backend 目录）
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/share.routes.js backend/src/app.js backend/test/task5-share-routes.test.js
git commit -m "feat(backend): 分享管理路由（创建/列表/修改/删除）"
```

---

## Task 6: 公开路由

**Files:**
- Create: `backend/src/middleware/share-auth.js`
- Create: `backend/src/routes/public-share.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/test/task6-share-public.test.js`

- [ ] **Step 1: 写失败测试** — Create `backend/test/task6-share-public.test.js`:

```js
process.env.DB_PATH = `/tmp/kanban-test-pub-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const chartService = require('../src/services/chart.service');
const dashboardService = require('../src/services/dashboard.service');
const shareService = require('../src/services/share.service');

let server; let base; let dashId; let chartId; let token;

test('启动临时服务并准备一个带分享的看板', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

  await db.prepare('CREATE TABLE di_share_pub (category TEXT, sales REAL)').run();
  await db.prepare('INSERT INTO di_share_pub (category, sales) VALUES (?, ?), (?, ?)').run('A', 10, 'B', 20);
  const ds = await db.prepare('INSERT INTO datasets (name, original_file, row_count, column_count, table_name, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run('公开展示', 'x', 2, 2, 'di_share_pub', 1);
  const dsId = Number(ds.lastInsertRowid);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'category', '类别', 'string', 0);
  await db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)').run(dsId, 'sales', '销售额', 'number', 1);
  const chart = await chartService.createChart({
    name: '柱状图', chartType: 'bar', datasetId: dsId,
    config: { dimensions: [{ field: 'category', label: '类别' }], metrics: [{ field: 'sales', agg: 'sum', label: '销售额' }], options: {} },
  }, 1);
  chartId = chart.id;
  const dash = await dashboardService.createDashboard('公开看板', 1);
  dashId = dash.id;
  await dashboardService.updateDashboard(dash.id, {
    layout: [{ id: 'c1', type: 'chart', chartId: chart.id, w: 6, h: 2, hPx: 300, col: 1, top: 0 }],
  });
  const s = await shareService.createShare({ dashboardId: dash.id, password: 'pass1234', expiresAt: null, userId: 1 });
  token = s.token;
});

async function api(path, { method = 'POST', auth, body } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const opts = { method, headers };
  if (body !== undefined && !['GET', 'HEAD'].includes(method)) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + path, opts);
  return { status: res.status, json: await res.json().catch(() => null) };
}

test('meta 无需凭证返回看板名与状态', async () => {
  const r = await api(`/api/public/shares/${token}/meta`, { method: 'GET' });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.found, true);
  assert.equal(r.json.data.dashboardName, '公开看板');
  const miss = await api('/api/public/shares/notexist/meta', { method: 'GET' });
  assert.equal(miss.json.data.found, false);
});

test('verify 密码错误 401 / 正确签发 share JWT', async () => {
  const wrong = await api(`/api/public/shares/${token}/verify`, { body: { password: 'wrong1' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.code, 40101);

  const okR = await api(`/api/public/shares/${token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(okR.status, 200);
  assert.ok(okR.json.data.accessToken);
  global.__shareJwt = okR.json.data.accessToken;
});

test('无 share JWT 访问 dashboard 被拒 401', async () => {
  const r = await api(`/api/public/shares/${token}/dashboard`, { method: 'GET' });
  assert.equal(r.status, 401);
});

test('dashboard 载荷含图表元信息、不含敏感字段', async () => {
  const r = await api(`/api/public/shares/${token}/dashboard`, { method: 'GET', auth: global.__shareJwt });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.name, '公开看板');
  assert.equal(r.json.data.charts.length, 1);
  assert.equal(r.json.data.charts[0].chartType, 'bar');
  const raw = JSON.stringify(r.json.data);
  assert.equal(raw.includes('password_hash'), false);
  assert.equal(raw.includes('data_sources'), false);
});

test('chart data 正常返回且越权 404', async () => {
  const r = await api(`/api/public/shares/${token}/charts/${chartId}/data`, { method: 'POST', auth: global.__shareJwt, body: { filters: [] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.data.rows.length, 2);

  const bad = await api(`/api/public/shares/${token}/charts/99999/data`, { method: 'POST', auth: global.__shareJwt, body: { filters: [] } });
  assert.equal(bad.status, 404);
});

test('share JWT 与 token 不匹配被拒', async () => {
  const other = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  const r1 = await api(`/api/public/shares/${other.token}/dashboard`, { method: 'GET', auth: global.__shareJwt });
  assert.equal(r1.status, 401);
  await shareService.deleteShare(other.id);
});

test('过期分享 verify 失败 40301', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  await db.prepare("UPDATE dashboard_shares SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(s.id);
  const r = await api(`/api/public/shares/${s.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 40301);
  await shareService.deleteShare(s.id);
});

test('停用分享 verify 失败 40302', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  await db.prepare('UPDATE dashboard_shares SET is_active = 0 WHERE id = ?').run(s.id);
  const r = await api(`/api/public/shares/${s.token}/verify`, { body: { password: 'pass1234' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 40302);
  await shareService.deleteShare(s.id);
});

test('verify 频繁尝试被限流 429', async () => {
  const s = await shareService.createShare({ dashboardId: dashId, password: 'pass1234', expiresAt: null, userId: 1 });
  let last = 0;
  for (let i = 0; i < 12; i += 1) {
    const r = await api(`/api/public/shares/${s.token}/verify`, { body: { password: 'nope' } });
    last = r.status;
  }
  assert.equal(last, 429);
  await shareService.deleteShare(s.id);
});

test('清理', async () => {
  await new Promise((r) => server.close(r));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/task6-share-public.test.js`（backend 目录）
Expected: FAIL —— `/api/public/shares` 404 Not Found

- [ ] **Step 3: 实现 share 认证中间件** — Create `backend/src/middleware/share-auth.js`:

```js
const HttpError = require('../utils/http-error');
const { verifyShare } = require('../utils/jwt');
const shareService = require('../services/share.service');

// 按路径 token 加载分享并校验可用（用于 meta 与 verify）
async function requireShareToken(req, res, next) {
  const share = await shareService.getShareByToken(String(req.params.token || ''));
  shareService.assertShareUsable(share);
  req.share = share;
  next();
}

// 校验 Bearer 分享态 JWT：typ='share'、token 与路径一致、分享仍可用
function requireShareJwt(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!bearer) throw new HttpError(401, '缺少访问凭证', null, 40102);
  let payload;
  try {
    payload = verifyShare(bearer);
  } catch (e) {
    throw new HttpError(401, e.message || '访问凭证无效', null, 40102);
  }
  requestLoad(payload, req);
  return next();
}

async function requestLoad(payload, req) {
  if (payload.token !== String(req.params.token || '')) {
    throw new HttpError(401, '访问凭证与链接不匹配', null, 40102);
  }
  const share = await shareService.getShare(payload.shareId);
  if (!share || share.token !== payload.token) throw new HttpError(401, '访问凭证已失效', null, 40102);
  shareService.assertShareUsable(share);
  req.share = share;
}

module.exports = { requireShareToken, requireShareJwt };
```

> 说明：`next` 为 async 时 Express 5 自动捕获 reject；`requireShareJwt` 将异步装载解耦为 `requestLoad`（同步返回 next 避免双重调用）。

- [ ] **Step 4: 实现公开路由** — Create `backend/src/routes/public-share.routes.js`:

```js
const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { signShare } = require('../utils/jwt');
const shareService = require('../services/share.service');
const { requireShareJwt } = require('../middleware/share-auth');

const router = express.Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '密码尝试次数过多，请稍后再试', data: null },
});

// GET /api/public/shares/:token/meta
router.get('/:token/meta', async (req, res) => {
  const share = await shareService.getShareByToken(String(req.params.token || ''));
  if (!share) {
    ok(res, { found: false, dashboardName: null, requiresPassword: true, expired: false, inactive: false });
    return;
  }
  const st = shareService.shareState(share);
  const dash = await shareService.getDashboardName(share.dashboardId);
  ok(res, { found: true, dashboardName: dash?.name || '看板', requiresPassword: true, expired: st === 'expired', inactive: st === 'inactive' });
});

// POST /api/public/shares/:token/verify
router.post('/:token/verify', verifyLimiter, async (req, res) => {
  const s = z.object({ password: z.string().min(1).max(128) }).strict();
  const p = s.safeParse(req.body || {});
  if (!p.success) throw new HttpError(400, '请输入分享密码');
  const share = await shareService.getShareByToken(String(req.params.token || ''));
  shareService.assertShareUsable(share);
  const okPwd = await bcrypt.compare(p.data.password, share.passwordHash);
  if (!okPwd) throw new HttpError(401, '密码错误', null, 40101);
  const accessToken = signShare({ shareId: share.id, dashboardId: share.dashboardId, token: share.token });
  ok(res, { accessToken });
});

// GET /api/public/shares/:token/dashboard
router.get('/:token/dashboard', requireShareJwt, async (req, res) => {
  ok(res, await shareService.getDashboardRenderView(req.share.dashboardId));
});

// POST /api/public/shares/:token/charts/:chartId/data
const dataSchema = z.object({ filters: z.array(z.any()).optional().default([]) }).strict();
router.post('/:token/charts/:chartId/data', requireShareJwt, async (req, res) => {
  const parsed = dataSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '参数不正确');
  const data = await shareService.getChartData(req.share, Number(req.params.chartId));
  ok(res, { data });
});

module.exports = router;
```

- [ ] **Step 5: 挂载公开路由** — `backend/src/app.js`：

在 `const { dashSharesRouter, sharesRouter } = require('./routes/share.routes');` 后加：

```js
const publicShareRoutes = require('./routes/public-share.routes');
```

在 `app.use('/api/shares', sharesRouter);` 后加：

```js
app.use('/api/public/shares', publicShareRoutes);
```

- [ ] **Step 6: 运行确认通过**

Run: `node --test test/task6-share-public.test.js`（backend 目录）
Expected: PASS

- [ ] **Step 7: 回归全部后端测试**

Run: `npm test`（backend 目录，可过滤失败项）
Expected: 新测试全过，既有任务测试不受影响

- [ ] **Step 8: Commit**

```bash
git add backend/src/middleware/share-auth.js backend/src/routes/public-share.routes.js backend/src/app.js backend/test/task6-share-public.test.js
git commit -m "feat(backend): 公开分享路由（meta/verify/dashboard/data）+ 限流"
```

---

## Task 7: 前端分享 API + 公开路由 + 只读看板页

**Files:**
- Create: `front-end/src/api/share.js`
- Modify: `front-end/src/router/index.js`
- Modify: `front-end/src/components/dashboard/ChartTile.vue`
- Modify: `front-end/src/components/dashboard/DashboardCanvas.vue`
- Create: `front-end/src/views/ShareBoardView.vue`

- [ ] **Step 1: 创建 share API 实例** — Create `front-end/src/api/share.js`:

```js
import axios from 'axios'
import { ElMessage } from 'element-plus'

export const SHARE_TOKEN_KEY = 'kanban_share_token'

const shareHttp = axios.create({ baseURL: '/api/public/shares', timeout: 60000 })

shareHttp.interceptors.request.use((config) => {
  const t = sessionStorage.getItem(SHARE_TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

shareHttp.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code === 0) return body.data
    return Promise.reject(new Error(body?.message || '请求失败'))
  },
  (err) => {
    const { response } = err
    if (response?.status === 401) sessionStorage.removeItem(SHARE_TOKEN_KEY)
    const msg = response?.data?.message || err?.message || '网络错误'
    if (!(response?.status === 401)) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
)

export const shareApi = {
  meta: (token) => shareHttp.get(`/${token}/meta`),
  verify: (token, password) => shareHttp.post(`/${token}/verify`, { password }),
  dashboard: (token) => shareHttp.get(`/${token}/dashboard`),
  chartData: (token, chartId, filters = []) => shareHttp.post(`/${token}/charts/${chartId}/data`, { filters }),
}

export default shareHttp
```

- [ ] **Step 2: 注册公开路由** — `front-end/src/router/index.js`：

在 `/[login|register]` 路由之后、`/` 路由之前增加：

```js
  {
    path: '/s/:token',
    name: 'share-view',
    component: () => import('../views/ShareBoardView.vue'),
    meta: { title: '分享查看', public: true },
  },
```

将 `router.beforeEach` 改为（最前面放行公开页，登录态用户也可访问）：

```js
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  const publicPages = ['/login', '/register']
  if (publicPages.includes(to.path)) {
    if (auth.isLoggedIn) return '/'
    return true
  }
  if (!auth.isLoggedIn) return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  if (!auth.user?.permissions?.length) {
    try { await auth.me() } catch (e) { /* 拦截器已处理 */ }
  }
  return true
})
```

- [ ] **Step 3: ChartTile 支持注入数据源覆盖** — `front-end/src/components/dashboard/ChartTile.vue`：

`<script setup>` 顶部 `import { chartApi, datasetApi } from '@/api'` 改为：

```js
import { computed, inject, onMounted, ref, watch } from 'vue'
import { chartApi as defaultChartApi, datasetApi as defaultDatasetApi } from '@/api'
import { getChartType } from '@/config/chart-types'
import EChartRenderer from '@/components/charts/EChartRenderer.vue'

const injected = inject('shareApiOverride', null)
const chartApi = injected?.chartApi || defaultChartApi
const datasetApi = injected?.datasetApi || defaultDatasetApi
```

> 默认（未注入）行为与原来完全一致；分享页注入覆盖源后走公开接口。

- [ ] **Step 4: DashboardCanvas 支持注入数据源覆盖** — `front-end/src/components/dashboard/DashboardCanvas.vue`：

`<script setup>` 顶部 `import { chartApi } from '@/api'` 改为：

```js
import { computed, inject, onBeforeUnmount, provide, reactive, ref, watch } from 'vue'
import { chartApi as defaultChartApi } from '@/api'
import GridBoard from './GridBoard.vue'
import { alignRows, applyDrop, cardHeightPx, cellFromPointer, clampChildren, findFreeCell, flattenItems, GAP, normGap, rowsForHeight } from '@/utils/grid-layout'

const injected = inject('shareApiOverride', null)
const chartApi = injected?.chartApi || defaultChartApi
```

- [ ] **Step 5: 创建只读分享页** — Create `front-end/src/views/ShareBoardView.vue`:

```vue
<template>
  <div class="share-page">
    <div v-loading="loading" class="share-center" v-if="loading" style="min-height: 60vh">
    </div>

    <div v-else-if="!meta || !meta.found" class="share-center">
      <el-result icon="error" title="分享不存在" sub-title="该分享链接不存在或已被删除" />
    </div>

    <div v-else-if="meta.expired || meta.inactive" class="share-center">
      <el-result icon="warning" :title="meta.expired ? '分享已过期' : '分享已关闭'"
        sub-title="请联系看板创建者处理" />
    </div>

    <div v-else-if="!boardReady" class="share-center">
      <div class="share-gate-card">
        <h3 class="share-gate-card__title">{{ meta.dashboardName }}</h3>
        <p class="share-gate-card__desc">该看板已通过分享链接公开，请输入访问密码进行只读查看</p>
        <el-input v-model="password" type="password" show-password placeholder="访问密码"
          @keyup.enter="verify" />
        <div class="share-gate-card__actions">
          <el-button type="primary" :loading="verifying" @click="verify">查看看板</el-button>
          <el-button v-if="auth.isLoggedIn" link @click="$router.push('/')">返回系统</el-button>
        </div>
      </div>
    </div>

    <div v-else class="share-board">
      <div class="share-bar">
        <div class="share-bar__title">
          {{ dashName }}
          <el-tag size="small" type="info" effect="plain">只读分享</el-tag>
        </div>
        <div class="share-bar__actions">
          <el-button size="small" @click="refresh">刷新数据</el-button>
          <el-button v-if="auth.isLoggedIn" size="small" link @click="$router.push('/')">返回系统</el-button>
        </div>
      </div>
      <div class="share-board__body">
        <DashboardCanvas
          :key="refreshKey"
          :items="items"
          :charts="charts"
          :gap="gap"
          :card-style="cardStyle"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { shareApi, SHARE_TOKEN_KEY } from '@/api/share'
import { useAuthStore } from '@/stores/auth'
import { alignTree, normalizeLayout, normCardStyle, normGap } from '@/utils/grid-layout'
import DashboardCanvas from '@/components/dashboard/DashboardCanvas.vue'

const route = useRoute()
const auth = useAuthStore()
const token = String(route.params.token || '')

const loading = ref(true)
const meta = ref(null)
const password = ref('')
const verifying = ref(false)
const boardReady = ref(false)
const dashName = ref('')
const items = ref([])
const charts = ref([])
const gap = ref({ x: 12, y: 12 })
const cardStyle = ref(normCardStyle(null))
const refreshKey = ref(0)
const chartCache = ref({})

provide('shareApiOverride', {
  chartApi: {
    get: async (id) => chartCache.value[Number(id)]
      || Promise.reject(new Error('图表不存在')),
    data: (id, filters) => shareApi.chartData(token, id, filters).then((r) => r),
  },
  datasetApi: {
    get: async () => ({ fields: [] }),
  },
})

async function loadMeta() {
  loading.value = true
  try {
    meta.value = await shareApi.meta(token)
  } catch (e) {
    meta.value = { found: false }
  } finally {
    loading.value = false
  }
}

async function verify() {
  if (!password.value) return ElMessage.warning('请输入访问密码')
  verifying.value = true
  try {
    const res = await shareApi.verify(token, password.value)
    sessionStorage.setItem(SHARE_TOKEN_KEY, res.accessToken)
    await buildBoard()
    boardReady.value = true
  } catch (e) {
    ElMessage.error(e.message || '验证失败')
  } finally {
    verifying.value = false
  }
}

async function buildBoard() {
  const dash = await shareApi.dashboard(token)
  dashName.value = dash.name
  gap.value = normGap(dash.gap)
  cardStyle.value = normCardStyle(dash.cardStyle)
  items.value = normalizeLayout(dash.layout || [], 12, gap.value)
  alignTree(items.value, 12, gap.value)
  charts.value = dash.charts || []
  const map = {}
  charts.value.forEach((c) => { map[c.id] = c })
  chartCache.value = map
}

function refresh() {
  refreshKey.value += 1
  ElMessage.success('已刷新')
}

onMounted(loadMeta)
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.share-center {
  flex: 1;
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-gate-card {
  width: 360px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.share-gate-card__title {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.share-gate-card__desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
}

.share-gate-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.share-bar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.share-bar__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.share-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-board__body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.share-board__body :deep(.dash-canvas) {
  height: 100%;
}
</style>
```

- [ ] **Step 6: 手工验证前端流程**（后端已启动前提下）：访问 `/s/{token}` → 门禁 → 输密码 → 看板渲染 → 刷新。
  构建：`cd front-end && npm run build`（Expected: 构建通过，无路由/组件报错）

- [ ] **Step 7: Commit**

```bash
git add front-end/src/api/share.js front-end/src/router/index.js front-end/src/components/dashboard/ChartTile.vue front-end/src/components/dashboard/DashboardCanvas.vue front-end/src/views/ShareBoardView.vue
git commit -m "feat(frontend): 分享公开页 shareApi + ShareBoardView 只读看板"
```

---

## Task 8: 管理侧 ShareDialog + 看板列表入口

**Files:**
- Modify: `front-end/src/api/index.js`
- Create: `front-end/src/components/dashboard/ShareDialog.vue`
- Modify: `front-end/src/views/DashboardList.vue`

- [ ] **Step 1: 扩展 dashboardApi** — `front-end/src/api/index.js` 中 `dashboardApi` 增加：

```js
export const dashboardApi = {
  list: () => http.get('/dashboards'),
  listPaged: (page, pageSize) => listPaged('/dashboards', page, pageSize),
  get: (id) => http.get(`/dashboards/${id}`),
  create: (name) => http.post('/dashboards', { name }),
  update: (id, payload) => http.patch(`/dashboards/${id}`, payload),
  remove: (id) => http.delete(`/dashboards/${id}`),
  shares: (id) => http.get(`/dashboards/${id}/shares`),
  createShare: (id, payload) => http.post(`/dashboards/${id}/shares`, payload),
  updateShare: (shareId, payload) => http.patch(`/shares/${shareId}`, payload),
  deleteShare: (shareId) => http.delete(`/shares/${shareId}`),
}
```

- [ ] **Step 2: 创建 ShareDialog** — Create `front-end/src/components/dashboard/ShareDialog.vue`:

```vue
<template>
  <el-dialog
    :model-value="modelValue"
    :title="`分享看板：${name}`"
    width="680px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="share-create">
      <el-input v-model="password" type="password" show-password placeholder="访问密码（4-64 位）" style="width: 200px" />
      <el-date-picker v-model="expiresAt" type="datetime" placeholder="过期时间（可选）"
        value-format="YYYY-MM-DDTHH:mm:ssZ" style="width: 200px" />
      <el-button type="primary" :loading="creating" @click="create">创建分享</el-button>
    </div>

    <el-table :data="shares" v-loading="loading" empty-text="还没有分享链接">
      <el-table-column label="链接" min-width="260">
        <template #default="{ row }">
          <span class="share-link">{{ shareUrl(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="过期时间" width="150">
        <template #default="{ row }">{{ row.expiresAt ? formatDate(row.expiresAt) : '永久' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="70" align="center">
        <template #default="{ row }">
          <el-switch :model-value="!!row.isActive" @change="(v) => toggleActive(row, v)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="copy(row)">复制链接</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { dashboardApi } from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  dashboardId: { type: Number, required: true },
  name: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const shares = ref([])
const loading = ref(false)
const creating = ref(false)
const password = ref('')
const expiresAt = ref(null)

function shareUrl(row) {
  return `${window.location.origin}/s/${row.token}`
}

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 16) : '-'
}

async function load() {
  loading.value = true
  try {
    shares.value = (await dashboardApi.shares(props.dashboardId)) || []
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!password.value || password.value.length < 4) return ElMessage.warning('访问密码至少 4 位')
  creating.value = true
  try {
    const s = await dashboardApi.createShare(props.dashboardId, {
      password: password.value,
      expiresAt: expiresAt.value || null,
    })
    shares.value.unshift(s)
    password.value = ''
    expiresAt.value = null
    ElMessage.success('分享创建成功')
  } finally {
    creating.value = false
  }
}

async function toggleActive(row, v) {
  await dashboardApi.updateShare(row.id, { isActive: v })
  row.isActive = v ? 1 : 0
  ElMessage.success(v ? '已启用' : '已停用')
}

async function remove(row) {
  await dashboardApi.deleteShare(row.id)
  shares.value = shares.value.filter((s) => s.id !== row.id)
  ElMessage.success('分享已删除')
}

async function copy(row) {
  try {
    await navigator.clipboard.writeText(shareUrl(row))
    ElMessage.success('链接已复制')
  } catch (e) {
    ElMessage.warning('复制失败，请手动复制')
  }
}

onMounted(load)
</script>

<style scoped>
.share-create {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.share-link {
  font-size: 12px;
  color: #606266;
  word-break: break-all;
}
</style>
```

- [ ] **Step 3: DashboardList 加分享入口** — `front-end/src/views/DashboardList.vue`：

`<script setup>` 导入与状态：

```js
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Share } from '@element-plus/icons-vue'
import { dashboardApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import ShareDialog from '@/components/dashboard/ShareDialog.vue'

const auth = useAuthStore()
const canShare = computed(() => auth.hasPermission('dashboard', 'share'))
const shareDialog = ref({ open: false, dashboardId: 0, name: '' })
function openShare(row) {
  shareDialog.value = { open: true, dashboardId: row.id, name: row.name }
}
```

操作列（`width="220" fixed="right"`）增加按钮：

```html
<el-button v-if="canShare" link type="primary" @click="openShare(row)">
  <el-icon style="margin-right: 2px"><Share /></el-icon>分享
</el-button>
```

`<template>` 末尾（`</div>` 前，`.page-container` 内）挂载对话框：

```html
    <ShareDialog
      v-model="shareDialog.open"
      :dashboard-id="shareDialog.dashboardId"
      :name="shareDialog.name"
    />
```

- [ ] **Step 4: 构建与手工验证**

Run: `cd front-end && npm run build`
Expected: 构建通过。登录后看板列表出现「分享」按钮 → 弹窗创建分享 → 复制链接 → 匿名浏览器打开验证。

- [ ] **Step 5: Commit**

```bash
git add front-end/src/api/index.js front-end/src/components/dashboard/ShareDialog.vue front-end/src/views/DashboardList.vue
git commit -m "feat(frontend): 分享管理弹窗 + 看板列表分享入口"
```

---

## Task 9: 端到端手工验证 + 文档

**Files:**
- Modify: `README.md`（可选，若存在「已知限制」列表需更新）

- [ ] **Step 1: 后端全部测试**

Run: `npm test`（backend 目录）
Expected: 全绿

- [ ] **Step 2: 前端构建**

Run: `cd front-end && npm run build`
Expected: 构建通过

- [ ] **Step 3: 手工端到端验证清单**
1. 管理员登录 → 看板中心 → 某看板「分享」→ 输密码「1234」创建 → 得到链接
2. 复制完整链接（`http://localhost:5173/s/{token}`）
3. 打开无痕窗口访问链接 → 出现密码门禁（显示看板名）→ 错误密码提示；正确密码进入
4. 看板只读渲染正常（图表数据可见），无编辑/新建控件
5. 点击「刷新数据」→ 图表重新加载
6. 管理侧停用分享后，无痕窗口重进 → 提示「分享已关闭」
7. 创建带过期时间的分享，将 expiresAt 设为过去时间（或改库）→ 提示「分享已过期」
8. viewer 角色登录 → 无「分享」按钮；直接调接口返回 403

- [ ] **Step 4: 更新 README（若含「已知限制」章节）**

将 README「已知限制」中「共享授权（grants）、看板级访问控制」表述更新为：公开只读分享已支持（`/s/:token` 密码门禁），资源级用户/角色授权仍排后续。

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: 更新已知限制（公开只读分享已支持）"
```