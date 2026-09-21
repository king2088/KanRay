// backend/test/task28-etl-full-nodes.test.js
// 全节点 ETL 端到端验证：在 live mysql:8.0 (testdb) 上创建 ≥5 个 ETL 数据集，
// 覆盖全部 11 种节点类型（source/join/filter/aggregate/columnSelect/dedup/
// valueReplace/nullReplace/trim/sqlNode/output），保存后逐一预览每个节点并
// 断言其 SQL、字段与变换后的数据均正确。
// 运行：cd backend && RUN_LIVE=1 node --test test/task28-etl-full-nodes.test.js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');

if (process.env.RUN_LIVE !== '1') {
  test('ETL 全节点 live 验证', { skip: 'RUN_LIVE=1 未开启（需 mysql 13306 容器）' }, () => {});
} else {
  const { db, resetDb } = require('./helpers/db');
  const app = require('../src/app');
  const authService = require('../src/services/auth.service');
  const mysqlFamily = require('../src/datasources/providers/mysql-family');

  const MYSQL = { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' };

  function reachable(host, port, timeout = 1500) {
    return new Promise((resolve) => {
      const s = net.connect({ host, port });
      s.setTimeout(timeout);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('error', () => { s.destroy(); resolve(false); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
    });
  }

  async function dirtyTableExists() {
    const rows = await mysqlFamily.runQuery(
      MYSQL,
      `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'testdb' AND TABLE_NAME = 'etl_dirty'`,
      []
    );
    return Number(rows[0].c) > 0;
  }

  // 准备一份「脏数据」：含空格、空值、重复行，供 cleaning 类节点（trim/nullReplace/dedup/valueReplace）真实验证
  async function ensureDirtyTable() {
    if (await dirtyTableExists()) {
      await mysqlFamily.runQuery(MYSQL, 'DROP TABLE testdb.etl_dirty', []);
    }
    await mysqlFamily.runQuery(MYSQL, `
      CREATE TABLE testdb.etl_dirty (
        id INT PRIMARY KEY,
        name VARCHAR(50),
        region VARCHAR(50),
        category VARCHAR(50),
        amount DECIMAL(10,2),
        status VARCHAR(20)
      )
    `, []);
    await mysqlFamily.runQuery(MYSQL, `
      INSERT INTO testdb.etl_dirty (id, name, region, category, amount, status) VALUES
        (1, ' 华东旗舰店 ', '华东', '家电', 120.00, 'ACTIVE'),
        (2, '华东旗舰店', '华东', '家电', 120.00, 'ACTIVE'),        -- trim 后与 1 重复
        (3, ' 华南店 ', ' 华南 ', '服饰', NULL, 'INACTIVE'),
        (4, '华北店', '华北', NULL, 80.00, 'ACTIVE'),
        (5, ' 华东旗舰店 ', '华东', NULL, NULL, 'ACTIVE')           -- trim 后与 1 重复
    `, []);
  }

  let server; let base; let adminToken; let dsId = null;

  function auth(token) {
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: auth(adminToken),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* 非 JSON 响应 */ }
    return { status: res.status, body: json };
  }

  async function previewNode(definition, nodeId, limit = 200) {
    return api(`/api/datasources/${dsId}/build/preview-node`, {
      method: 'POST',
      body: { definition, nodeId, limit },
    });
  }

  function tryNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }

  test('前置：live mysql 可达，创建数据源与脏数据表', { timeout: 120000 }, async () => {
    if (!(await reachable('127.0.0.1', 13306))) return;
    await resetDb();
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
    const admin = await authService.login('admin@kanray.local', 'admin123');
    adminToken = admin.accessToken;

    await ensureDirtyTable();

    const res = await api('/api/datasources', {
      method: 'POST',
      body: { name: '测 ETL 全节点 MySQL', type: 'mysql', config: MYSQL },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.code, 0);
    assert.equal(res.body.data.type, 'mysql');
    dsId = Number(res.body.data.id);
    assert.ok(dsId > 0);
  });

  // ─── 数据集 1：source + filter + columnSelect + output ───
  // 华东地区、金额 > 500 的订单，只保留 order_no/amount 两列
  const def1 = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'demo_orders' },
      { nodeId: 'n2', nodeType: 'filter', sourceNode: 'n1', conditions: [
        { field: { alias: 'o', field: 'region' }, op: 'eq', value: '华东' },
        { field: { alias: 'o', field: 'amount' }, op: 'gt', value: 500 },
      ] },
      { nodeId: 'n3', nodeType: 'columnSelect', sourceNode: 'n2', columns: [
        { alias: 'o', field: 'order_no' }, { alias: 'o', field: 'amount' },
      ] },
      { nodeId: 'n4', nodeType: 'output', sourceNode: 'n3', limit: 100 },
    ],
  };

  test('数据集1 华东大额订单：source→filter→columnSelect→output 全链正确', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    // 源节点：字段 = 全部 demo_orders 列，量 = 60
    const src = await previewNode(def1, 'n1');
    assert.equal(src.body.code, 0, src.body.message);
    assert.ok(src.body.data.fields.length >= 6, 'source 至少 6 个字段');
    assert.ok(src.body.data.rows.length >= 60, 'source 至少 60 行');
    assert.ok(src.body.data.sql.includes('FROM'), src.body.data.sql);

    // 过滤节点：只剩华东且 >500 → 9 行（right），全部符合条件
    const filt = await previewNode(def1, 'n2');
    assert.equal(filt.body.code, 0, filt.body.message);
    assert.equal(filt.body.data.rows.length, 5, `华东>500 应 5 行，实际 ${filt.body.data.rows.length}`);
    for (const r of filt.body.data.rows) {
      assert.equal(r.__o__region, '华东', JSON.stringify(r));
      assert.ok(tryNum(r.__o__amount) > 500, JSON.stringify(r));
    }

    // 选择列：仅保留 order_no + amount 两个字段
    const sel = await previewNode(def1, 'n3');
    assert.equal(sel.body.code, 0, sel.body.message);
    const fnames = sel.body.data.fields.map((f) => f.name);
    assert.deepEqual(fnames, ['__o__order_no', '__o__amount'], JSON.stringify(fnames));
    assert.equal(sel.body.data.rows.length, 5);
    for (const r of sel.body.data.rows) {
      assert.ok(r.__o__order_no, JSON.stringify(r));
      assert.ok(tryNum(r.__o__amount) > 500, JSON.stringify(r));
    }

    // 输出节点：透传选列结果
    const out = await previewNode(def1, 'n4');
    assert.equal(out.body.code, 0, out.body.message);
    assert.equal(out.body.data.rows.length, 5);
  });

  // ─── 数据集 2：source + source + join + output（订单 × 区域）───
  const def2 = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'demo_orders' },
      { nodeId: 'n2', nodeType: 'source', alias: 'r', schema: 'testdb', table: 'demo_region' },
      { nodeId: 'n3', nodeType: 'join', sourceNode: 'n1', rightNodeId: 'n2', on: [
        { from: { alias: 'o', field: 'region' }, to: { alias: 'r', field: 'region' } },
      ] },
      { nodeId: 'n4', nodeType: 'output', sourceNode: 'n3', limit: 200 },
    ],
  };

  test('数据集2 订单×区域 join：双源+关联+输出正确', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    const right = await previewNode(def2, 'n2');
    assert.equal(right.body.code, 0, right.body.message);
    assert.equal(right.body.data.rows.length, 6, '区域表 6 行');

    const join = await previewNode(def2, 'n3');
    assert.equal(join.body.code, 0, join.body.message);
    const jnames = join.body.data.fields.map((f) => f.name);
    assert.ok(jnames.includes('__o__order_no') && jnames.includes('__r__manager'), JSON.stringify(jnames));
    // 内连接：每个 order 的 region 都匹配到区域表 → 60 行
    assert.equal(join.body.data.rows.length, 60, `join 应 60 行，实际 ${join.body.data.rows.length}`);
    for (const r of join.body.data.rows) {
      assert.equal(r.__o__region, r.__r__region, JSON.stringify(r));
      assert.ok(r.__r__manager, JSON.stringify(r));
    }

    const out = await previewNode(def2, 'n4');
    assert.equal(out.body.code, 0, out.body.message);
    assert.equal(out.body.data.rows.length, 60);
  });

  // ─── 数据集 3：source + aggregate + output（按地区聚合销售额）───
  const def3 = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'demo_orders' },
      { nodeId: 'n2', nodeType: 'aggregate', sourceNode: 'n1', groupBy: [
        { alias: 'o', field: 'region' },
      ], metrics: [
        { agg: 'sum', field: { alias: 'o', field: 'amount' } },
        { agg: 'count' },
      ] },
      { nodeId: 'n3', nodeType: 'output', sourceNode: 'n2', limit: 100 },
    ],
  };

  test('数据集3 按区域聚合：groupBy+sum+count 正确', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    const agg = await previewNode(def3, 'n2');
    assert.equal(agg.body.code, 0, agg.body.message);
    const anames = agg.body.data.fields.map((f) => f.name);
    assert.deepEqual(anames, ['d_0', 'm_0', 'm_1'], JSON.stringify(anames));
    assert.equal(agg.body.data.rows.length, 6, '6 个地区');
    for (const r of agg.body.data.rows) {
      assert.ok(tryNum(r.m_0) > 0, JSON.stringify(r));
      assert.equal(Number(r.m_1), 10, `每地区 10 单，实际 ${JSON.stringify(r)}`);
    }
    const total = agg.body.data.rows.reduce((s, r) => s + Number(r.m_0), 0);
    assert.equal(total, 41690, `总额应 41690，实际 ${total}`);

    const out = await previewNode(def3, 'n3');
    assert.equal(out.body.code, 0, out.body.message);
    assert.equal(out.body.data.rows.length, 6);
  });

  // ─── 数据集 4：source + trim + valueReplace + nullReplace + dedup + output ───
  const def4 = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'd', schema: 'testdb', table: 'etl_dirty' },
      { nodeId: 'n2', nodeType: 'trim', sourceNode: 'n1', columns: [
        { alias: 'd', field: 'name' }, { alias: 'd', field: 'region' },
      ] },
      { nodeId: 'n3', nodeType: 'valueReplace', sourceNode: 'n2', mappings: [
        { field: { alias: 'd', field: 'status' }, from: 'ACTIVE', to: '启用' },
        { field: { alias: 'd', field: 'status' }, from: 'INACTIVE', to: '停用' },
      ] },
      { nodeId: 'n4', nodeType: 'nullReplace', sourceNode: 'n3', mappings: [
        { field: { alias: 'd', field: 'amount' }, to: '0' },
        { field: { alias: 'd', field: 'category' }, to: '未知' },
      ] },
      { nodeId: 'n5', nodeType: 'dedup', sourceNode: 'n4', columns: [
        { alias: 'd', field: 'name' }, { alias: 'd', field: 'region' },
      ] },
      { nodeId: 'n6', nodeType: 'output', sourceNode: 'n5', limit: 100 },
    ],
  };

  test('数据集4 脏数据清洗：trim→valueReplace→nullReplace→dedup 全部生效', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    // trim：name/region 不再带首尾空格
    const trim = await previewNode(def4, 'n2');
    assert.equal(trim.body.code, 0, trim.body.message);
    assert.equal(trim.body.data.rows.length, 5);
    for (const r of trim.body.data.rows) {
      assert.equal(r.__d__name, r.__d__name.trim(), JSON.stringify(r));
      assert.equal(r.__d__region, r.__d__region.trim(), JSON.stringify(r));
    }

    // valueReplace：status 全部被替换
    const vr = await previewNode(def4, 'n3');
    assert.equal(vr.body.code, 0, vr.body.message);
    const statuses = new Set(vr.body.data.rows.map((r) => r.__d__status));
    assert.deepEqual([...statuses].sort(), ['启用', '停用'].sort(), JSON.stringify([...statuses]));

    // nullReplace：amount 无 NULL（NULL→0），category 无 NULL（NULL→未知）
    const nr = await previewNode(def4, 'n4');
    assert.equal(nr.body.code, 0, nr.body.message);
    for (const r of nr.body.data.rows) {
      assert.ok(r.__d__amount !== null && r.__d__amount !== undefined, JSON.stringify(r));
      assert.ok(r.__d__category, JSON.stringify(r));
    }
    const zeroed = nr.body.data.rows.filter((r) => Number(r.__d__amount) === 0);
    assert.equal(zeroed.length, 2, `2 行为 0，实际 ${zeroed.length}`);

    // dedup：(name, region) 去重后 → 3 行（2/5 与 1 撞，3/4 各一）
    const dedup = await previewNode(def4, 'n5');
    assert.equal(dedup.body.code, 0, dedup.body.message);
    assert.equal(dedup.body.data.rows.length, 3, `应 3 行，实际 ${dedup.body.data.rows.length}`);
    const seen = new Set();
    for (const r of dedup.body.data.rows) {
      const k = `${r.__d__name}|${r.__d__region}`;
      assert.ok(!seen.has(k), `重复键 ${k}`);
      seen.add(k);
    }

    const out = await previewNode(def4, 'n6');
    assert.equal(out.body.code, 0, out.body.message);
    assert.equal(out.body.data.rows.length, 3);
  });

  // ─── 数据集 5：source + sqlNode + output（sqlNode 引用 __etl_prev 上游）───
  const def5 = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'demo_orders' },
      { nodeId: 'n2', nodeType: 'sqlNode', sourceNode: 'n1', sql: 'SELECT __o__order_no, __o__amount FROM __etl_prev WHERE __o__amount >= 1000' },
      { nodeId: 'n3', nodeType: 'output', sourceNode: 'n2', limit: 50 },
    ],
  };

  test('数据集5 自定义SQL节点：sqlNode 基于 __etl_prev 计算/过滤正确', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    const sql = await previewNode(def5, 'n2');
    assert.equal(sql.body.code, 0, sql.body.message);
    assert.ok(!sql.body.data.sql.includes('__etl_prev'), sql.body.data.sql);
    const srows = sql.body.data.rows;
    assert.ok(srows.length <= 60, `应 ≤60 行，实际 ${srows.length}`);
    assert.ok(srows.length >= 1, `应 ≥1 行，实际 ${srows.length}`);
    for (const r of srows) {
      assert.ok(Number(r.__o__amount) >= 1000, JSON.stringify(r));
    }

    const out = await previewNode(def5, 'n3');
    assert.equal(out.body.code, 0, out.body.message);
    assert.ok(out.body.data.rows.length <= 50);
  });

  // ─── 数据集 6：独立 sqlNode（无上游，直查真实表）+ output ───
  const def6 = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'sqlNode', sql: 'SELECT region, COUNT(*) AS n, SUM(amount) AS amt FROM testdb.demo_orders GROUP BY region' },
      { nodeId: 'n2', nodeType: 'output', sourceNode: 'n1', limit: 20 },
    ],
  };

  test('数据集6 独立SQL节点：sqlNode 直查真实表 + output 正确', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    const sql = await previewNode(def6, 'n1');
    assert.equal(sql.body.code, 0, sql.body.message);
    assert.equal(sql.body.data.rows.length, 6, '6 个地区分组');
    const regionSum = {};
    for (const r of sql.body.data.rows) {
      regionSum[r.region] = Number(r.amt);
    }
    assert.equal(regionSum['华东'], 5788, JSON.stringify(regionSum));

    const out = await previewNode(def6, 'n2');
    assert.equal(out.body.code, 0, out.body.message);
    assert.equal(out.body.data.rows.length, 6);
  });

  test('保存 ≥5 个数据集：build/save 逐个落库，字段被服务端回填', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    const datasets = [
      { name: 'ETL测试-华东大额订单', def: def1 },
      { name: 'ETL测试-订单区域关联', def: def2 },
      { name: 'ETL测试-按区域聚合', def: def3 },
      { name: 'ETL测试-脏数据清洗', def: def4 },
      { name: 'ETL测试-自定义SQL', def: def5 },
      { name: 'ETL测试-独立SQL', def: def6 },
    ];
    for (const { name, def } of datasets) {
      const res = await api('/api/datasources/' + dsId + '/build/save', {
        method: 'POST',
        body: { name, definition: def },
      });
      assert.equal(res.status, 200, `${name}: ${res.body && res.body.message}`);
      assert.equal(res.body.code, 0, `${name}: ${res.body && res.body.message}`);
      assert.ok(res.body.data.id > 0, `${name} 应返回 dataset id`);
      assert.ok((res.body.data.build_definition || JSON.stringify(res.body.data)).length > 0);
    }

    const list = await api('/api/datasets');
    assert.equal(list.status, 200);
    const mine = list.body.data.filter((d) => d.source_type === 'sql');
    assert.ok(mine.length >= 6, `应 ≥6 个 SQL 数据集，实际 ${mine.length}`);
  });

  test('清理：删除脏数据表，校验全部数据集定义均合法(validate)', { timeout: 120000 }, async (t) => {
    if (!(await reachable('127.0.0.1', 13306))) return t.skip('live mysql 未运行');

    for (const def of [def1, def2, def3, def4, def5, def6]) {
      const res = await api(`/api/datasources/${dsId}/build/validate`, {
        method: 'POST',
        body: { definition: def },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.code, 0);
      assert.equal(res.body.data.valid, true, `${res.body.data.errors}`);
    }

    await mysqlFamily.runQuery(MYSQL, 'DROP TABLE testdb.etl_dirty', []);
    server.close && server.close();
  });
}