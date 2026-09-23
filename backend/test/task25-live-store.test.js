// backend/test/task25-live-store.test.js
// 五库 live 存储回归：建表 / CRUD / 自增 / paginate
// sqlite 恒跑；mysql/pg/mssql/oracle 仅在 RUN_LIVE=1 且容器可达时跑。
const test = require('node:test');
const assert = require('node:assert');
const { createStoreFor, svMetaTableSql } = require('./helpers/store-live');
const schemaMod = require('../src/db/schema');

const CASES = [
  { name: 'mysql', url: 'mysql://root:Kanban%40123@127.0.0.1:13306/live_store_test' },
  { name: 'postgres', url: 'postgresql://postgres:Kanban%40123@127.0.0.1:15432/live_store_test' },
  { name: 'mssql', url: 'mssql://sa:Kanban%40123@127.0.0.1:11433/live_store_test' },
  { name: 'oracle', url: 'oracle://SYSTEM:Kanban%40123@127.0.0.1:11521/FREEPDB1' },
  { name: 'sqlite', url: '/tmp/live-store-sqlite.db' },
];

// 并发事务隔离测试用表（仅支持真正事务的多连接方言）
const TX_TABLE_SQL = {
  mysql: 'CREATE TABLE sv_tx (id BIGINT AUTO_INCREMENT PRIMARY KEY, v INT, tag VARCHAR(64))',
  postgres: 'CREATE TABLE sv_tx (id BIGSERIAL PRIMARY KEY, v INTEGER, tag TEXT)',
  mssql: 'CREATE TABLE sv_tx (id BIGINT IDENTITY(1,1) PRIMARY KEY, v INT, tag NVARCHAR(64))',
};

for (const cs of CASES) {
  if (process.env.LIVE_CASES && !process.env.LIVE_CASES.split(',').includes(cs.name)) continue;
  const needLive = cs.name !== 'sqlite';
  test(`live store: ${cs.name} 建表/CRUD/自增/paginate`, {
    skip: needLive && process.env.RUN_LIVE !== '1' ? `RUN_LIVE=1 未开启（${cs.name} 需容器）` : false,
    timeout: 120000,
  }, async () => {
    const store = await createStoreFor(cs);
    try {
      await store.exec('DROP TABLE IF EXISTS sv_meta');
      await store.exec(svMetaTableSql(cs.name));

      const ins = await store.prepare('INSERT INTO sv_meta (name) VALUES (?)').run('x');
      assert.ok(ins.changes >= 1, `${cs.name}: changes=${ins.changes}`);
      // oracle 无通用 insertId（已知限制，RETURNING 由调用侧特例处理），其余方言必须回读自增 id
      if (cs.name !== 'oracle') assert.ok(Number(ins.lastInsertRowid) > 0, `${cs.name}: lastInsertRowid=${ins.lastInsertRowid}`);

      const row = await store.get('SELECT name FROM sv_meta WHERE name = ?', ['x']);
      assert.equal(row && row.name, 'x');

      const all = await store.prepare('SELECT name FROM sv_meta').all();
      assert.ok(all.length >= 1);

      const page = await store.all(store.dialect.paginate('SELECT name FROM sv_meta ORDER BY id', 10, 0));
      assert.ok(page.length >= 1);

      await store.exec('DROP TABLE IF EXISTS sv_meta');
    } finally {
      await store.close();
    }
  });

  if (TX_TABLE_SQL[cs.name]) {
    test(`live store: ${cs.name} 并发事务连接隔离`, {
      skip: needLive && process.env.RUN_LIVE !== '1' ? `RUN_LIVE=1 未开启（${cs.name} 需容器）` : false,
      timeout: 120000,
    }, async () => {
      const store = await createStoreFor(cs);
      try {
        await store.exec('DROP TABLE IF EXISTS sv_tx');
        await store.exec(TX_TABLE_SQL[cs.name]);
        const rollbackAt = new Set([0, 5, 10, 15]);
        const errs = [];
        await Promise.all(Array.from({ length: 20 }, (_, i) => store.transaction(async () => {
          await store.prepare('INSERT INTO sv_tx (v, tag) VALUES (?, ?)').run(i, `t${i}`);
          if (rollbackAt.has(i)) throw new Error(`rollback-${i}`);
        })().catch((e) => { errs.push(String(e.message)); })));
        const cnt = Number((await store.prepare('SELECT COUNT(*) AS c FROM sv_tx').get()).c);
        assert.equal(cnt, 20 - rollbackAt.size, `${cs.name}: 提交数应等于未回滚事务数`);
        const unexpected = errs.filter((m) => !m.startsWith('rollback-'));
        assert.equal(unexpected.length, 0, `${cs.name}: 非预期错误 ${unexpected.join(' | ')}`);
        await store.exec('DROP TABLE IF EXISTS sv_tx');
      } finally {
        await store.close();
      }
    });
  }

  // 生产部署路径回归：server.js 启动即 ensureSchema(store) —— 非 sqlite 库同样要建出大屏三表。
  // 覆盖全量 DDL 引导（含 mysql/mssql/oracle 此前从未 live 跑过的路径）、关键列、
  // ? 占位符 + datetime('now') 方言转译、FK ON DELETE CASCADE（五方言 driver 均启用外键）。
  test(`live store: ${cs.name} 全量 schema 引导 + 大屏三表 CRUD/级联`, {
    skip: needLive && process.env.RUN_LIVE !== '1' ? `RUN_LIVE=1 未开启（${cs.name} 需容器）` : false,
    timeout: 240000,
  }, async () => {
    const store = await createStoreFor(cs);
    try {
      await schemaMod.ensureSchema(store);

      const tables = (await schemaMod.listTables(store)).map((n) => String(n).toLowerCase());
      for (const t of ['big_screens', 'big_screen_shares', 'big_screen_templates']) {
        assert.ok(tables.includes(t), `${cs.name}: 缺少表 ${t}（实际: ${tables.join(',')}）`);
      }
      const colsOf = async (t) => (await schemaMod.listColumns(store, t)).map((c) => String(c.name).toLowerCase());
      const tmplCols = await colsOf('big_screen_templates');
      for (const c of ['id', 'name', 'description', 'thumbnail', 'config', 'components', 'owner_id', 'created_at', 'updated_at']) {
        assert.ok(tmplCols.includes(c), `${cs.name}: big_screen_templates 缺少列 ${c}（实际: ${tmplCols.join(',')}）`);
      }
      const shareCols = await colsOf('big_screen_shares');
      for (const c of ['id', 'big_screen_id', 'token', 'password_hash', 'expires_at', 'is_active', 'created_by', 'created_at', 'updated_at']) {
        assert.ok(shareCols.includes(c), `${cs.name}: big_screen_shares 缺少列 ${c}（实际: ${shareCols.join(',')}）`);
      }
      const screenCols = await colsOf('big_screens');
      for (const c of ['id', 'name', 'description', 'thumbnail', 'config', 'components', 'owner_id', 'created_at', 'updated_at']) {
        assert.ok(screenCols.includes(c), `${cs.name}: big_screens 缺少列 ${c}（实际: ${screenCols.join(',')}）`);
      }

      // 三表 CRUD（不回读 CLOB/NCLOB 列：Oracle driver 返回 Lob 对象，属已知限制）
      const name = `sv-bs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await store.prepare('INSERT INTO big_screens (name, description, thumbnail, config, components, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, 'desc', 'thumb', '{"w":1920}', '[{"id":"w1"}]', null);
      const screen = await store.prepare('SELECT id, name FROM big_screens WHERE name = ?').get(name);
      assert.ok(screen, `${cs.name}: 大屏插入后应回读`);

      await store.prepare("UPDATE big_screens SET name = ?, updated_at = datetime('now') WHERE id = ?")
        .run(`${name}-v2`, screen.id);
      const updated = await store.prepare('SELECT name, updated_at FROM big_screens WHERE id = ?').get(screen.id);
      assert.equal(updated.name, `${name}-v2`, `${cs.name}: UPDATE 应生效`);
      assert.ok(updated.updated_at, `${cs.name}: updated_at 应由 datetime('now') 转译写入`);

      // oracle 无空字符串语义（'' 即 NULL，且显式 NULL 不会触发列 DEFAULT，直接违反 NOT NULL）；
      // 应用在 oracle 上需自行规避，此处用非空占位串保持五方言一致通过。
      const emptyStr = cs.name === 'oracle' ? ' ' : '';
      await store.prepare('INSERT INTO big_screen_templates (name, description, thumbnail, config, components, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(`${name}-tpl`, emptyStr, emptyStr, '{}', '[]', null);
      const tpl = await store.prepare('SELECT id FROM big_screen_templates WHERE name = ?').get(`${name}-tpl`);
      assert.ok(tpl, `${cs.name}: 模板插入后应回读`);

      const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await store.prepare('INSERT INTO big_screen_shares (big_screen_id, token, password_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(screen.id, token, emptyStr, null, 1);
      const share = await store.prepare('SELECT id FROM big_screen_shares WHERE token = ?').get(token);
      assert.ok(share, `${cs.name}: 分享插入后应回读`);

      await store.prepare('DELETE FROM big_screens WHERE id = ?').run(screen.id);
      const orphan = await store.prepare('SELECT COUNT(*) AS c FROM big_screen_shares WHERE big_screen_id = ?').get(screen.id);
      assert.equal(Number(orphan.c), 0, `${cs.name}: 删除大屏后分享应级联删除`);

      await store.prepare('DELETE FROM big_screen_templates WHERE id = ?').run(tpl.id);
      const left = await store.prepare('SELECT COUNT(*) AS c FROM big_screen_templates WHERE id = ?').get(tpl.id);
      assert.equal(Number(left.c), 0, `${cs.name}: 模板清理应生效`);
    } finally {
      await store.close();
    }
  });
}