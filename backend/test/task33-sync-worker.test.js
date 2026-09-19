// backend/test/task33-sync-worker.test.js
// 同步 worker 化与内存有界：任务队列幂等、领取与租约回收、worker 模式调度入队、
// 流式对账分页正确性、可观测性快照。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

process.env.DB_PATH = `/tmp/kanban-syncworker-${process.pid}.db`;
process.env.DATA_DIR = `/tmp/kanban-syncworker-data-${process.pid}`;
const config = require('../src/config');
const db = require('../src/db');
const sync = require('../src/services/sync.service');
const queue = require('../src/services/sync-queue.service');
const providersApi = require('../src/datasources/providers');

const COLS = [
  { name: 'id', type: 'int' },
  { name: 'amt', type: 'decimal' },
  { name: 'updated_at', type: 'timestamp' },
];

const FAKE = {
  src: [],
  listColumns: () => COLS,
  async runQuery(cfg, sql, params) {
    const l = sql.match(/LIMIT (\d+)/);
    const limit = l ? Number(l[1]) : Number.MAX_SAFE_INTEGER;
    const o = sql.match(/OFFSET (\d+)/);
    const offset = o ? Number(o[1]) : 0;
    let rows = FAKE.src;
    const wm = sql.match(/WHERE ([\w.]+) > \?/);
    if (wm && params[0] != null) rows = rows.filter((r) => r[wm[1]] > params[0]);
    return rows.slice(offset, offset + limit);
  },
};

const REAL_GET_PROVIDER = providersApi.getProvider;
let dsId;

function insertDs() {
  return Number(db.prepare("INSERT INTO data_sources (name, type, config, mode, is_active, owner_id) VALUES ('ds-worker', 'mysql', ?, 'sync', 1, 1)")
    .run(JSON.stringify({ host: 'h', port: 3306, database: 'db', user: 'u', password: 'p', password_masked: true })).lastInsertRowid);
}
function q(t) { return db.dialect.quoteIdent(t); }

test.before(async () => {
  db.initSchema();
  dsId = insertDs();
  providersApi.getProvider = () => FAKE;
});

test.beforeEach(() => {
  db.prepare('DELETE FROM sync_jobs').run();
});

test.after(() => {
  providersApi.getProvider = REAL_GET_PROVIDER;
  try { db.close(); } catch (e) { /* ignore */ }
  fs.rmSync(process.env.DB_PATH, { force: true });
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('队列：同一配置重复入队幂等，只保留一个活跃任务', async () => {
  const c = await sync.createConfig(dsId, { sourceTable: 'q1', strategy: 'full' });
  const j1 = await queue.enqueue(c.id, 'manual');
  assert.equal(j1.existing, false);
  assert.equal(j1.status, 'queued');
  const j2 = await queue.enqueue(c.id, 'manual');
  assert.equal(j2.existing, true);
  assert.equal(j2.id, j1.id);
  assert.equal(await queue.activeCount(), 1);
});

test('队列：领取标记 running，完成后不再活跃', async () => {
  const c = await sync.createConfig(dsId, { sourceTable: 'q2', strategy: 'full' });
  const j = await queue.enqueue(c.id, 'manual');
  const claimed = await queue.claim('w1', 60000);
  assert.ok(claimed && claimed.id === j.id);
  assert.equal(claimed.status, 'running');
  assert.equal(claimed.worker_id, 'w1');
  const dup = await queue.claim('w2', 60000);
  assert.equal(dup, null, '不应重复领取执行中的任务');
  await queue.finish(j.id, 'success');
  assert.equal(await queue.activeCount(), 0);
});

test('队列：租约过期的 running 任务可被重新领取', async () => {
  const c = await sync.createConfig(dsId, { sourceTable: 'q3', strategy: 'full' });
  const j = await queue.enqueue(c.id, 'schedule');
  await queue.claim('dead-worker', 0);
  const reclaimed = await queue.claim('alive-worker', 60000);
  assert.ok(reclaimed && reclaimed.id === j.id);
  assert.equal(reclaimed.worker_id, 'alive-worker');
  await queue.finish(j.id, 'success');
});

test('worker 模式：调度 tick 只入队不执行', async () => {
  const sched = require('../src/jobs/sync-scheduler');
  const c = await sync.createConfig(dsId, { sourceTable: 'q4', strategy: 'full' });
  const before = db.prepare('SELECT last_sync_at FROM sync_configs WHERE id = ?').get(c.id).last_sync_at;
  const origMode = config.sync.mode;
  config.sync.mode = 'worker';
  try {
    const res = await sched.tick();
    assert.ok(res.enqueued >= 1);
    const after = db.prepare('SELECT last_sync_at FROM sync_configs WHERE id = ?').get(c.id).last_sync_at;
    assert.equal(after, before, 'worker 模式不应直接执行同步');
    const job = await db.prepare('SELECT * FROM sync_jobs WHERE sync_config_id = ? ORDER BY id DESC').get(c.id);
    assert.ok(job && job.status === 'queued');
  } finally {
    config.sync.mode = origMode;
  }
});

test('流式对账：跨多页（>5000 行）仍准确删除缺失主键', async () => {
  const c = await sync.createConfig(dsId, { sourceTable: 'big', strategy: 'incremental', watermarkField: 'id' });
  const N = 6000;
  FAKE.src = Array.from({ length: N }, (_, i) => ({ id: i + 1, amt: i, updated_at: '2024-01-01 00:00:00' }));
  await sync.runSync(c.id);
  const local = sync.nextLocalTable(dsId, 'big');
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM ${q(local)}`).get().c, N);

  FAKE.src = FAKE.src.filter((r) => r.id !== 3000);
  const res = await sync.runSync(c.id);
  assert.equal(res.deleted, 1);
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM ${q(local)}`).get().c, N - 1);
  assert.equal(db.prepare(`SELECT id FROM ${q(local)} WHERE id = 3000`).get(), undefined);
});

test('可观测性：快照包含事件循环、内存、HTTP 与同步指标', async () => {
  const metrics = require('../src/middleware/metrics');
  metrics.reset();
  metrics.recordSync({ ok: true, rows: 5, deleted: 2, durationMs: 12 });
  const snap = metrics.snapshot();
  assert.ok(snap.eventLoop && typeof snap.eventLoop.p99Ms === 'number');
  assert.ok(snap.memory && snap.memory.rssBytes > 0);
  assert.ok(snap.http && snap.http.statusClasses);
  assert.equal(snap.sync.runs, 1);
  assert.equal(snap.sync.rows, 5);
  assert.equal(snap.sync.deleted, 2);
});
