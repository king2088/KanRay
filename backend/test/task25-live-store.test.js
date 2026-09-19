// backend/test/task25-live-store.test.js
// 五库 live 存储回归：建表 / CRUD / 自增 / paginate
// sqlite 恒跑；mysql/pg/mssql/oracle 仅在 RUN_LIVE=1 且容器可达时跑。
const test = require('node:test');
const assert = require('node:assert');
const { createStoreFor, svMetaTableSql } = require('./helpers/store-live');

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
}