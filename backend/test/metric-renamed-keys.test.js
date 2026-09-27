// 混合图表（库指标 + 内联指标）里内联列丢失：前端拿图表配置里的 key 去响应里找列，
// 但后端把「内联 + 库」一起重编号成了 m0..mN（这是有意的，emitRef 按 out.length 分配 key），
// 内联指标的 key 于是被换掉了，而映射当时只在 expandSavedMetrics 内部用完就丢。
//
// 所以这里钉的是**下发这张映射**（renamedKeys：图表配置里的 key → 响应里的最终 key）这条契约，
// 两条数据出口都要有：
//   1) 非 SQL 数据集（query-engine 的 return，line ~220）
//   2) SQL 数据集（query-engine 的 SQL 分支，line ~114）——sql-data-provider 需要真实数据源，
//      离线跑不了，故替掉 provider.query，只钉住 query-engine 这一层「把 renamedKeys 挂上响应」。
//
// 刻意不钉重编号结果（m0/m1 谁是谁）：那已被 task31b 一整组用例钉死了，是独立行为。
// 这里钉的是「无论重编号成什么样，前端都能通过 renamedKeys 找回自己的那一列」。
process.env.DB_PATH = `/tmp/kanban-test-renamed-keys-${process.pid}.db`;
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb, adminId } = require('./helpers/db');
const { uuidv7 } = require('../src/utils/uuidv7');
const datasetService = require('../src/services/dataset.service');
const queryEngine = require('../src/engines/query-engine');
const sqlDataProvider = require('../src/datasources/sql-data-provider');
const lib = require('../src/services/metrics-library.service');

let dsId;
let mAvg;

/** 模拟前端 metricRenderKey：库指标走 savedKeys，其余走 renamedKeys，都没有才退回配置里的 key */
function renderKey(m, res) {
  if (m.type === 'saved') {
    const k = res.savedKeys?.[m.metricId];
    if (k) return k;
  }
  return res.renamedKeys?.[m.key] || m.key || m.field;
}

before(async () => {
  await resetDb();
  const ds = await datasetService.createDataset(
    'renamed-keys-mixed',
    [
      { key: 'name', label: '名称', type: 'string' },
      { key: 'rate', label: '负荷率', type: 'number' },
    ],
    [
      { name: 'r1', rate: 76.99 },
      { name: 'r2', rate: 10.01 },
    ],
    null
  );
  dsId = ds.id;
  mAvg = await lib.createMetric(dsId, { name: '库负荷率', kind: 'base', definition: { field: 'rate', agg: 'avg' } });
});

after(async () => {
  db.close();
});

test('expandSavedMetrics：混合图表下发 renamedKeys，内联指标能找回被重编号的列', async () => {
  // 复刻线上那条请求：库指标配置 key 恰是 m1，内联指标是 m2。
  // 重编号后库指标占 m0、内联被改成 m1——与库指标原来自己的 m1 撞号，纯属巧合。
  const res = await lib.expandSavedMetrics(dsId, [
    { type: 'saved', key: 'm1', metricId: mAvg.id },
    { type: 'base', key: 'm2', field: 'rate', agg: 'avg' },
  ]);

  assert.deepEqual(Object.keys(res).sort(), ['metrics', 'renamedKeys', 'savedKeys'].sort(),
    `返回形状应固定为 { metrics, savedKeys, renamedKeys }，实际: ${Object.keys(res)}`);
  assert.deepEqual(res.renamedKeys, { m1: 'm0', m2: 'm1' },
    `renamedKeys 应是「配置 key → 最终 key」，实际: ${JSON.stringify(res.renamedKeys)}`);
  // 重编号本身没被动过
  assert.deepEqual(res.metrics.map((m) => m.key), ['m0', 'm1']);
  assert.equal(res.savedKeys[mAvg.id], 'm0', 'savedKeys 仍是 metricId → 根 key');
  // 前端按 renamedKeys 解析：内联指标落到 m1，不是配置里的 m2
  const inline = res.metrics[1];
  assert.equal(renderKey({ type: 'base', key: 'm2', field: 'rate', agg: 'avg' }, res), 'm1');
  assert.equal(inline.field, 'rate');
});

test('expandSavedMetrics：无库指标时 renamedKeys 为空（未重编号，前端退回配置 key）', async () => {
  const metrics = [{ type: 'base', key: 'm0', field: 'rate', agg: 'avg' }];
  const res = await lib.expandSavedMetrics(dsId, metrics);
  assert.equal(res.metrics, metrics, '无库指标时 metrics 应原样返回');
  assert.deepEqual(res.savedKeys, {});
  assert.deepEqual(res.renamedKeys, {}, '无库指标时无需重编号，renamedKeys 应为空（不是恒等映射）');
  assert.equal(renderKey(metrics[0], res), 'm0', 'renamedKeys 为空时前端退回 m.key，行为不变');
});

test('expandSavedMetrics：库指标 + 内联 derived 也能通过 renamedKeys 找回 ref 目标', async () => {
  const res = await lib.expandSavedMetrics(dsId, [
    { type: 'saved', key: 'm1', metricId: mAvg.id },
    { type: 'derived', key: 'm2', kind: 'share', ref: 'm1' },
  ]);
  // 内联 derived 的 ref 已被重写成最终 key（这靠内部那张表），前端取它的渲染 key 也靠同一张表
  assert.equal(res.metrics[1].ref, 'm0');
  assert.equal(res.renamedKeys.m2, 'm1');
  assert.equal(renderKey({ type: 'derived', key: 'm2', ref: 'm1' }, res), 'm1');
});

test('非 SQL 数据集：混合图表响应带 renamedKeys，内联列能取到值', async () => {
  const request = [
    { type: 'saved', key: 'm1', metricId: mAvg.id },
    { type: 'base', key: 'm2', field: 'rate', agg: 'avg' },
  ];
  const res = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: request,
  });

  assert.deepEqual(res.renamedKeys, { m1: 'm0', m2: 'm1' }, `响应应带 renamedKeys，实际: ${JSON.stringify(res.renamedKeys)}`);

  const row = res.rows.find((r) => r.name === 'r1');
  for (const m of request) {
    const k = renderKey(m, res);
    assert.ok(row[`metric:${k}`],
      `指标 ${m.key} 解析到 ${k}，但响应行里没有 metric:${k}：${JSON.stringify(Object.keys(row))}`);
  }
  // 内联列不是空壳：真的有值（历史上就是这里渲染成 '-'）
  assert.equal(row[`metric:${renderKey(request[1], res)}`].value, 76.99);
});

test('非 SQL 数据集：纯内联图表不产 renamedKeys（响应形状不变）', async () => {
  const res = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [{ type: 'base', key: 'm0', field: 'rate', agg: 'avg' }],
  });
  assert.equal(res.savedKeys, undefined, '纯内联不应产生 savedKeys');
  assert.equal(res.renamedKeys, undefined, '纯内联不应产生 renamedKeys（没有重编号可映射）');
  assert.equal(res.rows[0]['metric:m0'].value > 0, true);
});

test('SQL 数据集：query-engine 的 SQL 分支同样把 renamedKeys 挂上响应', async () => {
  const dsIdSql = uuidv7();
  db.prepare("INSERT INTO data_sources (id, name, type, config, owner_id) VALUES (?, ?, ?, ?, ?)")
    .run(dsIdSql, 'Test PG', 'postgres', '{"host":"127.0.0.1","port":15432}', adminId());
  const sqlDs = await datasetService.registerSqlDataset(
    'sql-mixed', dsIdSql, 'testdb', 'load',
    [{ name: 'name', label: 'Name', type: 'string' }, { name: 'rate', label: 'Rate', type: 'number' }],
    adminId()
  );
  assert.equal(sqlDs.source_type, 'sql');
  // 库指标按 datasetId 归属，SQL 数据集得有自己的一个
  const mSql = await lib.createMetric(sqlDs.id, { name: '库负荷率SQL', kind: 'base', definition: { field: 'rate', agg: 'avg' } });

  // provider 需要真实连接；这里只替换它，钉的是 query-engine 这一层「拿到展开结果后挂上 renamedKeys」
  const orig = sqlDataProvider.query;
  sqlDataProvider.query = async (ds, query) => ({ dimensions: [], metrics: query.metrics, rows: [] });
  let res;
  try {
    res = await queryEngine.aggregate({
      datasetId: sqlDs.id,
      dimensions: [{ field: 'name' }],
      metrics: [
        { type: 'saved', key: 'm1', metricId: mSql.id },
        { type: 'base', key: 'm2', field: 'rate', agg: 'avg' },
      ],
    });
  } finally {
    sqlDataProvider.query = orig;
  }

  assert.deepEqual(res.renamedKeys, { m1: 'm0', m2: 'm1' },
    `SQL 分支也应带 renamedKeys，实际: ${JSON.stringify(res.renamedKeys)}`);
  assert.equal(res.savedKeys[mSql.id], 'm0', 'SQL 分支同样保留 savedKeys');
});
