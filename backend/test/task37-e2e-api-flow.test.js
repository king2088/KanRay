// 端到端 API 全流程（原 scripts/integration-test.js 的自动化版本）：
// 回归真实验入 → 数据集 → 聚合/过滤/分页 → 图表 → 看板 → 清理，全程走 HTTP。
// 自主运行：内嵌临时服务 + 种子管理员登录，无需外部后端。
process.env.DB_PATH = `/tmp/kanban-e2e-${process.pid}.db`;
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resetDb } = require('./helpers/db');

let server; let base; let token; let dsId; let chartId; let dashId;

after(async () => {
  if (server) await new Promise((r) => server.close(r));
});

test('启动临时服务并登录管理员', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

  const login = await api('POST', '/api/auth/login', { body: { email: 'admin@kanban.local', password: 'admin123' } });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  token = login.json.data.accessToken;
  assert.ok(token);
});

async function api(method, url, { token: t = token, body, form } = {}) {
  const headers = {};
  if (t) headers.Authorization = `Bearer ${t}`;
  const opts = { method, headers };
  if (form) opts.body = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + url, opts);
  return { status: res.status, json: await res.json().catch(() => null) };
}

function upload(url, filePath, fields = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return api('POST', url, { form: fd });
}

const XLSX = path.join(__dirname, '..', 'test-data', '销售数据.xlsx');

test('1. 真实 xlsx preview 解析列名与行数', async () => {
  const prev = await upload('/api/datasets/preview', XLSX);
  assert.equal(prev.status, 200, JSON.stringify(prev.json));
  const header = prev.json.data.header.map((h) => `${h.key}:${h.type}`).join(', ');
  assert.match(header, /月份/);
  assert.match(header, /销售额/);
  assert.ok(prev.json.data.rowCount > 0);
  assert.ok(prev.json.data.previewRows.length > 0);
});

test('2. 上传创建数据集并出现在列表', async () => {
  const create = await upload('/api/datasets', XLSX, { name: '销售数据' });
  assert.equal(create.status, 200, JSON.stringify(create.json));
  dsId = create.json.data.id;
  assert.ok(dsId > 0);
  assert.ok(create.json.data.table_name);

  const list = await api('GET', '/api/datasets');
  assert.equal(list.status, 200);
  assert.ok(list.json.data.some((d) => d.id === dsId));
});

test('3. 聚合查询：按区域求和 + 过滤华东 + 分页', async () => {
  const q1 = await api('POST', `/api/datasets/${dsId}/query`, { body: {
    dimensions: [{ field: '区域' }],
    metrics: [{ field: '销售额', agg: 'sum' }],
    sortBy: 0, sortOrder: 'desc',
  } });
  assert.equal(q1.status, 200, JSON.stringify(q1.json));
  assert.ok(Array.isArray(q1.json.data.rows) && q1.json.data.rows.length > 0);
  assert.equal(q1.json.data.rows[0]['区域'], '华东', JSON.stringify(q1.json.data.rows));
  assert.equal(q1.json.data.rows[0]['销售额'], 66000);

  const q2 = await api('POST', `/api/datasets/${dsId}/query`, { body: {
    dimensions: [{ field: '月份' }],
    metrics: [{ field: '销售额', agg: 'sum' }],
    filters: [{ field: '区域', op: 'eq', value: '华东' }],
  } });
  assert.equal(q2.status, 200, JSON.stringify(q2.json));
  assert.equal(q2.json.data.rows.length, 4);
  assert.ok(q2.json.data.rows.every((r) => typeof r['月份'] === 'string' && r['月份']));

  const rows = await api('GET', `/api/datasets/${dsId}/rows?page=1&pageSize=5`);
  assert.equal(rows.status, 200, JSON.stringify(rows.json));
  assert.ok(rows.json.data.total > 0);
  assert.equal(rows.json.data.rows.length, 5);
});

test('4. 创建图表并取数（含外部过滤）', async () => {
  const chart = await api('POST', '/api/charts', { body: {
    name: '区域销售额汇总',
    chartType: 'bar',
    datasetId: dsId,
    config: {
      dimensions: [{ field: '区域' }],
      metrics: [{ field: '销售额', agg: 'sum', label: '销售额' }],
      sortBy: 0, sortOrder: 'desc', groupLimit: 10,
      options: { title: '各区域销售额' },
    },
  } });
  assert.equal(chart.status, 200, JSON.stringify(chart.json));
  chartId = chart.json.data.id;

  const cd = await api('POST', `/api/charts/${chartId}/data`, {});
  assert.equal(cd.status, 200, JSON.stringify(cd.json));
  assert.ok(cd.json.data.data.rows.length > 0);

  const cd2 = await api('POST', `/api/charts/${chartId}/data`, {
    filters: [{ field: '区域', op: 'eq', value: '华南' }],
  });
  assert.equal(cd2.status, 200, JSON.stringify(cd2.json));
  assert.ok(cd2.json.data.data.rows.length > 0);

  const listc = await api('GET', '/api/charts');
  assert.ok(listc.json.data.some((c) => c.id === chartId));
});

test('5. 创建看板 → 更新布局 → 详情回读', async () => {
  const dash = await api('POST', '/api/dashboards', { body: { name: '销售概览看板' } });
  assert.equal(dash.status, 200, JSON.stringify(dash.json));
  dashId = dash.json.data.id;

  const layout = [
    { id: 'c1', type: 'chart', chartId, x: 0, y: 0, w: 8, h: 4, title: '各区域销售额' },
    { id: 't1', type: 'text', content: '# 销售数据看板', x: 0, y: 4, w: 8, h: 1 },
  ];
  const upd = await api('PATCH', `/api/dashboards/${dashId}`, { body: { name: '销售概览看板', layout } });
  assert.equal(upd.status, 200, JSON.stringify(upd.json));
  assert.equal(upd.json.data.layout.length, 2);

  const getd = await api('GET', `/api/dashboards/${dashId}`);
  assert.equal(getd.status, 200);
  assert.equal(getd.json.data.name, '销售概览看板');
});

test('6. 清理：删除图表/看板/数据集', async () => {
  const del = await api('DELETE', `/api/charts/${chartId}`);
  assert.equal(del.status, 200);
  const deld = await api('DELETE', `/api/dashboards/${dashId}`);
  assert.equal(deld.status, 200);
  const delds = await api('DELETE', `/api/datasets/${dsId}`);
  assert.equal(delds.status, 200);
});