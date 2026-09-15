// backend/test/task26-live-sync.test.js
// Task 15：live MySQL 端到端同步 —— 首全量 + 增量两轮 + 本地表注册数据集。
// 跳过条件：RUN_LIVE=1 未开，或 LIVE_CASES 过滤掉 mysql。
const test = require('node:test');
const assert = require('node:assert');

if (process.env.RUN_LIVE !== '1' || (process.env.LIVE_CASES && !process.env.LIVE_CASES.split(',').includes('mysql'))) {
  test('live sync 端到端', { skip: 'RUN_LIVE=1 未开启（mysql 13306 需容器）' }, () => {});
} else {
  const path = require('node:path');
  const fs = require('node:fs');
  process.env.DB_PATH = `/tmp/kanban-live-sync-${process.pid}.db`;
  process.env.DATA_DIR = `/tmp/kanban-live-sync-data-${process.pid}`;
  const db = require('../src/db');
  const sync = require('../src/services/sync.service');
  const datasourceService = require('../src/services/datasource.service');
  const datasetService = require('../src/services/dataset.service');
  const live = require('./helpers/live-mysql');

  let dsId = null;
  let cfg = null;
  let localTable = null;

  test('首同步：全量落地行数 = 源', {
    timeout: 120000,
  }, async () => {
    db.initSchema();
    const conn = await live.ensure();
    try {
      await live.resetTable(conn);
      await live.seed(conn, 3);
      dsId = Number(db.prepare("INSERT INTO data_sources (name, type, config, mode, is_active, owner_id) VALUES ('live-mysql-sync', 'mysql', ?, 'sync', 1, 1)")
        .run(JSON.stringify({ ...live.datasourceConfig(), password_masked: true })).lastInsertRowid);
      assert.ok(dsId > 0);

      cfg = await sync.createConfig(dsId, {
        sourceSchema: live.DB,
        sourceTable: 'sales2',
        strategy: 'incremental',
        watermarkField: 'id',
        primaryKey: ['id'],
      });
      assert.equal(cfg.strategy, 'incremental');

      const r1 = await sync.runNow(cfg.id);
      localTable = r1.localTable;
      const src1 = await live.srcCount(conn);
      assert.equal(src1.count, 3);
      assert.ok(r1.rows >= 3, `首同步应落库 >=3 行，实际 ${r1.rows}`);
      const local1 = db.prepare(`SELECT COUNT(*) AS c FROM ${db.dialect.quoteIdent(localTable)}`).get();
      assert.equal(local1.c, src1.count, '本地行数应等于源行数');
    } finally {
      await conn.end().catch(() => {});
    }
  });

  test('增量：源插入 2 行后二次同步推进水印', {
    timeout: 120000,
  }, async () => {
    const conn = await live.ensure();
    try {
      await live.insertRows(conn, 2);
      const src = await live.srcCount(conn);
      const r2 = await sync.runNow(cfg.id);
      assert.equal(r2.rows, 2, '增量仅拉新行');
      const local2 = db.prepare(`SELECT COUNT(*) AS c FROM ${db.dialect.quoteIdent(localTable)}`).get();
      assert.equal(local2.c, src.count, '本地行数应追上源行数');
      const sc = db.prepare('SELECT * FROM sync_configs WHERE id = ?').get(cfg.id);
      assert.equal(Number(sc.last_watermark), src.maxId, '水印应推进到源最大 id');
    } finally {
      await conn.end().catch(() => {});
    }
  });

  test('注册本地表为数据集并读列', async () => {
    const cols = await datasourceService.listColumns(dsId, 'local', localTable);
    assert.ok(cols.length >= 4, `本地表应含 id/regionkey/name/created_at，实际 ${cols.length}`);
    const ds = await datasetService.registerSqlDataset(
      'sales2-sync-ds', dsId, 'local', localTable,
      cols.map((c) => ({ name: c.name, label: c.name, type: c.role === 'metric' ? 'number' : 'string' })),
      1,
    );
    assert.equal(ds.source_type, 'sql');
    assert.equal(ds.datasource_id, dsId);
    const rows = db.prepare(`SELECT id FROM ${db.dialect.quoteIdent(localTable)} ORDER BY id LIMIT 1`).get();
    assert.ok(rows && rows.id >= 1);
  });

  test.after(() => {
    try { db.close(); } catch (e) { /* ignore */ }
    fs.rmSync(process.env.DB_PATH, { force: true });
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  });
}