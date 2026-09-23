// backend/test/task35-pg-matrix.test.js
// PostgreSQL 应用存储 + worker 测试矩阵（对 Docker 中的 PG 实测）。
//
// 与其余 *.test.js 不同：本文件让「应用存储单例」直接跑在 PostgreSQL 上，
// 因此会覆盖 sqlite 单测无法暴露的方言差异（datetime('now') 转译、Date 归一化、
// 异步元数据、sync_jobs 行锁领取、worker 真实消费、PG 作为同步源时的占位符等）。
//
// 运行方式：
//   RUN_LIVE=1 npm run test:pg
//   或   RUN_LIVE=1 LIVE_CASES=postgres node --test test/task35-pg-matrix.test.js
// 目标库：PG_TEST_URL（默认本机 kanban-live-postgres 127.0.0.1:15432），
// 每个 pid 使用独立数据库并在结束后 DROP，互不污染。
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const LIVE = process.env.RUN_LIVE === '1'
  && (!process.env.LIVE_CASES
    || process.env.LIVE_CASES.split(',').map((s) => s.trim()).includes('postgres'));

const PG_BASE = process.env.PG_TEST_URL || 'postgresql://postgres:Kanban%40123@127.0.0.1:15432';
const DB_NAME = process.env.PG_MATRIX_DB || `kanban_pg_matrix_${process.pid}`;

function pgUrlWithDb(db) {
  const u = new URL(PG_BASE);
  u.pathname = `/${db}`;
  return u.toString();
}
function qi(name) { return `"${String(name).replace(/"/g, '""')}"`; }

if (LIVE) {
  process.env.DB_TYPE = 'postgres';
  process.env.DB_URL = pgUrlWithDb(DB_NAME);
  process.env.SYNC_MODE = 'worker';
  process.env.DATA_DIR = `/tmp/kanban-pgmatrix-${process.pid}`;
  process.env.UPLOAD_DIR = `/tmp/kanban-pgmatrix-uploads-${process.pid}`;
  process.env.SYNC_WORKER_POLL_MS = process.env.SYNC_WORKER_POLL_MS || '300';
}

const test = require('node:test');
const assert = require('node:assert');

if (!LIVE) {
  test('PG matrix（跳过）：需 RUN_LIVE=1 且 LIVE_CASES 含 postgres', { skip: '未开启 live' }, () => {});
} else {
  const db = require('../src/db');
  const config = require('../src/config');
  const sync = require('../src/services/sync.service');
  const queue = require('../src/services/sync-queue.service');
  const providersApi = require('../src/datasources/providers');
  const datasourceService = require('../src/services/datasource.service');

  const SRCPORT = new URL(PG_BASE).port || '5432';
  const SRCHOST = new URL(PG_BASE).hostname;
  const SRCPASS = decodeURIComponent(new URL(PG_BASE).password);
  const SRCUSER = decodeURIComponent(new URL(PG_BASE).username);

  const utcNaive = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

  async function withAdmin(fn) {
    const c = new Client({ connectionString: pgUrlWithDb('postgres') });
    await c.connect();
    try { return await fn(c); } finally { await c.end(); }
  }

  // 应用存储中的一条 PG 数据源配置（用于真实 provider 读取/同步）
  async function insertPgDatasource(name, mode = 'direct') {
    const cfg = {
      host: SRCHOST, port: Number(SRCPORT), database: DB_NAME,
      user: SRCUSER, password: SRCPASS, schema: 'public',
    };
    const r = await db.prepare(
      "INSERT INTO data_sources (name, type, config, mode, is_active, owner_id) VALUES (?, 'postgres', ?, ?, 1, 1)",
    ).run(name, JSON.stringify(cfg), mode);
    return Number(r.lastInsertRowid);
  }

  test.before(async () => {
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
    await withAdmin(async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${qi(DB_NAME)} WITH (FORCE)`).catch(() => {});
      await c.query(`CREATE DATABASE ${qi(DB_NAME)}`);
    });
    await db.initSchema();
    await db.exec('CREATE TABLE pg_browse_demo (id BIGINT PRIMARY KEY, amt NUMERIC, note TEXT, updated_at TIMESTAMP)');
  });

  test.after(async () => {
    try { await db.close(); } catch (e) { /* ignore */ }
    await withAdmin(async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${qi(DB_NAME)} WITH (FORCE)`).catch(() => {});
    }).catch(() => {});
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
    fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  });

  test('schema 引导：核心表齐备（含 sync_jobs、大屏三表）', async () => {
    const tables = (await db.listTables()).map((n) => String(n).toLowerCase());
    for (const t of ['data_sources', 'sync_configs', 'sync_jobs', 'sync_logs', 'users', 'audit_logs',
      'big_screens', 'big_screen_shares', 'big_screen_templates']) {
      assert.ok(tables.includes(t), `缺少表 ${t}（实际: ${tables.join(',')}）`);
    }
    const tmplCols = (await db.listColumns('big_screen_templates')).map((c) => String(c.name).toLowerCase());
    for (const c of ['id', 'name', 'description', 'thumbnail', 'config', 'components', 'owner_id', 'created_at', 'updated_at']) {
      assert.ok(tmplCols.includes(c), `big_screen_templates 缺少列 ${c}（实际: ${tmplCols.join(',')}）`);
    }
    const shareCols = (await db.listColumns('big_screen_shares')).map((c) => String(c.name).toLowerCase());
    for (const c of ['id', 'big_screen_id', 'token', 'password_hash', 'expires_at', 'is_active', 'created_by', 'created_at', 'updated_at']) {
      assert.ok(shareCols.includes(c), `big_screen_shares 缺少列 ${c}（实际: ${shareCols.join(',')}）`);
    }
  });

  test('大屏三表（PG）：service 级大屏/模板/分享 CRUD + datetime(\'now\') + FK 级联', async () => {
    const bigScreenService = require('../src/services/big-screen.service');
    const templateService = require('../src/services/big-screen-template.service');

    const screen = await bigScreenService.createBigScreen({
      name: 'PG 矩阵大屏',
      description: 'matrix',
      config: { width: 1920, height: 1080 },
      components: [{ id: 'w1', type: 'bar' }],
    }, 1);
    assert.ok(screen.id, 'createBigScreen 应返回 id（RETURNING * 回读）');
    assert.equal(screen.config.width, 1920, 'config JSON 列应解析回对象');
    assert.equal(screen.components.length, 1);

    const updated = await bigScreenService.updateBigScreen(screen.id, { name: 'PG 矩阵大屏 v2' });
    assert.equal(updated.name, 'PG 矩阵大屏 v2');
    assert.ok(updated.updatedAt, 'updatedAt 别名应保留（quoteAliases）');
    assert.match(String(updated.updatedAt), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      `updated_at 应由 datetime('now')→now() 写回为规范时间，实际: ${updated.updatedAt}`);

    const list = await bigScreenService.listBigScreens();
    assert.ok(list.some((s) => s.id === screen.id), '列表应含新建大屏');

    const tpl = await templateService.createTemplate({
      name: 'PG 模板', description: 't', config: { width: 1920 }, components: [{ id: 'w1' }],
    }, 1);
    const tpls = await templateService.listTemplates();
    assert.ok(tpls.some((t) => t.id === tpl.id), '模板列表应含新建模板');
    await templateService.deleteTemplate(tpl.id);
    await assert.rejects(() => templateService.getTemplateOrThrow(tpl.id), Error, '删除后应 404');

    const share = await bigScreenService.createShare({ bigScreenId: screen.id, password: 'pass1234', userId: 1 });
    assert.ok(share.token, '分享应生成 token');
    assert.equal(share.hasPassword, true);
    assert.equal(bigScreenService.shareState(share), 'active');
    const off = await bigScreenService.updateShare(share.id, { isActive: false });
    assert.equal(off.isActive, 0);
    assert.equal(bigScreenService.shareState(off), 'inactive', '停用后 shareState 应为 inactive');
    assert.equal((await bigScreenService.listShares(screen.id)).length, 1);

    // FK ON DELETE CASCADE：删大屏后分享随删（生产部署依赖此约束）
    await bigScreenService.deleteBigScreen(screen.id);
    const orphan = await db.prepare('SELECT COUNT(*) AS c FROM big_screen_shares WHERE big_screen_id = ?').get(screen.id);
    assert.equal(Number(orphan.c), 0, '删除大屏后分享应级联删除');
    assert.equal(await bigScreenService.getBigScreen(screen.id), undefined, '大屏应已删除');
  });

  test('时间归一化：now() 写回为 UTC naive 秒，且与进程 UTC 时钟一致', async () => {
    const email = `pg-time-${Date.now()}@test.io`;
    const ins = await db.prepare("INSERT INTO users (email, password_hash, name, is_active) VALUES (?, ?, ?, 1)")
      .run(email, 'x', 'pg-time');
    const row = await db.prepare('SELECT created_at FROM users WHERE id = ?').get(Number(ins.lastInsertRowid));
    assert.match(String(row.created_at), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, '应为 YYYY-MM-DD HH:MM:SS');
    const diff = Math.abs(new Date(`${row.created_at.replace(' ', 'T')}Z`).getTime() - Date.now());
    assert.ok(diff < 180000, `created_at 与 UTC now 偏差 ${diff}ms（PG timezone 与进程不一致？）`);
  });

  test('异步元数据：listTables/listColumns 返回已解析结果（非 Promise）', async () => {
    const tables = await db.listTables();
    assert.ok(Array.isArray(tables), 'listTables 应为数组');
    const cols = await db.listColumns('sync_jobs');
    assert.ok(Array.isArray(cols) && cols.some((c) => c.name === 'status'), 'listColumns 应含 sync_jobs.status');
  });

  test('真实 PG 数据源：浏览表/列走应用存储（异步 provider 正确 await）', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_browse_demo');
    await db.exec('CREATE TABLE pg_browse_demo (id BIGINT PRIMARY KEY, amt NUMERIC, note TEXT, updated_at TIMESTAMP)');
    const dsId = await insertPgDatasource('pg-browse', 'direct');
    const tables = await datasourceService.listTables(dsId, 'public', null, { source: true });
    assert.ok(Array.isArray(tables) && tables.some((t) => (t.name || t) === 'pg_browse_demo'),
      `应浏览到 pg_browse_demo，实际 ${JSON.stringify(tables)}`);
    const cols = await datasourceService.listColumns(dsId, 'public', 'pg_browse_demo', null, { source: true });
    assert.ok(Array.isArray(cols) && cols.some((c) => c.name === 'id'), `列应含 id，实际 ${JSON.stringify(cols)}`);
  });

  test('队列（PG）：重复入队幂等 / 领取互斥 / 租约回收 / 终态保留期清理', async () => {
    const dsId = await insertPgDatasource('pg-queue');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_browse_demo', strategy: 'full' });

    const j1 = await queue.enqueue(c.id, 'manual');
    assert.equal(j1.existing, false);
    const j2 = await queue.enqueue(c.id, 'manual');
    assert.equal(j2.existing, true);
    assert.equal(j2.id, j1.id);
    assert.equal(await queue.activeCount(), 1);

    const claimed = await queue.claim('w1', 60000);
    assert.ok(claimed && claimed.id === j1.id);
    assert.equal(claimed.status, 'running');
    const dup = await queue.claim('w2', 60000);
    assert.equal(dup, null, '执行中的任务不应被重复领取');

    await queue.finish(j1.id, 'success');
    assert.equal(await queue.activeCount(), 0);
    assert.equal(await queue.queuedCount(), 0);

    // 终态超期清理
    await db.prepare('UPDATE sync_jobs SET finished_at = ? WHERE id = ?').run('2020-01-01 00:00:00', j1.id);
    assert.equal(await queue.pruneFinished(7), 1);
  });

  test('队列（PG）：租约过期后可被其他 worker 回收', async () => {
    const dsId = await insertPgDatasource('pg-lease');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_browse_demo', strategy: 'full' });
    const j = await queue.enqueue(c.id, 'schedule');
    await queue.claim('dead', 0);
    const reclaimed = await queue.claim('alive', 60000);
    assert.ok(reclaimed && reclaimed.id === j.id);
    assert.equal(reclaimed.worker_id, 'alive');
    await queue.finish(j.id, 'success');
  });

  test('队列（PG）：并发领取同一任务只有一个成功', async () => {
    const dsId = await insertPgDatasource('pg-race');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_browse_demo', strategy: 'full' });
    const j = await queue.enqueue(c.id, 'manual');
    const got = await Promise.all([
      queue.claim('ra', 60000), queue.claim('rb', 60000),
      queue.claim('rc', 60000), queue.claim('rd', 60000),
    ]);
    const winners = got.filter((x) => x && x.id === j.id);
    assert.equal(winners.length, 1, `并发领取应恰好 1 个成功，实际 ${winners.length}`);
    await queue.finish(j.id, 'success');
  });

  test('真实 PG 源全量同步：streaming 写入本地表', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_full_src');
    await db.exec('CREATE TABLE pg_full_src (id BIGINT PRIMARY KEY, amt NUMERIC, updated_at TIMESTAMP)');
    for (let i = 1; i <= 20; i += 1) {
      await db.prepare('INSERT INTO pg_full_src (id, amt, updated_at) VALUES (?, ?, ?)')
        .run(i, i * 10, '2024-01-01 00:00:00');
    }
    const dsId = await insertPgDatasource('pg-full', 'sync');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_full_src', strategy: 'full' });
    const out = await sync.runSync(c.id);
    assert.equal(out.rows, 20);
    const local = sync.nextLocalTable(dsId, 'pg_full_src');
    const cnt = await db.prepare(`SELECT COUNT(*) AS c FROM ${qi(local)}`).get();
    assert.equal(Number(cnt.c), 20);
  });

  test('真实 PG 源增量同步：占位符与水位推进（回归 ? → $n）', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_inc_src');
    await db.exec('CREATE TABLE pg_inc_src (id BIGINT PRIMARY KEY, amt NUMERIC, updated_at TIMESTAMP)');
    for (let i = 1; i <= 5; i += 1) {
      await db.prepare('INSERT INTO pg_inc_src (id, amt, updated_at) VALUES (?, ?, ?)')
        .run(i, i, '2024-01-01 00:00:00');
    }
    const dsId = await insertPgDatasource('pg-inc', 'sync');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_inc_src', strategy: 'incremental', watermarkField: 'id' });
    const first = await sync.runSync(c.id);
    assert.equal(first.rows, 5);
    // 第二次增量：水位 5 之后新增一行，应只同步 1 行（触发 WHERE id > $1）
    await db.prepare('INSERT INTO pg_inc_src (id, amt, updated_at) VALUES (?, ?, ?)')
      .run(6, 6, '2024-01-02 00:00:00');
    const second = await sync.runSync(c.id);
    assert.equal(second.rows, 1, '增量应只取水位之后的新行');
    const cfgRow = await db.prepare('SELECT last_watermark FROM sync_configs WHERE id = ?').get(c.id);
    assert.equal(String(cfgRow.last_watermark), '6');
  });

  test('真实 PG 源增量对账：源端删除触发本地删除', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_del_src');
    await db.exec('CREATE TABLE pg_del_src (id BIGINT PRIMARY KEY, amt NUMERIC)');
    for (let i = 1; i <= 8; i += 1) await db.prepare('INSERT INTO pg_del_src (id, amt) VALUES (?, ?)').run(i, i);
    const dsId = await insertPgDatasource('pg-del', 'sync');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_del_src', strategy: 'incremental', watermarkField: 'id' });
    await sync.runSync(c.id);
    await db.prepare('DELETE FROM pg_del_src WHERE id = ?').run(4);
    const res = await sync.runSync(c.id);
    assert.equal(res.deleted, 1);
    const local = sync.nextLocalTable(dsId, 'pg_del_src');
    const gone = await db.prepare(`SELECT id FROM ${qi(local)} WHERE id = ?`).get(4);
    assert.equal(gone, undefined);
  });

  test('真实 worker 进程：消费 sync_jobs 完成同步（端到端）', async () => {
    const { spawn } = require('node:child_process');
    await db.exec('DROP TABLE IF EXISTS pg_worker_src');
    await db.exec('CREATE TABLE pg_worker_src (id BIGINT PRIMARY KEY, amt NUMERIC)');
    for (let i = 1; i <= 12; i += 1) await db.prepare('INSERT INTO pg_worker_src (id, amt) VALUES (?, ?)').run(i, i);

    const dsId = await insertPgDatasource('pg-worker', 'sync');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_worker_src', strategy: 'full' });
    const job = await queue.enqueue(c.id, 'manual');

    const workerPath = path.join(__dirname, '..', 'src', 'worker', 'main.js');
    const child = spawn(process.execPath, [workerPath], {
      env: {
        ...process.env,
        DB_TYPE: 'postgres',
        DB_URL: process.env.DB_URL,
        SYNC_MODE: 'worker',
        DATA_DIR: process.env.DATA_DIR,
        UPLOAD_DIR: process.env.UPLOAD_DIR,
        SYNC_WORKER_POLL_MS: '200',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let childLog = '';
    child.stdout.on('data', (d) => { childLog += d; });
    child.stderr.on('data', (d) => { childLog += d; });

    try {
      const deadline = Date.now() + 60000;
      let row;
      while (Date.now() < deadline) {
        row = await db.prepare('SELECT * FROM sync_jobs WHERE id = ?').get(job.id);
        if (row && (row.status === 'success' || row.status === 'failed')) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      assert.ok(row, '未读到 job');
      assert.equal(row.status, 'success', `worker 执行失败: ${row && row.error}\n${childLog}`);
      const local = sync.nextLocalTable(dsId, 'pg_worker_src');
      const cnt = await db.prepare(`SELECT COUNT(*) AS c FROM ${qi(local)}`).get();
      assert.equal(Number(cnt.c), 12, 'worker 应写入本地表 12 行');
    } finally {
      child.kill('SIGTERM');
    }
  });

  test('worker 模式调度 tick 只入队不执行', async () => {
    const sched = require('../src/jobs/sync-scheduler');
    const dsId = await insertPgDatasource('pg-sched', 'sync');
    const c = await sync.createConfig(dsId, { sourceTable: 'pg_browse_demo', strategy: 'full' });
    const before = await db.prepare('SELECT last_sync_at FROM sync_configs WHERE id = ?').get(c.id);
    const res = await sched.tick();
    assert.ok(res.enqueued >= 1);
    const after = await db.prepare('SELECT last_sync_at FROM sync_configs WHERE id = ?').get(c.id);
    assert.equal(after.last_sync_at, before.last_sync_at, 'worker 模式不应直接执行');
    const job = await db.prepare('SELECT * FROM sync_jobs WHERE sync_config_id = ? ORDER BY id DESC').get(c.id);
    assert.equal(job.status, 'queued');
  });

  test('流式对账（PG 应用库）：跨多页 >5000 行仍准确删除缺失主键', async () => {
    const dsId = await insertPgDatasource('pg-stream', 'sync');
    const FAKE = {
      src: [],
      listColumns: () => [
        { name: 'id', type: 'int' }, { name: 'amt', type: 'decimal' }, { name: 'updated_at', type: 'timestamp' },
      ],
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
    const realGet = providersApi.getProvider;
    providersApi.getProvider = () => FAKE;
    try {
      const c = await sync.createConfig(dsId, { sourceTable: 'big', strategy: 'incremental', watermarkField: 'id' });
      const N = 6000;
      FAKE.src = Array.from({ length: N }, (_, i) => ({ id: i + 1, amt: i, updated_at: '2024-01-01 00:00:00' }));
      await sync.runSync(c.id);
      const local = sync.nextLocalTable(dsId, 'big');
      assert.equal(Number((await db.prepare(`SELECT COUNT(*) AS c FROM ${qi(local)}`).get()).c), N);
      FAKE.src = FAKE.src.filter((r) => r.id !== 3000);
      const res = await sync.runSync(c.id);
      assert.equal(res.deleted, 1);
      assert.equal(await db.prepare(`SELECT id FROM ${qi(local)} WHERE id = ?`).get(3000), undefined);
    } finally {
      providersApi.getProvider = realGet;
    }
  });

  test('应用存储（PG）：并发事务连接隔离（回归全局 txClient）', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_tx_demo');
    await db.exec('CREATE TABLE pg_tx_demo (id BIGSERIAL PRIMARY KEY, v INTEGER, tag TEXT)');
    const rollbackAt = new Set([0, 5, 10, 15]);
    const errs = [];
    await Promise.all(Array.from({ length: 20 }, (_, i) => db.transaction(async () => {
      await db.prepare('INSERT INTO pg_tx_demo (v, tag) VALUES (?, ?)').run(i, `t${i}`);
      if (rollbackAt.has(i)) throw new Error(`rollback-${i}`);
    })().catch((e) => { errs.push(String(e.message)); })));
    assert.equal(errs.length, rollbackAt.size, `只应有回滚错误，实际: ${errs.join(' | ')}`);
    assert.ok(errs.every((m) => m.startsWith('rollback-')), `不应出现连接串用/释放错误: ${errs.join(' | ')}`);
    const cnt = await db.prepare('SELECT COUNT(*) AS c FROM pg_tx_demo').get();
    assert.equal(Number(cnt.c), 20 - rollbackAt.size, '提交数应等于未回滚事务数');
    const dup = await db.prepare('SELECT COUNT(*) AS c FROM (SELECT tag FROM pg_tx_demo GROUP BY tag HAVING COUNT(*) > 1) t').get();
    assert.equal(Number(dup.c), 0, '不应有重复 tag（说明语句跑到了错误连接）');
  });

  test('应用存储（PG）：嵌套事务复用外层连接且外层回滚回滚内层', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_nest_demo');
    await db.exec('CREATE TABLE pg_nest_demo (id BIGSERIAL PRIMARY KEY, v TEXT)');
    await db.transaction(async () => {
      await db.prepare('INSERT INTO pg_nest_demo (v) VALUES (?)').run('outer');
      await db.transaction(async () => {
        await db.prepare('INSERT INTO pg_nest_demo (v) VALUES (?)').run('inner');
      })();
    })();
    assert.equal(Number((await db.prepare('SELECT COUNT(*) AS c FROM pg_nest_demo').get()).c), 2);
    await db.transaction(async () => {
      await db.prepare('INSERT INTO pg_nest_demo (v) VALUES (?)').run('o2');
      await db.transaction(async () => {
        await db.prepare('INSERT INTO pg_nest_demo (v) VALUES (?)').run('i2');
      })();
      throw new Error('rollback');
    })().catch(() => {});
    assert.equal(Number((await db.prepare('SELECT COUNT(*) AS c FROM pg_nest_demo').get()).c), 2, '外层回滚应同时回滚内层');
  });

  test('数值归一化（PG）：int8/numeric 返回 JS number（回归字符串化）', async () => {
    await db.exec('DROP TABLE IF EXISTS pg_num_demo');
    await db.exec('CREATE TABLE pg_num_demo (id BIGSERIAL PRIMARY KEY, n BIGINT, amount NUMERIC(18,2))');
    await db.prepare('INSERT INTO pg_num_demo (n, amount) VALUES (?, ?)').run(42, '123.45');
    const row = await db.prepare('SELECT id, n, amount FROM pg_num_demo').get();
    assert.equal(typeof row.id, 'number', `id 应为 number，实际 ${typeof row.id}`);
    assert.equal(typeof row.n, 'number', `bigint 列应为 number，实际 ${typeof row.n}`);
    assert.equal(typeof row.amount, 'number', `numeric 列应为 number，实际 ${typeof row.amount}`);
    assert.equal(row.amount, 123.45);
    const agg = await db.prepare('SELECT COUNT(*) AS c, SUM(n) AS s, AVG(amount) AS a FROM pg_num_demo').get();
    assert.equal(typeof agg.c, 'number', `COUNT 应为 number，实际 ${typeof agg.c}`);
    assert.equal(typeof agg.s, 'number', `SUM 应为 number，实际 ${typeof agg.s}`);
    assert.equal(typeof agg.a, 'number', `AVG 应为 number，实际 ${typeof agg.a}`);
  });

  test('管理列表计数（PG）：listUsers/audit.list 返回数值 total（回归 await ...get().n 优先级）', async () => {
    const rbac = require('../src/services/rbac.service');
    const audit = require('../src/services/audit.service');
    await db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(`pg-total-${process.pid}@t`, 'x', 'pg-total');
    const u = await rbac.listUsers({ page: 1, pageSize: 5 });
    assert.equal(typeof u.total, 'number', `users total 应为 number，实际 ${typeof u.total}（${JSON.stringify(u.total)}）`);
    assert.ok(u.total >= 1, 'users total 应 >= 1');
    const before = (await audit.list({ page: 1, pageSize: 1 })).total;
    await audit.log({ userId: null, email: 'pg-total@t', action: 'unit' }, { ip: '1.2.3.4' });
    const a = await audit.list({ page: 1, pageSize: 2 });
    assert.equal(typeof a.total, 'number', `audit total 应为 number，实际 ${typeof a.total}（${JSON.stringify(a.total)}）`);
    assert.equal(a.total, before + 1, 'audit total 应随新增审计 +1');
    assert.equal(a.list[0].action, 'unit');
  });
}
