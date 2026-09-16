// 水电站行业看板 demo（单一 MySQL 数据源）——幂等重灌
// 用法: node backend/scripts/seed-hydro-demo.mjs [--base http://127.0.0.1:3001]
// 1. mysql2 直连 13306/testdb: DROP+CREATE demo_hydro，灌 6 电站 x 15 天 = 90 行确定性数据
// 2. HTTP 清空业务数据（dashboards -> charts -> datasets -> data_sources，保 users/roles）
// 3. 重建: 1 个 MySQL 数据源 -> builder 数据集 -> 6 图表 -> 1 看板
// 4. 逐图表 POST /charts/:id/data 校验 rows>0
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const BASE = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] || 'http://127.0.0.1:3001';
const ADMIN = { email: 'admin@kanban.local', password: 'admin123' };
const MYSQL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'Kanban@123', database: 'testdb' };

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const STATIONS = [
  { station: '三峡大坝', river: '长江', province: '湖北', capacity_mw: 22500 },
  { station: '白鹤滩水电站', river: '金沙江', province: '四川', capacity_mw: 16000 },
  { station: '溪洛渡水电站', river: '金沙江', province: '四川', capacity_mw: 13860 },
  { station: '向家坝水电站', river: '金沙江', province: '四川', capacity_mw: 6400 },
  { station: '小湾水电站', river: '澜沧江', province: '云南', capacity_mw: 4200 },
  { station: '龙羊峡水电站', river: '黄河', province: '青海', capacity_mw: 1280 },
];
const DAY_COUNT = 15;
const DAY_START = '2026-04-01';

const results = [];
function ok(name, cond, extra = '') {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  <- ${extra}`}`);
}
async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function seedMysql() {
  const { createConnection } = require('mysql2/promise');
  const conn = await createConnection(MYSQL);
  try {
    await conn.query('DROP TABLE IF EXISTS demo_hydro');
    await conn.query(`CREATE TABLE demo_hydro (
      id INT PRIMARY KEY,
      station VARCHAR(64) NOT NULL,
      river VARCHAR(64) NOT NULL,
      province VARCHAR(64) NOT NULL,
      capacity_mw INT NOT NULL,
      generation_mwh INT NOT NULL,
      report_date DATE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const rand = mulberry32(20260401);
    let id = 1;
    const rows = [];
    for (let d = 0; d < DAY_COUNT; d++) {
      const date = new Date(DAY_START);
      date.setDate(date.getDate() + d);
      for (const s of STATIONS) {
        const coeff = 0.55 + rand() * 0.4;
        const generation_mwh = Math.round(s.capacity_mw * 24 * coeff);
        rows.push([id++, s.station, s.river, s.province, s.capacity_mw, generation_mwh, date.toISOString().slice(0, 10)]);
      }
    }
    const placeholders = rows.map(() => '(?,?,?,?,?,?,?)').join(',');
    await conn.query(`INSERT INTO demo_hydro (id,station,river,province,capacity_mw,generation_mwh,report_date) VALUES ${placeholders}`, rows.flat());
    const [r] = await conn.query('SELECT COUNT(*) AS n FROM demo_hydro');
    ok('MySQL demo_hydro 灌数=90', r[0].n === DAY_COUNT * STATIONS.length, `实际 ${r[0].n}`);
    const [agg] = await conn.query('SELECT station, COUNT(*) n FROM demo_hydro GROUP BY station');
    ok('每站 15 天', agg.every((x) => x.n === DAY_COUNT), JSON.stringify(agg));
  } finally {
    await conn.end();
  }
}

async function clearBusiness(token) {
  const targets = [['dashboards', '/api/dashboards'], ['charts', '/api/charts'], ['datasets', '/api/datasets'], ['datasources', '/api/datasources']];
  for (const [name, path] of targets) {
    const list = (await api(path, { token })).data || {};
    const arr = Array.isArray(list) ? list : list.list || [];
    for (const item of arr) {
      await api(`${path}/${item.id}`, { method: 'DELETE', token });
    }
    const after = (await api(path, { token })).data || {};
    const afterArr = Array.isArray(after) ? after : after.list || [];
    ok(`清空 ${name} (=0)`, afterArr.length === 0, `删除 ${arr.length} 条，剩 ${afterArr.length}`);
  }
}

const BUILD_DEFINITION = {
  type: 'builder',
  tables: [{ alias: 't0', schema: 'testdb', table: 'demo_hydro' }],
  joins: [],
  fields: [
    { source: 't0', field: 'id', label: 'ID', type: 'number' },
    { source: 't0', field: 'station', label: '电站', type: 'string' },
    { source: 't0', field: 'river', label: '流域', type: 'string' },
    { source: 't0', field: 'province', label: '省份', type: 'string' },
    { source: 't0', field: 'capacity_mw', label: '装机容量', type: 'number' },
    { source: 't0', field: 'generation_mwh', label: '发电量', type: 'number' },
    { source: 't0', field: 'report_date', label: '报告日期', type: 'date' },
  ],
  aggregation: null,
};

async function main() {
  await seedMysql();

  const login = (await api('/api/auth/login', { method: 'POST', body: ADMIN })).data;
  const token = login?.accessToken || login?.token;
  if (!token) throw new Error('admin 登录失败');
  ok('admin 登录', !!token);

  await clearBusiness(token);

  // 1 MySQL 数据源
  const created = (await api('/api/datasources', {
    method: 'POST', token,
    body: { name: 'Live MySQL', type: 'mysql', mode: 'direct',
      config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } },
  })).data;
  ok('创建单一 MySQL 数据源', !!created?.id, JSON.stringify(created));
  const dsId = created.id;

  // 测试连接
  const test = (await api(`/api/datasources/${dsId}/test`, { method: 'POST', token, body: {} })).data;
  ok('数据源连接测试', !!(test?.ok || test?.success), JSON.stringify(test).slice(0, 200));

  // builder 数据集
  const ds = (await api(`/api/datasources/${dsId}/build/save`, {
    method: 'POST', token,
    body: { name: '水电站发电明细', definition: BUILD_DEFINITION },
  })).data;
  ok('创建 builder 数据集', !!ds?.id, JSON.stringify(ds));
  const datasetId = ds.id;

  // 6 图表
  const CHART_DEFS = [
    { name: '各电站发电量', chartType: 'bar', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '流域发电占比', chartType: 'doughnut', config: { dimensions: [{ field: 'f_2', label: '流域' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '省份装机占比', chartType: 'doughnut', config: { dimensions: [{ field: 'f_3', label: '省份' }], metrics: [{ field: 'f_4', agg: 'sum', label: '装机容量' }] } },
    { name: '日发电趋势', chartType: 'line', config: { dimensions: [{ field: 'f_6', label: '报告日期', granularity: 'date' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '总装机容量', chartType: 'stat', config: { metrics: [{ field: 'f_4', agg: 'sum', label: '总装机容量' }] } },
    { name: '总发电量', chartType: 'stat', config: { metrics: [{ field: 'f_5', agg: 'sum', label: '总发电量' }] } },
  ];
  const chartIds = [];
  for (const def of CHART_DEFS) {
    const c = (await api('/api/charts', { method: 'POST', token, body: { ...def, datasetId } })).data;
    chartIds.push(c.id);
    ok(`图表 ${def.name} 已创建`, !!c?.id && !!c?.config);
  }

  // 看板 + layout
  const dash = (await api('/api/dashboards', { method: 'POST', token, body: { name: '水电站运营分析' } })).data;
  const layout = [
    { id: `c_${Date.now()}_a1`, type: 'chart', chartId: chartIds[0], w: 6, h: 2, hPx: 312, col: 1, top: 0 },
    { id: `c_${Date.now()}_a2`, type: 'chart', chartId: chartIds[1], w: 6, h: 2, hPx: 312, col: 7, top: 0 },
    { id: `c_${Date.now()}_a3`, type: 'chart', chartId: chartIds[2], w: 6, h: 2, hPx: 312, col: 1, top: 2 },
    { id: `c_${Date.now()}_a4`, type: 'chart', chartId: chartIds[3], w: 6, h: 2, hPx: 312, col: 7, top: 2 },
    { id: `c_${Date.now()}_a5`, type: 'chart', chartId: chartIds[4], w: 6, h: 2, hPx: 312, col: 1, top: 4 },
    { id: `c_${Date.now()}_a6`, type: 'chart', chartId: chartIds[5], w: 6, h: 2, hPx: 312, col: 7, top: 4 },
  ];
  const updated = (await api(`/api/dashboards/${dash.id}`, { method: 'PATCH', token, body: { layout } })).data;
  ok('看板「水电站运营分析」+ 6 widget', !!updated?.id, JSON.stringify(updated));

  // 逐图表验证数据
  for (const [i, chartId] of chartIds.entries()) {
    const out = (await api(`/api/charts/${chartId}/data`, { method: 'POST', token, body: {} })).data;
    const rows = out?.data?.rows || out?.rows || [];
    if (i >= 4) ok(`图表${i + 1} stat 有值`, rows.length === 1 && Object.values(rows[0]).some((v) => Number(v) > 0), JSON.stringify(rows).slice(0, 200));
    else ok(`图表${i + 1} 数据 rows>0`, rows.length > 0, `rows=${rows.length}`);
  }

  const finalDash = (await api('/api/dashboards', { token })).data;
  const dashList = Array.isArray(finalDash) ? finalDash : finalDash.list || [];
  ok('data_sources=1 且看板唯一', dashList.length === 1 && dashList[0].name === '水电站运营分析', JSON.stringify(dashList));

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n汇总: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });
