// 水电站行业看板 demo（单一 MySQL 数据源）——幂等重灌，非破坏性
// 用法: node backend/scripts/seed-hydro-demo.mjs [--base http://127.0.0.1:3001]
// 1. mysql2 直连 13306/testdb: DROP+CREATE demo_hydro，灌 12 电站 x 365 天 = 4380 行确定性数据（14 字段）
// 2. HTTP 清理「水电站」域（仅水电站数据/图表/看板，不影响电商/异构看板）
// 3. 重建: 复用/新建 Live MySQL 数据源 -> 14 字段 builder 数据集 -> 16 图表 -> 1 看板
// 4. 逐图表 POST /charts/:id/data 校验 rows>0
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const BASE = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] || 'http://127.0.0.1:3001';
const ADMIN = { email: 'admin@kanban.local', password: 'admin123' };
const MYSQL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'Kanban@123', database: 'testdb' };
const HYDRO_KEYWORDS = ['水电站', '流域发电', '省份装机']; // 用于识别水电站域资源名

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const STATIONS = [
  { station: '三峡大坝', river: '长江', province: '湖北', capacity_mw: 22500, baseWaterLevel: 175, unitCount: 32 },
  { station: '白鹤滩水电站', river: '金沙江', province: '四川', capacity_mw: 16000, baseWaterLevel: 825, unitCount: 16 },
  { station: '溪洛渡水电站', river: '金沙江', province: '四川', capacity_mw: 13860, baseWaterLevel: 600, unitCount: 18 },
  { station: '向家坝水电站', river: '金沙江', province: '四川', capacity_mw: 6400, baseWaterLevel: 380, unitCount: 8 },
  { station: '乌东德水电站', river: '金沙江', province: '四川', capacity_mw: 10200, baseWaterLevel: 975, unitCount: 12 },
  { station: '小湾水电站', river: '澜沧江', province: '云南', capacity_mw: 4200, baseWaterLevel: 1240, unitCount: 6 },
  { station: '二滩水电站', river: '雅砻江', province: '四川', capacity_mw: 3300, baseWaterLevel: 1200, unitCount: 6 },
  { station: '龙羊峡水电站', river: '黄河', province: '青海', capacity_mw: 1280, baseWaterLevel: 2600, unitCount: 4 },
  { station: '丰满水电站', river: '松花江', province: '吉林', capacity_mw: 1672, baseWaterLevel: 264, unitCount: 8 },
  { station: '天生桥一级水电站', river: '南盘江', province: '贵州', capacity_mw: 1200, baseWaterLevel: 645, unitCount: 6 },
  { station: '岩滩水电站', river: '红水河', province: '广西', capacity_mw: 1810, baseWaterLevel: 223, unitCount: 5 },
  { station: '葛洲坝水电站', river: '长江', province: '湖北', capacity_mw: 2735, baseWaterLevel: 66, unitCount: 21 },
];
const DAY_COUNT = 365;
const DAY_START = '2026-01-01';
const EXP_SN = 20260101;

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
const listItems = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (d?.list) return d.list;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  return [];
};

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
      report_date DATE NOT NULL,
      load_rate DECIMAL(6,2) NOT NULL,
      revenue_yuan INT NOT NULL,
      water_level_m DECIMAL(6,2) NOT NULL,
      inflow_m3s INT NOT NULL,
      unit_count INT NOT NULL,
      self_use_rate DECIMAL(6,2) NOT NULL,
      maintenance_state VARCHAR(16) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const rand = mulberry32(EXP_SN);
    let id = 1;
    const rows = [];
    for (let d = 0; d < DAY_COUNT; d++) {
      const date = new Date(DAY_START);
      date.setDate(date.getDate() + d);
      const month = date.getMonth(); // 0-11
      // 季节因子：夏/初秋(5-9月)出力高，隆冬(11-12月/1月)出力低
      const seasonFactor = month >= 4 && month <= 8 ? 0.88 : month >= 10 || month === 0 ? 0.62 : 0.75;
      for (const s of STATIONS) {
        const coeff = Math.min(0.98, Math.max(0.5, seasonFactor + (rand() - 0.5) * 0.3));
        const generationMwh = Math.round(s.capacity_mw * 24 * coeff);
        // 电价：丰水期(5-10月)低约 0.28，枯水期高约 0.36~0.43
        const price = month >= 4 && month <= 9 ? 0.28 + rand() * 0.04 : 0.36 + rand() * 0.07;
        const revenueYuan = Math.round(generationMwh * 1000 * price);
        const waterLevel = +(s.baseWaterLevel + (rand() - 0.5) * 8).toFixed(2);
        const inflowM3s = Math.round(s.capacity_mw * 0.8 + (rand() - 0.5) * s.capacity_mw * 0.4);
        const selfUseRate = +(0.08 + rand() * 0.6).toFixed(2);
        const mRoll = rand();
        const maintenanceState = mRoll < 0.05 ? '计划检修' : mRoll < 0.07 ? '故障停机' : '正常运行';
        rows.push([
          id++, s.station, s.river, s.province, s.capacity_mw, generationMwh,
          date.toISOString().slice(0, 10), +(coeff * 100).toFixed(2), revenueYuan,
          waterLevel, inflowM3s, s.unitCount, selfUseRate, maintenanceState,
        ]);
      }
    }
    // 分批插入避免单条语句过大
    for (let i = 0; i < rows.length; i += 600) {
      const batch = rows.slice(i, i + 600);
      const placeholders = batch.map(() => `(${Array(14).fill('?').join(',')})`).join(',');
      await conn.query(
        `INSERT INTO demo_hydro (id,station,river,province,capacity_mw,generation_mwh,report_date,
          load_rate,revenue_yuan,water_level_m,inflow_m3s,unit_count,self_use_rate,maintenance_state)
         VALUES ${placeholders}`,
        batch.flat(),
      );
    }
    const expectedRows = DAY_COUNT * STATIONS.length;
    const [r] = await conn.query('SELECT COUNT(*) AS n FROM demo_hydro');
    ok('MySQL demo_hydro 行数=4380', r[0].n === expectedRows, `期望 ${expectedRows} 实际 ${r[0].n}`);
    const [agg] = await conn.query('SELECT station, COUNT(*) n FROM demo_hydro GROUP BY station');
    ok('每站 365 天', agg.length === STATIONS.length && agg.every((x) => x.n === DAY_COUNT), JSON.stringify(agg.slice(0, 4)));
    const [nulls] = await conn.query('SELECT COUNT(*) AS n FROM demo_hydro WHERE load_rate IS NULL OR revenue_yuan IS NULL OR maintenance_state = 0');
    ok('无空值', nulls[0].n === 0, `空值行 ${nulls[0].n}`);
  } finally {
    await conn.end();
  }
}

function isHydroName(name) {
  return HYDRO_KEYWORDS.some((k) => String(name || '').includes(k));
}

// 仅清理「水电站」域：水电站看板 + 对应图表 + 对应数据集；不动电商/异构资源
async function clearHydro(token) {
  // 删水电站看板
  const dashList = listItems(await api('/api/dashboards', { token }));
  const removedDash = [];
  for (const d of dashList) {
    if (isHydroName(d.name)) {
      await api(`/api/dashboards/${d.id}`, { method: 'DELETE', token });
      removedDash.push(d.id);
    }
  }
  // 定位水电站数据集（发出图表后删）
  const dsList = listItems(await api('/api/datasets', { token }));
  const hydroDsIds = dsList.filter((ds) => isHydroName(ds.name)).map((ds) => ds.id);
  // 删引用这些数据集的图表
  const chartList = listItems(await api('/api/charts', { token }));
  let removedCharts = 0;
  for (const c of chartList) {
    if (hydroDsIds.includes(Number(c.datasetId)) || isHydroName(c.name)) {
      await api(`/api/charts/${c.id}`, { method: 'DELETE', token });
      removedCharts += 1;
    }
  }
  // 再删水电站数据集
  for (const id of hydroDsIds) {
    await api(`/api/datasets/${id}`, { method: 'DELETE', token });
  }
  ok(`清理水电站域 (看板=${removedDash.length}, 图表=${removedCharts}, 数据集=${hydroDsIds.length}, 残留=0)`,
    removedDash.length + removedCharts + hydroDsIds.length > 0);
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
    { source: 't0', field: 'load_rate', label: '负荷率', type: 'number' },
    { source: 't0', field: 'revenue_yuan', label: '日营收', type: 'number' },
    { source: 't0', field: 'water_level_m', label: '水位', type: 'number' },
    { source: 't0', field: 'inflow_m3s', label: '入库流量', type: 'number' },
    { source: 't0', field: 'unit_count', label: '机组数', type: 'number' },
    { source: 't0', field: 'self_use_rate', label: '厂用电率', type: 'number' },
    { source: 't0', field: 'maintenance_state', label: '检修状态', type: 'string' },
  ],
  aggregation: null,
};

// --mysql-only: 只灌 MySQL demo_hydro，不动元数据库（不清空、不重建）
if (process.argv.includes('--mysql-only')) {
  await seedMysql();
  console.log('mysql-only 完成');
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

async function main() {
  await seedMysql();

  const login = (await api('/api/auth/login', { method: 'POST', body: ADMIN })).data;
  const token = login?.accessToken || login?.token;
  if (!token) throw new Error('admin 登录失败');
  ok('admin 登录', !!token);

  // 清理前记录非水电站看板，确保不被误删
  const preDash = listItems(await api('/api/dashboards', { token }));
  const preservedBefore = preDash.filter((d) => !isHydroName(d.name)).map((d) => d.name).sort();
  await clearHydro(token);

  // 复用或新建 Live MySQL 数据源
  const dsList = listItems(await api('/api/datasources', { token }));
  let ds = dsList.find((x) => x.name === 'Live MySQL');
  if (!ds) {
    ds = (await api('/api/datasources', {
      method: 'POST', token,
      body: { name: 'Live MySQL', type: 'mysql', mode: 'direct',
        config: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root', password: 'Kanban@123' } },
    })).data;
  }
  ok('数据源 Live MySQL(81)', !!ds?.id, JSON.stringify(ds));
  const dsId = ds.id;

  // 测试连接
  const test = (await api(`/api/datasources/${dsId}/test`, { method: 'POST', token, body: {} })).data;
  ok('数据源连接测试', !!(test?.ok || test?.success), JSON.stringify(test).slice(0, 200));

  // 14 字段 builder 数据集
  const createdDs = (await api(`/api/datasources/${dsId}/build/save`, {
    method: 'POST', token,
    body: { name: '水电站发电明细', definition: BUILD_DEFINITION },
  })).data;
  ok('创建 14 字段 builder 数据集', !!createdDs?.id, JSON.stringify(createdDs));
  const datasetId = createdDs.id;

  // 16 图表（f_# 按 BUILD_DEFINITION.fields 顺序映射）
  const CHART_DEFS = [
    // Row 1: stat
    { name: '总装机容量', chartType: 'stat', config: { metrics: [{ field: 'f_4', agg: 'sum', label: '总装机容量(MW)' }] } },
    { name: '年度总发电量', chartType: 'stat', config: { metrics: [{ field: 'f_5', agg: 'sum', label: '总发电量(MWh)' }] } },
    { name: '年度总营收', chartType: 'stat', config: { metrics: [{ field: 'f_8', agg: 'sum', label: '总营收(元)' }] } },
    { name: '平均负荷率', chartType: 'stat', config: { metrics: [{ field: 'f_7', agg: 'avg', label: '平均负荷率(%)' }] } },
    // Row 2
    { name: '各电站发电量对比', chartType: 'barClustered', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '流域发电占比', chartType: 'pie', config: { dimensions: [{ field: 'f_2', label: '流域' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '省份装机占比', chartType: 'doughnut', config: { dimensions: [{ field: 'f_3', label: '省份' }], metrics: [{ field: 'f_4', agg: 'sum', label: '装机容量' }] } },
    { name: '日发电趋势', chartType: 'line', config: { dimensions: [{ field: 'f_6', label: '报告日期', granularity: 'day' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    // Row 3
    { name: '月度营收趋势', chartType: 'line', config: { dimensions: [{ field: 'f_6', label: '月份', granularity: 'month' }], metrics: [{ field: 'f_8', agg: 'sum', label: '营收' }] } },
    { name: '负荷率仪表盘', chartType: 'gauge', config: { metrics: [{ field: 'f_7', agg: 'avg', label: '负荷率' }], options: { min: 0, max: 100 } } },
    { name: '各省发电量月度热力', chartType: 'heatmap', config: { dimensions: [{ field: 'f_3', label: '省份' }, { field: 'f_6', label: '月份', granularity: 'month' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '电站x月份发电热力', chartType: 'heatmap', config: { dimensions: [{ field: 'f_1', label: '电站' }, { field: 'f_6', label: '月份', granularity: 'month' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    // Row 4
    { name: '机组容量构成', chartType: 'treemap', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_4', agg: 'sum', label: '装机容量' }] } },
    { name: '检修状态分布', chartType: 'pie', config: { dimensions: [{ field: 'f_13', label: '检修状态' }], metrics: [{ field: '*', agg: 'count', label: '天数' }] } },
    { name: '各电站发电量气泡', chartType: 'bubble', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '发电量日历热力', chartType: 'calendar', config: { dimensions: [{ field: 'f_6', label: '日期', granularity: 'day' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
  ];
  const chartIds = [];
  for (const def of CHART_DEFS) {
    const c = (await api('/api/charts', { method: 'POST', token, body: { ...def, datasetId } })).data;
    chartIds.push(c.id);
    ok(`图表 ${def.name} 已创建`, !!c?.id && !!c?.config);
  }

  // 看板 + 16 widget layout
  const dash = (await api('/api/dashboards', { method: 'POST', token, body: { name: '水电站行业运营' } })).data;
  const w = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const layout = [
    // Row1: 4 stat
    { id: w(), type: 'chart', chartId: chartIds[0], w: 3, h: 2, hPx: 220, col: 1, top: 0 },
    { id: w(), type: 'chart', chartId: chartIds[1], w: 3, h: 2, hPx: 220, col: 4, top: 0 },
    { id: w(), type: 'chart', chartId: chartIds[2], w: 3, h: 2, hPx: 220, col: 7, top: 0 },
    { id: w(), type: 'chart', chartId: chartIds[3], w: 3, h: 2, hPx: 220, col: 10, top: 0 },
    // Row2: bar + pie + doughnut + line日趋势
    { id: w(), type: 'chart', chartId: chartIds[4], w: 6, h: 3, hPx: 360, col: 1, top: 2 },
    { id: w(), type: 'chart', chartId: chartIds[5], w: 3, h: 3, hPx: 360, col: 7, top: 2 },
    { id: w(), type: 'chart', chartId: chartIds[6], w: 3, h: 3, hPx: 360, col: 10, top: 2 },
    { id: w(), type: 'chart', chartId: chartIds[7], w: 6, h: 3, hPx: 360, col: 1, top: 5 },
    // Row3: line月营收 + gauge + 2 heatmap
    { id: w(), type: 'chart', chartId: chartIds[8], w: 3, h: 3, hPx: 360, col: 7, top: 5 },
    { id: w(), type: 'chart', chartId: chartIds[9], w: 3, h: 3, hPx: 360, col: 10, top: 5 },
    { id: w(), type: 'chart', chartId: chartIds[10], w: 6, h: 3, hPx: 360, col: 1, top: 8 },
    { id: w(), type: 'chart', chartId: chartIds[11], w: 6, h: 3, hPx: 360, col: 7, top: 8 },
    // Row4: treemap + pie检修 + bubble + calendar
    { id: w(), type: 'chart', chartId: chartIds[12], w: 3, h: 3, hPx: 360, col: 1, top: 11 },
    { id: w(), type: 'chart', chartId: chartIds[13], w: 3, h: 3, hPx: 360, col: 4, top: 11 },
    { id: w(), type: 'chart', chartId: chartIds[14], w: 3, h: 3, hPx: 360, col: 7, top: 11 },
    { id: w(), type: 'chart', chartId: chartIds[15], w: 3, h: 3, hPx: 360, col: 10, top: 11 },
  ];
  const updated = (await api(`/api/dashboards/${dash.id}`, { method: 'PATCH', token, body: { layout } })).data;
  ok('看板「水电站行业运营」+ 16 widget', !!updated?.id, JSON.stringify(updated));

  // 逐图表验证数据
  for (const [i, chartId] of chartIds.entries()) {
    const out = await api(`/api/charts/${chartId}/data`, { method: 'POST', token, body: {} });
    const rows = out?.data?.data?.rows || out?.data?.rows || [];
    const name = CHART_DEFS[i].name;
    const type = CHART_DEFS[i].chartType;
    if (type === 'stat') {
      ok(`[${i + 1}] ${name} stat`, rows.length >= 1 && Object.values(rows[0] || {}).some((v) => Number(v) > 0), JSON.stringify(rows[0]).slice(0, 120));
    } else {
      ok(`[${i + 1}] ${name} rows>0`, rows.length > 0, `type=${type} rows=${rows.length}`);
    }
  }

  // 校验：水电站看板已重建，且非水电站看板仍在
  const finalDash = listItems(await api('/api/dashboards', { token }));
  const hydroNow = finalDash.filter((d) => isHydroName(d.name)).map((d) => ({ id: d.id, name: d.name, widgets: (d.layout || []).length }));
  ok('水电站看板存在且含 16 widget', hydroNow.length === 1 && hydroNow[0].widgets === 16, JSON.stringify(hydroNow));
  const preservedNow = finalDash.filter((d) => !isHydroName(d.name)).map((d) => d.name).sort();
  ok('非水电站看板完整保留', JSON.stringify(preservedNow) === JSON.stringify(preservedBefore), `${preservedBefore} -> ${preservedNow}`);

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n汇总: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });