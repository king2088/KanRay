// 首行设置 DB_PATH
process.env.DB_PATH = `/tmp/kanban-test-http5-${process.pid}.db`;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, resetDb } = require('./helpers/db');
const authService = require('../src/services/auth.service');
const rbac = require('../src/services/rbac.service');
const { seed } = require('../src/seeds');

let server; let base;

test('启动临时 HTTP 服务', async () => {
  await resetDb();
  const app = require('../src/app');
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
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

// ---- 构造一个最小可用的 .xlsx（内联字符串 + 数值），read-excel-file 可读取 ----
const zlib = require('node:zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function zipFiles(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, data] of Object.entries(files)) {
    const buf = Buffer.from(data);
    const crc = crc32(buf);
    const compressed = zlib.deflateRawSync(buf, { level: 6 });
    const nameBuf = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18); lh.writeUInt32LE(buf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    chunks.push(lh, nameBuf, compressed);
    const cch = Buffer.alloc(46);
    cch.writeUInt32LE(0x02014b50, 0); cch.writeUInt16LE(20, 4); cch.writeUInt16LE(20, 6);
    cch.writeUInt16LE(0, 8); cch.writeUInt16LE(8, 10); cch.writeUInt16LE(dosTime, 12);
    cch.writeUInt16LE(dosDate, 14); cch.writeUInt32LE(crc, 16); cch.writeUInt32LE(compressed.length, 20);
    cch.writeUInt32LE(buf.length, 24); cch.writeUInt16LE(nameBuf.length, 28); cch.writeUInt16LE(0, 30);
    cch.writeUInt16LE(0, 32); cch.writeUInt16LE(0, 34); cch.writeUInt16LE(0, 36); cch.writeUInt32LE(0, 38);
    cch.writeUInt32LE(offset, 42);
    central.push(cch, nameBuf);
    offset += lh.length + nameBuf.length + compressed.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, ...central, eocd]);
}

function makeXlsx() {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>amount</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>A</t></is></c><c r="B2"><v>10</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>B</t></is></c><c r="B3"><v>20</v></c></row>
</sheetData></worksheet>`;
  return zipFiles({
    'xl/workbook.xml': workbook,
    'xl/_rels/workbook.xml.rels': rels,
    'xl/worksheets/sheet1.xml': sheet,
  });
}

// 真实数据集创建入口：POST /api/datasets（multipart 上传 file 字段）
async function createDatasetViaApi(name, token) {
  const form = new FormData();
  form.append('name', name);
  form.append('file', new Blob([makeXlsx()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'data.xlsx');
  const res = await fetch(base + '/api/datasets', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function setRole(userId, code) {
  const role = db.prepare('SELECT id FROM roles WHERE code = ?').get(code);
  db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
  db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, role.id);
}

let ownerId; let datasetIdA; let chartIdA; let dashboardIdA; let dashboardIdB;

test('未登录访问数据集列表 → 401', async () => {
  const r = await api('/api/datasets', { method: 'GET' });
  assert.equal(r.status, 401);
});

test('viewer 列表只见自己资源（此时为空）', async () => {
  const t = await api('/api/auth/register', { body: { email: 'v5@x.com', password: 'Password123!', name: 'V5' } });
  assert.equal(t.status, 200);
  const at = await login('v5@x.com', 'Password123!');
  const r = await api('/api/datasets', { method: 'GET', token: at });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.length, 0);
});

test('viewer 建数据集 → 403；analyst 上传创建成功且 owner_id 落库', async () => {
  const vat = await login('v5@x.com', 'Password123!');
  const denied = await api('/api/datasets', { method: 'POST', token: vat, body: { name: 'x', original_file: 'x' } });
  assert.equal(denied.status, 403, JSON.stringify(denied.json));

  const ownerUser = await api('/api/auth/register', { body: { email: 'ed5@x.com', password: 'Password123!', name: 'Ed' } });
  assert.equal(ownerUser.status, 200);
  ownerId = ownerUser.json.data.id;
  setRole(ownerId, 'analyst');

  const eat = await login('ed5@x.com', 'Password123!');
  const created = await createDatasetViaApi('销量数据', eat);
  assert.equal(created.status, 200, JSON.stringify(created.json));
  datasetIdA = created.json.data.id;
  assert.ok(datasetIdA > 0);
  const row = db.prepare('SELECT owner_id FROM datasets WHERE id = ?').get(datasetIdA);
  assert.equal(row.owner_id, ownerId);
});

test('owner 通过真实接口创建图表与看板', async () => {
  const at = await login('ed5@x.com', 'Password123!');
  const chart = await api('/api/charts', {
    method: 'POST', token: at,
    body: {
      name: '销量柱状图', chartType: 'bar', datasetId: datasetIdA,
      config: { metrics: [{ field: 'amount', agg: 'sum' }], dimensions: [{ field: 'name' }], filters: [] },
    },
  });
  assert.equal(chart.status, 200, JSON.stringify(chart.json));
  chartIdA = chart.json.data.id;
  const cRow = db.prepare('SELECT owner_id FROM charts WHERE id = ?').get(chartIdA);
  assert.equal(cRow.owner_id, ownerId);

  const dash = await api('/api/dashboards', { method: 'POST', token: at, body: { name: 'A的看板' } });
  assert.equal(dash.status, 200, JSON.stringify(dash.json));
  dashboardIdA = dash.json.data.id;
  const dRow = db.prepare('SELECT owner_id FROM dashboards WHERE id = ?').get(dashboardIdA);
  assert.equal(dRow.owner_id, ownerId);
});

test('跨用户访问他人资源 → 403（B 为编辑者，有权限但非 owner）', async () => {
  const bUser = await api('/api/auth/register', { body: { email: 'b5@x.com', password: 'Password123!', name: 'B' } });
  assert.equal(bUser.status, 200);
  setRole(bUser.json.data.id, 'editor');
  const bat = await login('b5@x.com', 'Password123!');
  assert.ok(bat);

  const chartGet = await api(`/api/charts/${chartIdA}`, { method: 'GET', token: bat });
  assert.equal(chartGet.status, 403, JSON.stringify(chartGet.json));

  const chartData = await api(`/api/charts/${chartIdA}/data`, { method: 'POST', token: bat, body: {} });
  assert.equal(chartData.status, 403, JSON.stringify(chartData.json));

  const rows = await api(`/api/datasets/${datasetIdA}/rows`, { method: 'GET', token: bat });
  assert.equal(rows.status, 403, JSON.stringify(rows.json));

  const query = await api(`/api/datasets/${datasetIdA}/query`, { method: 'POST', token: bat, body: {} });
  assert.equal(query.status, 403, JSON.stringify(query.json));

  const patch = await api(`/api/dashboards/${dashboardIdA}`, { method: 'PATCH', token: bat, body: { name: '改名' } });
  assert.equal(patch.status, 403, JSON.stringify(patch.json));

  const del = await api(`/api/dashboards/${dashboardIdA}`, { method: 'DELETE', token: bat });
  assert.equal(del.status, 403, JSON.stringify(del.json));
});

test('管理员可读他人资源（isAdmin 放行）', async () => {
  const at = await login('admin@kanray.local', 'admin123');
  assert.ok(at);
  const chart = await api(`/api/charts/${chartIdA}`, { method: 'GET', token: at });
  assert.equal(chart.status, 200, JSON.stringify(chart.json));
  const ds = await api(`/api/datasets/${datasetIdA}`, { method: 'GET', token: at });
  assert.equal(ds.status, 200, JSON.stringify(ds.json));
  const dash = await api(`/api/dashboards/${dashboardIdA}`, { method: 'GET', token: at });
  assert.equal(dash.status, 200, JSON.stringify(dash.json));
});

test('列表按 owner 过滤（路由 scoping）：各自只见自己的资源，管理员全量', async () => {
  const aat = await login('ed5@x.com', 'Password123!');
  const bat = await login('b5@x.com', 'Password123!');

  const dashA = await api('/api/dashboards', { method: 'GET', token: aat });
  assert.equal(dashA.status, 200);
  assert.ok(dashA.json.data.some((x) => x.id === dashboardIdA));

  const created = await api('/api/dashboards', { method: 'POST', token: bat, body: { name: 'B的看板' } });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  dashboardIdB = created.json.data.id;

  const dashB = await api('/api/dashboards', { method: 'GET', token: bat });
  assert.equal(dashB.status, 200);
  assert.ok(dashB.json.data.some((x) => x.id === dashboardIdB));
  assert.ok(!dashB.json.data.some((x) => x.id === dashboardIdA));

  const chartsA = await api('/api/charts', { method: 'GET', token: aat });
  assert.ok(chartsA.json.data.some((x) => x.id === chartIdA));
  const chartsB = await api('/api/charts', { method: 'GET', token: bat });
  assert.ok(!chartsB.json.data.some((x) => x.id === chartIdA));

  const adminAt = await login('admin@kanray.local', 'admin123');
  const all = await api('/api/dashboards', { method: 'GET', token: adminAt });
  assert.equal(all.status, 200);
  assert.ok(all.json.data.some((x) => x.id === dashboardIdA) && all.json.data.some((x) => x.id === dashboardIdB));
});

test('C1 回归：B 无法用 A 的数据集创建图表', async () => {
  const bat = await login('b5@x.com', 'Password123!');
  const r = await api('/api/charts', {
    method: 'POST', token: bat,
    body: {
      name: '越权图表', chartType: 'bar', datasetId: datasetIdA,
      config: { metrics: [{ field: 'amount', agg: 'sum' }], dimensions: [{ field: 'name' }], filters: [] },
    },
  });
  assert.equal(r.status, 403, JSON.stringify(r.json));
});

test('C1 回归：遗留图表引用外部数据集时，B 读取与 /data 均被拒', async () => {
  const bUser = db.prepare("SELECT id FROM users WHERE email = 'b5@x.com'").get();
  const info = db.prepare('INSERT INTO charts (name, dataset_id, chart_type, config, owner_id) VALUES (?, ?, ?, ?, ?)')
    .run('遗留图表', datasetIdA, 'bar', JSON.stringify({ metrics: [{ field: 'amount', agg: 'sum' }], dimensions: [{ field: 'name' }], filters: [] }), bUser.id);
  const leakId = Number(info.lastInsertRowid);
  const bat = await login('b5@x.com', 'Password123!');

  const g = await api(`/api/charts/${leakId}`, { method: 'GET', token: bat });
  assert.equal(g.status, 403, JSON.stringify(g.json));

  const d = await api(`/api/charts/${leakId}/data`, { method: 'POST', token: bat, body: {} });
  assert.equal(d.status, 403, JSON.stringify(d.json));
});

test('I2 回归：账号被禁用后旧令牌立即失效（401/403）', async () => {
  const cRes = await api('/api/auth/register', { body: { email: 'c5@x.com', password: 'Password123!', name: 'C' } });
  assert.equal(cRes.status, 200);
  const cid = cRes.json.data.id;
  const cat = await login('c5@x.com', 'Password123!');
  assert.ok(cat);
  await rbac.setUserActive(cid, false);
  const r = await api('/api/dashboards', { method: 'GET', token: cat });
  assert.ok([401, 403].includes(r.status), `status=${r.status} ${JSON.stringify(r.json)}`);
  assert.equal(r.json.code, r.status);
});

test('I3 回归：仅有 dashboard:read 的角色访问数据集列表 → 403', async () => {
  await rbac.createRole('dashview', '仅看板', ['dashboard:read']);
  const dRes = await api('/api/auth/register', { body: { email: 'd5@x.com', password: 'Password123!', name: 'D' } });
  assert.equal(dRes.status, 200);
  setRole(dRes.json.data.id, 'dashview');
  const dat = await login('d5@x.com', 'Password123!');
  const r = await api('/api/datasets', { method: 'GET', token: dat });
  assert.equal(r.status, 403, JSON.stringify(r.json));
  assert.match(r.json.message, /dataset:read/);
});

test('I4 回归：自定义 user:read+role:read 角色不再有管理员越权视野', async () => {
  await rbac.createRole('mgmt', '用户与角色管理', ['user:read', 'role:read', 'dashboard:read']);
  const fRes = await api('/api/auth/register', { body: { email: 'f5@x.com', password: 'Password123!', name: 'F' } });
  assert.equal(fRes.status, 200);
  setRole(fRes.json.data.id, 'mgmt');
  const fat = await login('f5@x.com', 'Password123!');
  const r = await api('/api/dashboards', { method: 'GET', token: fat });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(!r.json.data.some((x) => x.id === dashboardIdA), '不应看到他人看板');
});

test('关闭临时 HTTP 服务', () => { server?.close(); });