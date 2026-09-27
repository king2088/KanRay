// 指标库小数位（decimals）跨层契约：
//   1) 5 个方言的基表 DDL 都要预埋 metrics.decimals，且默认值都是 0
//   2) schema.js 的 needCols 兜底既有旧库（真 sqlite 跑一遍，验证既有行回填为 0）
//   3) service 层行为：缺省 0、0-10 整数校验、create 落库、update 局部更新保留原值
//   4) 透传：emitRef → normalizeMetrics → 响应 mapper 三段都不许把 decimals 弄丢，
//      且内联（非指标库）指标不得凭空多出 decimals
//
// 本文件不设 DB_PATH：第 3 条要连真库，而 ./helpers/db 在 require 时就会把
// process.env.DB_PATH 覆写成 /tmp/kanban-test-<pid>.db，先设也没用（task29/31 那批
// 首行 DB_PATH 同理是死代码，这里不跟着抄）。
//
// decimals 的 HTTP 往返（POST/PUT 带上它不能被 .strict() 当未知键拒掉）在
// task31b-metrics-library-edge.test.js —— 本文件刻意不引 src/app.js，
// 免得为一个契约测试把 swagger-ui-express/限流/整份 schema 初始化都拖进来。
// 图表配置那条路（内联指标不许带 decimals）同样要真路由，放在
// metric-inline-decimals.test.js。
//
// 「响应投影全仓只有一份」是架构约束而非 decimals 的字段契约，独立在
// metric-response-projection.test.js（那里才有 src/ 的源码走查）。
//
// 第 1 条断的是「require 后的模块输出」而不是源码文本，所以 DDL 重排版/改缩进不该误伤；
// 一旦失败就说明列定义真的变了（列被删、类型/默认值、或 DEFAULT 与 NOT NULL 的语序被改）。
//
// CREATE 与 ALTER 的语序故意不对称：needCols 对所有方言统一发 `INTEGER NOT NULL DEFAULT 0`
// （Oracle 的 ALTER TABLE ADD 语法宽松，合法），而 Oracle 的 CREATE TABLE 内联列定义要求
// `DEFAULT 0 NOT NULL`（见 oracle.js 其余 68 列）。别顺手把两边统一成一种写法。
//
// 为什么不复用 task45：task45 跑的是真 sqlite（只覆盖 sqlite 方言），
// 这里的第 1 条是源码契约——mysql/postgres/mssql/oracle 没有 live 实例可跑，
// 但列漏预埋会在生产建库时才炸，必须在 CI 就拦住。
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../src/db/index');
const { ensureSchema } = require('../src/db/schema');
const { db, resetDb } = require('./helpers/db');
const datasetService = require('../src/services/dataset.service');
const lib = require('../src/services/metrics-library.service');
const queryEngine = require('../src/engines/query-engine');
const { normalizeMetrics, projectMetrics } = require('../src/engines/metrics');

const DIALECTS = ['sqlite', 'mysql', 'postgres', 'mssql', 'oracle'];
const DDL_DIR = path.join(__dirname, '..', 'src', 'db', 'ddl');

let dsId;

// Oracle 的 CREATE TABLE 内联列定义要求 DEFAULT 在 NOT NULL 之前；
// 其余方言统一写 NOT NULL DEFAULT 0。
const COLUMN_DEF = {
  oracle: /^decimals INTEGER DEFAULT 0 NOT NULL,?$/,
  default: /^decimals INTEGER NOT NULL DEFAULT 0,?$/,
};

test('5 个方言的 metrics 基表 DDL 都预埋 decimals 且默认 0', () => {
  for (const d of DIALECTS) {
    // 直接取模块导出的 SQL 数组里那条建表语句，不依赖源码缩进。
    // 早先按 /\n {2}\)/ 定位收尾右括号：metrics 段一旦被重排成 4 空格缩进，正则会越过收尾
    // 括号吞掉 CREATE INDEX 甚至整个 charts 表，而 charts 里也有一行 decimals，
    // 于是缺列的 postgres.js 反倒报 PASS。
    const ddl = require(path.join(DDL_DIR, `${d}.js`));
    const stmt = ddl.find((s) => /^CREATE TABLE(?: IF NOT EXISTS)? metrics \(/.test(s));
    assert.ok(stmt, `${d}.js 的 DDL 数组里没有 metrics 建表语句`);
    const body = stmt
      .replace(/^CREATE TABLE(?: IF NOT EXISTS)? metrics \(/, '')
      .replace(/\)$/, '');

    const decLine = body.split('\n').map((l) => l.trim()).find((l) => /^decimals\b/.test(l));
    assert.ok(decLine, `${d}.js 的 metrics DDL 缺少 decimals 列，实际: ${body.replace(/\s+/g, ' ')}`);

    // 末尾 ,? ：decimals 是列清单中间的一列，行尾带逗号
    const def = COLUMN_DEF[d] || COLUMN_DEF.default;
    assert.match(decLine.replace(/\s+/g, ' '), def,
      `${d}.js 的 decimals 列定义应为 ${def.source}，实际: ${decLine}`);
  }
});

test('ensureSchema 为既有 metrics 库补齐 decimals 列，旧行回填 0 且幂等', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbmig-dec-'));
  const store = createStore({ type: 'sqlite', sqlitePath: path.join(dir, 'legacy-metrics.db') });

  // 先建全量 schema 拿到 datasets（metrics 的外键目标），再把 metrics 换成 decimals 上线前的旧形态
  ensureSchema(store);
  store.exec('DROP TABLE metrics');
  store.exec(`CREATE TABLE metrics (
    id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, kind TEXT NOT NULL, definition TEXT NOT NULL DEFAULT '',
    owner_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  store.run('INSERT INTO datasets (id, name, original_file, table_name) VALUES (?, ?, ?, ?)',
    ['ds-1', '旧数据集', 'old.xlsx', 'ds_1']);
  store.run('INSERT INTO metrics (id, dataset_id, name, kind, definition, owner_id) VALUES (?, ?, ?, ?, ?, NULL)',
    ['m-1', 'ds-1', '旧指标', 'base', JSON.stringify({ field: 'qty', agg: 'sum' })]);

  // 被测的一步：走 needCols 兜底路径给旧库补列
  ensureSchema(store);

  const cols = store.all('PRAGMA table_info(metrics)').map((c) => c.name);
  assert.ok(cols.includes('decimals'), `旧库应补齐 decimals 列，实际列: ${cols.join(',')}`);
  const row = store.all('SELECT decimals FROM metrics WHERE id = ?', ['m-1'])[0];
  assert.equal(row.decimals, 0, '既有 metrics 行的 decimals 应回填为 0');

  // 幂等：重复 ensureSchema 不报错、不产生重复列
  ensureSchema(store);
  const again = store.all('PRAGMA table_info(metrics)').filter((c) => c.name === 'decimals');
  assert.equal(again.length, 1, '不应重复加列');
  store.close();
});

// ---- service 层行为（decimals 是「怎么显示」，与 definition「怎么算」无关）----

before(async () => {
  await resetDb();
  const ds = await datasetService.createDataset(
    'metric-decimals-fixture',
    [
      { key: 'name', label: '名称', type: 'string' },
      { key: 'rate', label: '负荷率', type: 'number' },
    ],
    [
      { name: 'a', rate: 76.989306 },
      { name: 'b', rate: 90 },
    ],
    null,
  );
  dsId = ds.id;
});

test('createMetric：decimals 缺省为 0', async () => {
  const m = await lib.createMetric(dsId, {
    name: '负荷率', kind: 'base', definition: { field: 'rate', agg: 'avg' },
  });
  assert.equal(m.decimals, 0);
});

test('createMetric：decimals 显式落库并可更新', async () => {
  const m = await lib.createMetric(dsId, {
    name: '负荷率2位', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 2,
  });
  assert.equal(m.decimals, 2);
  const upd = await lib.updateMetric(dsId, m.id, { decimals: 4 });
  assert.equal(upd.decimals, 4);
  assert.equal(upd.name, '负荷率2位', '只改 decimals 不应动 name');
  assert.deepEqual(upd.definition, { field: 'rate', agg: 'avg' }, '只改 decimals 不应动 definition');
});

test('createMetric/updateMetric：decimals 必须是 0-10 的整数', async () => {
  const base = { kind: 'base', definition: { field: 'rate', agg: 'avg' } };
  for (const bad of [-1, 11, 1.5, 'abc', NaN]) {
    await assert.rejects(
      () => lib.createMetric(dsId, { ...base, name: '非法', decimals: bad }),
      /小数位/,
      `createMetric decimals=${bad} 应被拒绝`,
    );
    // 走真实 update 路径（create 那条已由上面覆盖）：updateMetric 自己也调
    // normalizeMetricDecimals，把这里换成裸 Number(decimals) 不会被任何用例抓到
    const victim = await lib.createMetric(dsId, { ...base, name: `待改-${bad}`, decimals: 3 });
    await assert.rejects(
      () => lib.updateMetric(dsId, victim.id, { decimals: bad }),
      /小数位/,
      `updateMetric decimals=${bad} 应被拒绝`,
    );
    // 拒绝发生在写库之前：不能 clamp 后照写、也不能先写再抛
    assert.equal((await lib.getMetricRecord(dsId, victim.id)).decimals, 3,
      `updateMetric 拒绝 decimals=${bad} 后不应改动原值`);
  }
  const m = await lib.createMetric(dsId, { ...base, name: '边界0', decimals: 0 });
  const m10 = await lib.createMetric(dsId, { ...base, name: '边界10', decimals: 10 });
  assert.equal(m.decimals, 0);
  assert.equal(m10.decimals, 10);
});

test('createMetric：转不出数字的脏值也报 400（Number() 对它们抛裸 TypeError）', async () => {
  // Symbol() / Object.create(null) 走 Number() 会 throw，不是返回 NaN。
  // 不接住就是裸 TypeError 冒到 errorHandler，落成 500「服务器内部错误」还打一坨栈。
  // 这两个值 HTTP 侧进不来（zod z.number() 先拒），但 service 是模块，别的调用方能直接传。
  for (const bad of [Symbol('x'), Object.create(null)]) {
    await assert.rejects(
      () => lib.createMetric(dsId, {
        kind: 'base', definition: { field: 'rate', agg: 'avg' }, name: `脏值-${typeof bad}`, decimals: bad,
      }),
      (e) => e.status === 400 && /小数位/.test(e.message),
      `${typeof bad} 应被转成 400，而不是裸 TypeError`,
    );
  }
});

test('updateMetric：decimals 缺省时保留原值', async () => {
  const m = await lib.createMetric(dsId, { name: '保留', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 3 });
  const upd = await lib.updateMetric(dsId, m.id, { name: '改名了' });
  assert.equal(upd.decimals, 3, '不传 decimals 时应保留原值而不是重置为 0');
});

test('updateMetric：越界脏值让更新响亮地 400，而不是被静默固化', async () => {
  const m = await lib.createMetric(dsId, { name: '脏行', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 2 });
  // 模拟被直接 SQL 写坏的行：正常写入路径已被 zod + service 双重拦住，这里只能手动制造
  await db.prepare('UPDATE metrics SET decimals = ? WHERE id = ?').run(999, m.id);

  // parseRow 只判整数不判范围，读出来仍是 999。updateMetric 若直接沿用 rec.decimals，
  // 就会把越界值原样写回——一次异常从此永久固化并在后续每次更新中自我复制。
  await assert.rejects(
    () => lib.updateMetric(dsId, m.id, { name: '改名试试' }),
    /小数位/,
    '越界脏值应让更新 400，而不是把 999 原样固化',
  );
  // 拒绝发生在写库之前：既没改 name，也没有把脏值夹成合法值（夹取会洗掉篡改证据）
  const rec = await lib.getMetricRecord(dsId, m.id);
  assert.equal(rec.name, '脏行', '拒绝后不应改动 name');
  assert.equal(rec.decimals, 999, '拒绝后脏值应原样保留，便于发现数据被改过');
});

// ---- 透传：decimals 要活到 /api/charts/:id/data 的响应里 ----
//
// 这里刻意分两组断言：service 的 expandSavedMetrics 一组、真实 query-engine.aggregate 一组。
// 只测前者会「绿得很漂亮但功能是死的」——decimals 在下游还有两处会把它丢掉：
//   normalizeMetrics 用字面量重建每个指标（不 spread 原始输入，漏列的字段直接消失），
//   query-engine 响应 mapper 又按显式白名单重新映射了一遍 metrics[]。
// 第二组断言断的正是这两处。

test('emitRef：base/expr/derived 三种 def 都带 decimals，且不破坏原有字段', async () => {
  const b = await lib.createMetric(dsId, { name: '基数', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 1 });
  const e = await lib.createMetric(dsId, { name: '倍数', kind: 'expr', definition: { expr: `$${b.id} * 2` }, decimals: 2 });
  const d = await lib.createMetric(dsId, { name: '占比', kind: 'derived', definition: { derivative: 'share', refId: e.id }, decimals: 3 });

  // 只挂根（derived）指标：依赖项由 emitRef 递归带出
  const { metrics, savedKeys } = await lib.expandSavedMetrics(dsId, [{ type: 'saved', metricId: d.id }]);

  // emitRef 产出的 def 上没有 id（只有 label=指标名 + 重编号 key），故按 label 定位
  const byLabel = new Map(metrics.map((m) => [m.label, m]));
  assert.equal(byLabel.get('基数').decimals, 1, 'base 应带 decimals');
  assert.equal(byLabel.get('倍数').decimals, 2, 'expr 应带 decimals');
  assert.equal(byLabel.get('占比').decimals, 3, 'derived 应带 decimals');

  // 追加字段不得顺手改坏既有字段
  assert.equal(byLabel.get('基数').type, 'base');
  assert.equal(byLabel.get('基数').field, 'rate');
  assert.equal(byLabel.get('基数').agg, 'avg');
  assert.equal(byLabel.get('倍数').type, 'expr');
  assert.equal(byLabel.get('倍数').expr, `$${byLabel.get('基数').key} * 2`, 'expr 里的 $指标ID 应被改写成展开后的 m<key>');
  assert.equal(byLabel.get('占比').type, 'derived');
  assert.equal(byLabel.get('占比').kind, 'share', 'derived 分支沿用 kind 承载衍生类型，别改成 derivedKind');
  assert.equal(byLabel.get('占比').ref, byLabel.get('倍数').key, 'derived 应引用展开后的复合指标 key');

  assert.equal(savedKeys[d.id], byLabel.get('占比').key, 'savedKeys 应记录根指标对应的最终 key');
  assert.deepEqual(Object.keys(savedKeys), [d.id], 'savedKeys 只记根指标，被递归带出的依赖不进表');
});

test('query-engine：走真实 aggregate 时响应里的指标定义带 decimals 与 savedKeys', async () => {
  const b = await lib.createMetric(dsId, { name: '看板基数', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 2 });
  const e = await lib.createMetric(dsId, { name: '看板倍数', kind: 'expr', definition: { expr: `$${b.id} * 2` }, decimals: 4 });
  const d = await lib.createMetric(dsId, { name: '看板占比', kind: 'derived', definition: { derivative: 'share', refId: e.id }, decimals: 5 });

  const res = await queryEngine.aggregate({
    datasetId: dsId,
    // derived 需要至少一个维度（normalizeMetrics 会对 dimensionCount===0 报 400）
    dimensions: [{ field: 'name' }],
    metrics: [
      { type: 'saved', metricId: b.id },
      { type: 'saved', metricId: e.id },
      { type: 'saved', metricId: d.id },
    ],
  });

  const byLabel = new Map(res.metrics.map((m) => [m.label, m]));
  assert.equal(byLabel.get('看板基数').decimals, 2, '响应里的 base 指标应带 decimals');
  assert.equal(byLabel.get('看板倍数').decimals, 4, '响应里的 expr 指标应带 decimals');
  assert.equal(byLabel.get('看板占比').decimals, 5, '响应里的 derived 指标应带 decimals');
  // 既有字段不能被这次改动挤掉
  assert.equal(byLabel.get('看板基数').kind, 'base');
  assert.equal(byLabel.get('看板倍数').kind, 'expr');
  assert.equal(byLabel.get('看板占比').derivedKind, 'share');
  // 只钉「三个库指标各自都记到了最终 key」：具体编号由 emitRef 的重排顺序决定，
  // 跟 decimals 没关系（savedKeys 的形状已由上面那条覆盖），把 m0/m1/m2 钉死等于
  // 把「重编号」这个独立行为也焊进 decimals 的回归网。
  assert.equal(Object.keys(res.savedKeys).length, 3, 'savedKeys 应记下这三个库指标');
  for (const id of [b.id, e.id, d.id]) {
    assert.ok(res.savedKeys[id], `savedKeys 应含 ${id} 对应的最终 key，实际: ${JSON.stringify(res.savedKeys)}`);
  }
});

test('query-engine：内联（非指标库）指标不带 decimals，别被当成库指标', async () => {
  // 反向风险：若响应层对缺失的 decimals 无脑补 0，前端就会把内联指标也按 0 位小数渲染
  // （等于给所有内联图表换上取整显示），而前端正是靠「有没有这个键」区分两类指标的。
  const res = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [{ key: 'm0', field: 'rate', agg: 'avg', label: '内联负荷率' }],
  });

  assert.equal(res.savedKeys, undefined, '内联指标不应产生 savedKeys');
  assert.ok(!('decimals' in res.metrics[0]),
    `内联指标不应凭空带 decimals，实际: ${JSON.stringify(res.metrics[0])}`);
  assert.equal(res.metrics[0].label, '内联负荷率', '内联指标照常工作');
  assert.equal(res.rows.length, 2);
});

test('normalizeMetrics：fieldsByName 为 null 的那条 base 分支也透传 decimals', () => {
  // 上一条 aggregate 断言走的是带 fieldsByName 的分支；SQL 数据集那条分支
  // （normalizeMetrics 被以 fieldsByName: null 调用）同样被改了，就不能不留断言：
  // 逐个分支去掉透传实测过，四个分支里只有它当时是「删了也没人发现」的那一个。
  const dialect = { agg: { sum: 'SUM', avg: 'AVG', count: 'COUNT', count_distinct: 'COUNT(DISTINCT', max: 'MAX', min: 'MIN' }, quoteIdent: (x) => `"${x}"` };
  const withDec = normalizeMetrics([{ field: 'rate', agg: 'avg', decimals: 3 }], { dialect, fieldsByName: null });
  assert.equal(withDec[0].decimals, 3, '该分支应透传 decimals');
  assert.equal(withDec[0].sqlExpr, 'AVG("rate")', '该分支的 SQL 构造不受影响');

  // expr / derived 在这条分支上同样透传（它们的分支与 fieldsByName 无关）
  const withKind = normalizeMetrics(
    [
      { key: 'm0', field: 'rate', agg: 'avg', decimals: 1 },
      { key: 'm1', type: 'expr', expr: '$m0 * 2', decimals: 2 },
      { key: 'm2', type: 'derived', kind: 'share', ref: 'm1', decimals: 5 },
    ],
    { dialect, fieldsByName: null, dimensionCount: 1 }
  );
  assert.deepEqual(withKind.map((m) => m.decimals), [1, 2, 5]);

  // 没有 decimals 的输入不产键（而不是补 0）
  const without = normalizeMetrics([{ field: 'rate', agg: 'avg' }], { dialect, fieldsByName: null });
  assert.ok(!('decimals' in without[0]), `无 decimals 时不应产键，实际: ${JSON.stringify(without[0])}`);

  // 同一形状下再过一遍响应投影：SQL 数据集那条路上 provider 自己 normalize 再投影，
  // 所以「内联不产键、库指标照常带」必须在这条形状上也成立。provider 的两处调用点
  // 只有连了真库才跑得到（属那 18 个 skipped），这段就是可离线验的那一半。
  assert.ok(!('decimals' in projectMetrics(without)[0]),
    `SQL 形状的内联指标过投影后也不该产 decimals，实际: ${JSON.stringify(projectMetrics(without)[0])}`);
  assert.equal(projectMetrics(withKind)[0].decimals, 1, 'SQL 形状的库指标过投影后应带上 decimals');
  assert.equal(projectMetrics(withKind)[1].decimals, 2, 'SQL 形状的复合指标过投影后应带上 decimals');
  assert.equal(projectMetrics(withKind)[2].decimals, 5, 'SQL 形状的衍生指标过投影后应带上 decimals');
});

test('被 SQL 改坏的越界 decimals 到不了响应里（真 aggregate 全链路）', async () => {
  // 脏值防线要断在最后一公里：库里 decimals=999 的行，经 emitRef → normalizeMetrics →
  // 投影之后，响应里应当「没有这个键」（退回前端默认格式），而不是把 999 当成渲染精度。
  const m = await lib.createMetric(dsId, { name: '脏值库指标', kind: 'base', definition: { field: 'rate', agg: 'avg' }, decimals: 2 });
  await db.prepare('UPDATE metrics SET decimals = ? WHERE id = ?').run(999, m.id);
  assert.equal((await lib.getMetricRecord(dsId, m.id)).decimals, 999, '前置：脏值确实写进库了');

  const res = await queryEngine.aggregate({
    datasetId: dsId,
    dimensions: [{ field: 'name' }],
    metrics: [{ type: 'saved', metricId: m.id }],
  });
  assert.ok(!('decimals' in res.metrics[0]),
    `越界脏值不应下发到响应，实际: ${JSON.stringify(res.metrics[0])}`);
  assert.equal(res.metrics[0].label, '脏值库指标', '其余字段照常');
  assert.equal(res.rows.length, 2, '取值本身不受影响（decimals 只管显示）');
});

test('projectMetrics：无 decimals 时键集合与旧投影完全一致', () => {
  // 只断言键集合，不断言键序：JSON 键序无语义，为可读性重排不是回归，钉死会变成假回归。
  // 键名与「多产键」仍是契约（既有测试和前端都按这几个键读）。
  const keysOf = (o) => Object.keys(o).sort();
  assert.deepEqual(keysOf(projectMetrics([{ key: 'm0', kind: 'base', field: 'm0', agg: 'avg', label: '负荷率(avg)' }])[0]),
    ['agg', 'field', 'key', 'kind', 'label']);
  assert.deepEqual(keysOf(projectMetrics([{ key: 'm1', kind: 'expr', field: 'm1', agg: 'expr', expr: '$m0*2', label: '倍数' }])[0]),
    ['agg', 'expr', 'field', 'key', 'kind', 'label']);
  assert.deepEqual(keysOf(projectMetrics([{ key: 'm2', kind: 'derived', field: 'm2', agg: 'share', derivedKind: 'share', ref: 'm1', label: '占比' }])[0]),
    ['agg', 'derivedKind', 'field', 'key', 'kind', 'label', 'ref']);

  // 带 decimals 的两种形状（base / derived）同样只钉键集合
  assert.deepEqual(keysOf(projectMetrics([{ key: 'm0', kind: 'base', field: 'm0', agg: 'avg', label: 'L', decimals: 2 }])[0]),
    ['agg', 'decimals', 'field', 'key', 'kind', 'label']);
  assert.deepEqual(keysOf(projectMetrics([{ key: 'm1', kind: 'derived', field: 'm1', agg: 'share', derivedKind: 'share', ref: 'm0', label: 'L', decimals: 2 }])[0]),
    ['agg', 'decimals', 'derivedKind', 'field', 'key', 'kind', 'label', 'ref']);

  // 内部字段（sqlExpr/alias）不得漏进响应
  const out = projectMetrics([{ key: 'm0', kind: 'base', field: 'm0', agg: 'avg', label: 'L', sqlExpr: 'AVG("x")', alias: '_m0' }])[0];
  assert.ok(!('sqlExpr' in out) && !('alias' in out), `内部字段不该下发，实际: ${JSON.stringify(out)}`);
  assert.deepEqual(projectMetrics([]), [], '空输入返回空数组');
  assert.deepEqual(projectMetrics(undefined), [], 'undefined 输入不抛');
});

test('projectMetrics 作为导出边界：直接喂脏值也不产键（生产路径走不到这里）', () => {
  // 这条是导出边界上的兜底，不是「生产链路的脏值防线」——真正的关卡是 normalizeMetrics：
  // 生产三个调用点（query-engine 一处、sql-data-provider 两处）传进来的都是它的产物，
  // 早就过滤过一遍，所以下面这张表在生产里一个值都拦不到。它钉的是「万一将来多一个
  // 不经 normalizeMetrics 的调用方，别把脏值当渲染精度发出去」。
  //
  // 也别把它读成「库指标的任何脏值都不下发」：库指标行的类型脏值在 metrics-library.service
  // 的 parseRow 就被 Number() 归一了（'3'→3、'abc'→0），那两种照样下发；库指标实际能
  // 被挡下的只有越界值（999 / -1），那条已由上面「真 aggregate 全链路」那条覆盖。
  const mk = (decimals) => {
    const m = { key: 'm0', kind: 'base', field: 'm0', agg: 'avg', label: 'L' };
    if (decimals !== 'ABSENT') m.decimals = decimals;
    return projectMetrics([m])[0];
  };
  for (const n of [0, 2, 10]) {
    assert.equal(mk(n).decimals, n, `decimals=${n} 应原样下发`);
  }
  // decimals=0 必须真的产出这个键：前端要用 `'decimals' in m` 区分库/内联指标，
  // 补 0 之外的「键是否存在」本身是契约的一部分。
  assert.ok('decimals' in mk(0), '库指标的 decimals=0 也要下发，否则前端无法与内联指标区分');

  // 脏值不能变成一个假的渲染精度：越界/非整数一律不产键（而不是原样透传）
  for (const bad of [null, undefined, NaN, '3', 'abc', 999, -1, 1.5, Infinity, true, {}]) {
    assert.ok(!('decimals' in mk(bad)),
      `脏值 decimals=${JSON.stringify(bad)} 不应下发，实际: ${JSON.stringify(mk(bad))}`);
  }
  assert.ok(!('decimals' in mk('ABSENT')), '缺省时不应产键');
});
