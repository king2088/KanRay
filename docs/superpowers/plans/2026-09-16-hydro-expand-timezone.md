# 水电站数据扩充 + 时区配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `demo_hydro` from 90 rows to ~4380 rows (12 stations × 365 days × 14 columns), build 16 charts, and add timezone config so all time displays render in Asia/Shanghai (UTC+8).

**Architecture:** Three independent work streams, each self-contained: (A) backend timezone config + public `/api/config` endpoint, (B) frontend `formatDateTime` utility replacing 5 `formatDate` functions, (C) seed script expansion (data + 16 charts). Stream A and B are independent; C depends on neither but is run last against live DB.

**Tech Stack:** Node.js (backend config/routes), Express, Vue 3 + Pinia + `Intl.DateTimeFormat`, mysql2 (seed script), better-sqlite3 (existing).

---

## Task 1: Backend TIMEZONE Config + `/api/config` Endpoint

**Files:**
- Modify: `backend/src/config/index.js:82` (add timezone export)
- Modify: `backend/src/app.js:33` (mount system routes)
- Create: `backend/src/routes/system.routes.js` (GET /api/config)
- Modify: `backend/.env.example` (add TIMEZONE)
- Modify: `backend/README.md` (add TIMEZONE to env table, line ~49)
- Create: `backend/test/config-timezone.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/test/config-timezone.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('config.timezone 默认值为 Asia/Shanghai', () => {
  const original = process.env.TIMEZONE;
  delete process.env.TIMEZONE;
  delete require.cache[require.resolve('../src/config')];
  const config = require('../src/config');
  assert.equal(config.timezone, 'Asia/Shanghai');
  if (original !== undefined) process.env.TIMEZONE = original;
});

test('TIMEZONE env 可覆盖', () => {
  const original = process.env.TIMEZONE;
  process.env.TIMEZONE = 'America/New_York';
  delete require.cache[require.resolve('../src/config')];
  const config = require('../src/config');
  assert.equal(config.timezone, 'America/New_York');
  if (original !== undefined) process.env.TIMEZONE = original;
  else delete process.env.TIMEZONE;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/config-timezone.test.js`
Expected: FAIL — config.timezone is undefined

- [ ] **Step 3: Implement timezone in config/index.js**

At end of `backend/src/config/index.js` module.exports, add `timezone` property:

```js
  timezone: String(process.env.TIMEZONE || 'Asia/Shanghai'),
```

This goes inside the `module.exports = { ... }` block, after the `sync` object, around line 82.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test test/config-timezone.test.js`
Expected: 2 PASS, 0 FAIL

- [ ] **Step 5: Create system.routes.js**

Create `backend/src/routes/system.routes.js`:

```js
const { ok } = require('../middleware/response');
const config = require('../config');

// GET /api/config — 无需登录，返回系统配置
exports.configRouter = (req, res) => {
  ok(res, { timezone: config.timezone }, 'success');
};
```

- [ ] **Step 6: Mount in app.js**

In `backend/src/app.js`, after the existing route mounts (around line 31), add:

```js
const { configRouter } = require('./routes/system.routes');
app.get('/api/config', configRouter);
```

Note: place this *before* `app.use(notFound)` and use `app.get` (not `app.use`) since it's a single route.

- [ ] **Step 7: Verify with manual curl test**

Start server: `cd backend && node src/server.js &`
Then: `curl -s http://127.0.0.1:3001/api/config | python3 -c "import sys,json;print(json.load(sys.stdin)['data'])"`
Expected: `{'timezone': 'Asia/Shanghai'}`

Kill server after test.

- [ ] **Step 8: Update .env.example and README**

Append to `backend/.env.example` before the `# 上传文件大小上限` line:

```
# 时区（默认 Asia/Shanghai），前端按此时区渲染时间显示
# TIMEZONE=Asia/Shanghai
```

In `backend/README.md`, add a row to the env variables table (after the `SYNC_LOCK_TTL_MS` row, around line 49):

```
| `TIMEZONE` | `Asia/Shanghai` | 时区标识符（IANA），前端按此时区渲染时间 |
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/config/index.js backend/src/app.js backend/src/routes/system.routes.js \
        backend/test/config-timezone.test.js backend/.env.example backend/README.md
git commit -m "feat(backend): TIMEZONE config + GET /api/config 公开接口"
```

---

## Task 2: Frontend `formatDateTime` + timezone store

**Files:**
- Create: `front-end/src/utils/datetime.js` (formatDateTime utility)
- Modify: `front-end/src/api/index.js:103` (add configApi)
- Modify: `front-end/src/stores/app.js:6-7,24-27,55-57` (add timezone state + loadConfig action)
- Modify: `front-end/src/main.js` (trigger config load at startup)
- Modify: `front-end/src/views/DashboardList.vue:95-97` (replace formatDate)
- Modify: `front-end/src/views/ChartList.vue:158-160` (replace formatDate)
- Modify: `front-end/src/views/DatasetList.vue:144-146` (replace formatDate)
- Modify: `front-end/src/views/DatasetDetail.vue:131-133` (replace formatDate)
- Modify: `front-end/src/components/dashboard/ChartLibraryPanel.vue:171-173` (replace formatDate)

- [ ] **Step 1: Create datetime utility**

Create `front-end/src/utils/datetime.js`:

```js
/**
 * 将后端存储的裸 UTC 时间字符串按指定时区格式化显示。
 * 后端存储格式为 "YYYY-MM-DD HH:MM:SS"（UTC，无时区标识）。
 * @param {string|null} s - 裸 UTC 时间字符串
 * @param {string} tz - IANA 时区标识符，默认 'Asia/Shanghai'
 * @returns {string} 格式化后的本地时间字符串，无法解析时原样返回
 */
export function formatDateTime(s, tz = 'Asia/Shanghai') {
  if (!s) return '-'
  // 标准化为 ISO 格式（无时区标记），然后补 Z 表示这是 UTC
  const normalized = String(s).includes('T') ? String(s) : String(s).replace(' ', 'T')
  const date = new Date(normalized + 'Z')
  if (Number.isNaN(date.getTime())) return String(s)
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-')
}
```

- [ ] **Step 2: Add configApi to api/index.js**

Append to `front-end/src/api/index.js` (after `buildApi`, around line 103):

```js
export const configApi = {
  get: () => http.get('/config'),
}
```

Note: `http.get` returns `body.data` due to the response interceptor (line 29 of http.js), so the resolved value will be `{ timezone }`.

- [ ] **Step 3: Add timezone to app store + loadConfig action**

In `front-end/src/stores/app.js`:

1. Add import at top:
```js
import { configApi } from '@/api'
```

2. Add `timezone` to DEFAULTS (line 6):
```js
const DEFAULTS = { layout: 'horizontal', collapsed: false, themeMode: 'light', primaryColor: '#409eff', size: 'default', timezone: 'Asia/Shanghai' }
```

3. In `persist()` (around line 31), add timezone to the saved object:
```js
timezone: this.timezone,
```

4. Add new action `loadConfig` (after `applyInitial` action, around line 57):
```js
    async loadConfig() {
      try {
        const cfg = await configApi.get()
        if (cfg?.timezone) this.timezone = cfg.timezone
      } catch (e) { /* 回退默认值，不阻塞渲染 */ }
    },
```

- [ ] **Step 4: Trigger loadConfig at startup in main.js**

In `front-end/src/main.js`, after `useAppStore(pinia).applyInitial()` (line 24), add:

```js
useAppStore(pinia).loadConfig()
```

- [ ] **Step 5: Replace all 5 formatDate functions**

Import formatDateTime + useAppStore in each file, then replace `formatDate(row.xxx)` with `formatDateTime(row.xxx, timezone)`.

**DashboardList.vue** (around line 95):
- Add at top of `<script setup>`:
```js
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'
const appStore = useAppStore()
```
- Replace the function:
```js
// delete the old formatDate function
// replace template usage: formatDate(row.updatedAt) -> formatDateTime(row.updatedAt, appStore.timezone)
```

**ChartList.vue** (around line 158): same pattern.

**DatasetList.vue** (around line 144): same pattern.

**DatasetDetail.vue** (around line 131): same pattern.

**ChartLibraryPanel.vue** (around line 171): same pattern.

For each file, the template change is:
```
- formatDate(row.updatedAt)
+ formatDateTime(row.updatedAt, appStore.timezone)
```
or
```
- formatDate(row.created_at)
+ formatDateTime(row.created_at, appStore.timezone)
```

- [ ] **Step 6: Verify frontend builds**

Run: `cd front-end && npm run build 2>&1 | tail -5`
Expected: no errors, output exits 0.

- [ ] **Step 7: Commit**

```bash
git add front-end/src/utils/datetime.js front-end/src/api/index.js front-end/src/stores/app.js \
        front-end/src/main.js front-end/src/views/DashboardList.vue front-end/src/views/ChartList.vue \
        front-end/src/views/DatasetList.vue front-end/src/views/DatasetDetail.vue \
        front-end/src/components/dashboard/ChartLibraryPanel.vue
git commit -m "feat(frontend): formatDateTime 按配置时区渲染 + /api/config 加载"
```

---

## Task 3: Seed Script — Expand demo_hydro (12 stations × 365 days × 14 columns)

**Files:**
- Modify: `backend/scripts/seed-hydro-demo.mjs` (expand STATIONS, DAY_COUNT, DDL, fields, chart defs)

- [ ] **Step 1: Replace STATIONS array**

In `backend/scripts/seed-hydro-demo.mjs`, replace the STATIONS array (lines 21-28) and DAY_COUNT/DAY_START (lines 29-30) with:

```js
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
const DAY_START = '2025-07-01';
```

- [ ] **Step 2: Replace seedMysql DDL + insert logic**

Replace the entire `seedMysql` function body (lines 51-85) with:

```js
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
      load_rate DECIMAL(5,4) NOT NULL,
      revenue_yuan INT NOT NULL,
      water_level_m DECIMAL(6,2) NOT NULL,
      inflow_m3s INT NOT NULL,
      unit_count INT NOT NULL,
      self_use_rate DECIMAL(5,4) NOT NULL,
      maintenance_state VARCHAR(16) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const rand = mulberry32(20250701);
    let id = 1;
    const rows = [];
    for (let d = 0; d < DAY_COUNT; d++) {
      const date = new Date(DAY_START);
      date.setDate(date.getDate() + d);
      const month = date.getMonth(); // 0-11
      // 季节因子：夏季(5-9)负荷高，冬季(11-1)低
      const seasonFactor = month >= 4 && month <= 8 ? 0.88 : month >= 10 || month <= 0 ? 0.65 : 0.75;
      for (const s of STATIONS) {
        const baseCoeff = seasonFactor + (rand() - 0.5) * 0.3;
        const loadRate = Math.min(0.98, Math.max(0.6, baseCoeff));
        const generationMwh = Math.round(s.capacity_mw * 24 * loadRate);
        // 电价：丰水期(5-10)约 0.28，枯水期约 0.38~0.42
        const price = month >= 4 && month <= 9 ? 0.28 + rand() * 0.04 : 0.36 + rand() * 0.06;
        const revenueYuan = Math.round(generationMwh * 1000 * price);
        const waterLevel = +(s.baseWaterLevel + (rand() - 0.5) * 6).toFixed(2);
        const inflowM3s = Math.round(s.capacity_mw * 0.8 + (rand() - 0.5) * s.capacity_mw * 0.4);
        const selfUseRate = +(0.001 + rand() * 0.007).toFixed(4);
        // 检修状态：约 5%~8% 天数为检修/故障
        const maintenanceRoll = rand();
        const maintenanceState = maintenanceRoll < 0.05 ? '计划检修' : maintenanceRoll < 0.07 ? '故障停机' : '正常运行';
        rows.push([
          id++, s.station, s.river, s.province, s.capacity_mw, generationMwh,
          date.toISOString().slice(0, 10), +loadRate.toFixed(4), revenueYuan,
          waterLevel, inflowM3s, s.unitCount, +selfUseRate.toFixed(4), maintenanceState,
        ]);
      }
    }
    const colCount = 14;
    const placeholders = rows.map(() => `(${Array(colCount).fill('?').join(',')})`).join(',');
    await conn.query(
      `INSERT INTO demo_hydro (id,station,river,province,capacity_mw,generation_mwh,report_date,
        load_rate,revenue_yuan,water_level_m,inflow_m3s,unit_count,self_use_rate,maintenance_state)
       VALUES ${placeholders}`,
      rows.flat(),
    );
    const expectedRows = DAY_COUNT * STATIONS.length;
    const [r] = await conn.query('SELECT COUNT(*) AS n FROM demo_hydro');
    ok('MySQL demo_hydro 行数', r[0].n === expectedRows, `期望 ${expectedRows} 实际 ${r[0].n}`);
    const [agg] = await conn.query('SELECT station, COUNT(*) n FROM demo_hydro GROUP BY station');
    ok('每站 365 天', agg.every((x) => x.n === DAY_COUNT), JSON.stringify(agg.slice(0, 3)));
    const [nulls] = await conn.query('SELECT COUNT(*) AS n FROM demo_hydro WHERE load_rate IS NULL OR revenue_yuan IS NULL');
    ok('无空值', nulls[0].n === 0, `空值行 ${nulls[0].n}`);
  } finally {
    await conn.end();
  }
}
```

- [ ] **Step 3: Update BUILD_DEFINITION to include all 14 fields**

Replace the BUILD_DEFINITION constant (lines 102-116) with:

```js
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
```

- [ ] **Step 4: Update CHART_DEFS to 16 charts**

Replace the CHART_DEFS array (lines 157-164) with:

```js
  const CHART_DEFS = [
    // Row 1: stat 卡 (4 个，每 w=3)
    { name: '总装机容量', chartType: 'stat', config: { metrics: [{ field: 'f_4', agg: 'sum', label: '总装机容量(MW)' }] } },
    { name: '年度总发电量', chartType: 'stat', config: { metrics: [{ field: 'f_5', agg: 'sum', label: '总发电量(MWh)' }] } },
    { name: '年度总营收', chartType: 'stat', config: { metrics: [{ field: 'f_8', agg: 'sum', label: '总营收(元)' }] } },
    { name: '平均负荷率', chartType: 'stat', config: { metrics: [{ field: 'f_7', agg: 'avg', label: '平均负荷率' }] } },
    // Row 2: bar + pie + doughnut + line 日趋势
    { name: '各电站发电量对比', chartType: 'barClustered', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '流域发电占比', chartType: 'pie', config: { dimensions: [{ field: 'f_2', label: '流域' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '省份装机占比', chartType: 'doughnut', config: { dimensions: [{ field: 'f_3', label: '省份' }], metrics: [{ field: 'f_4', agg: 'sum', label: '装机容量' }] } },
    { name: '日发电趋势', chartType: 'line', config: { dimensions: [{ field: 'f_6', label: '报告日期', granularity: 'day' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    // Row 3: line 月营收 + gauge + heatmap 省×月 + heatmap 站×月
    { name: '月度营收趋势', chartType: 'line', config: { dimensions: [{ field: 'f_6', label: '月份', granularity: 'month' }], metrics: [{ field: 'f_8', agg: 'sum', label: '营收' }] } },
    { name: '负荷率仪表盘', chartType: 'gauge', config: { metrics: [{ field: 'f_7', agg: 'avg', label: '负荷率' }], options: { min: 0, max: 100 } } },
    { name: '各省发电量月度热力', chartType: 'heatmap', config: { dimensions: [{ field: 'f_3', label: '省份' }, { field: 'f_6', label: '月份', granularity: 'month' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '电站×月份发电热力', chartType: 'heatmap', config: { dimensions: [{ field: 'f_1', label: '电站' }, { field: 'f_6', label: '月份', granularity: 'month' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
    // Row 4: treemap + pie 检修 + bubble 流量发电 + calendar
    { name: '机组容量构成', chartType: 'treemap', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_4', agg: 'sum', label: '装机容量' }] } },
    { name: '检修状态分布', chartType: 'pie', config: { dimensions: [{ field: 'f_13', label: '检修状态' }], metrics: [{ field: '*', agg: 'count', label: '数量' }] } },
    { name: '流量与发电量气泡', chartType: 'bubble', config: { dimensions: [{ field: 'f_1', label: '电站' }], metrics: [{ field: 'f_10', agg: 'sum', label: '入库流量' }, { field: 'f_5', agg: 'sum', label: '发电量' }] } },
    { name: '发电量日历热力', chartType: 'calendar', config: { dimensions: [{ field: 'f_6', label: '日期', granularity: 'day' }], metrics: [{ field: 'f_5', agg: 'sum', label: '发电量' }] } },
  ];
```

- [ ] **Step 5: Update layout to 16 widgets**

Replace the layout array (lines 174-181) with a 4-row grid:

```js
  const layout = [
    // Row 1: 4 stat cards (w=3 each, h=2)
    { id: `c_${Date.now()}_s1`, type: 'chart', chartId: chartIds[0], w: 3, h: 2, hPx: 200, col: 1, top: 0 },
    { id: `c_${Date.now()}_s2`, type: 'chart', chartId: chartIds[1], w: 3, h: 2, hPx: 200, col: 4, top: 0 },
    { id: `c_${Date.now()}_s3`, type: 'chart', chartId: chartIds[2], w: 3, h: 2, hPx: 200, col: 7, top: 0 },
    { id: `c_${Date.now()}_s4`, type: 'chart', chartId: chartIds[3], w: 3, h: 2, hPx: 200, col: 10, top: 0 },
    // Row 2: bar + pie + doughnut + line (w=6 or w=3)
    { id: `c_${Date.now()}_r1`, type: 'chart', chartId: chartIds[4], w: 6, h: 3, hPx: 360, col: 1, top: 2 },
    { id: `c_${Date.now()}_r2`, type: 'chart', chartId: chartIds[5], w: 3, h: 3, hPx: 360, col: 7, top: 2 },
    { id: `c_${Date.now()}_r3`, type: 'chart', chartId: chartIds[6], w: 3, h: 3, hPx: 360, col: 10, top: 2 },
    { id: `c_${Date.now()}_r4`, type: 'chart', chartId: chartIds[7], w: 6, h: 3, hPx: 360, col: 1, top: 5 },
    // Row 3: line 月营收 + gauge + 2 heatmaps
    { id: `c_${Date.now()}_r5`, type: 'chart', chartId: chartIds[8], w: 6, h: 3, hPx: 360, col: 1, top: 8 },
    { id: `c_${Date.now()}_r6`, type: 'chart', chartId: chartIds[9], w: 3, h: 3, hPx: 360, col: 7, top: 8 },
    { id: `c_${Date.now()}_r7`, type: 'chart', chartId: chartIds[10], w: 3, h: 3, hPx: 360, col: 10, top: 8 },
    { id: `c_${Date.now()}_r8`, type: 'chart', chartId: chartIds[11], w: 6, h: 3, hPx: 360, col: 1, top: 11 },
    // Row 4: treemap + pie 检修 + bubble + calendar
    { id: `c_${Date.now()}_r9`, type: 'chart', chartId: chartIds[12], w: 3, h: 3, hPx: 360, col: 1, top: 14 },
    { id: `c_${Date.now()}_ra`, type: 'chart', chartId: chartIds[13], w: 3, h: 3, hPx: 360, col: 4, top: 14 },
    { id: `c_${Date.now()}_rb`, type: 'chart', chartId: chartIds[14], w: 3, h: 3, hPx: 360, col: 7, top: 14 },
    { id: `c_${Date.now()}_rc`, type: 'chart', chartId: chartIds[15], w: 3, h: 3, hPx: 360, col: 10, top: 14 },
  ];
```

- [ ] **Step 6: Update verification loop to handle all 16 chart types**

Replace the verification loop (lines 186-191) with:

```js
  for (const [i, chartId] of chartIds.entries()) {
    const out = await api(`/api/charts/${chartId}/data`, { method: 'POST', token, body: {} });
    const rows = out?.data?.data?.rows || out?.data?.rows || [];
    const name = CHART_DEFS[i].name;
    const type = CHART_DEFS[i].chartType;
    if (type === 'stat') {
      ok(`[${i + 1}] ${name} stat`, rows.length >= 1 && Object.values(rows[0]).some((v) => Number(v) > 0), JSON.stringify(rows).slice(0, 120));
    } else {
      ok(`[${i + 1}] ${name} rows>0`, rows.length > 0, `type=${type} rows=${rows.length}`);
    }
  }
```

Also update the final dashboard check (line 195) to accept both old and new name:

```js
  ok('dashboard 存在', dashList.some((d) => d.id === dash.id), JSON.stringify(dashList.map((d) => ({ id: d.id, name: d.name }))));
```

- [ ] **Step 7: Commit**

```bash
git add backend/scripts/seed-hydro-demo.mjs
git commit -m "feat(scripts): 水电站 seed 扩充 12站×365天×14字段+16图表"
```

---

## Task 4: Run Seed + Full Regression

- [ ] **Step 1: Start MySQL if not running**

Check: `docker ps | grep kanban-live-mysql`
If not running: `docker start kanban-live-mysql`

- [ ] **Step 2: Stop existing backend server**

`kill $(lsof -ti :3001) 2>/dev/null || true`
`sleep 1`

- [ ] **Step 3: Restore kanban.db from last known good backup before re-seeding**

```bash
cp /tmp/kanban.db.bak.1789567913 backend/data/kanban.db
rm -f backend/data/kanban.db-wal backend/data/kanban.db-shm
```

- [ ] **Step 4: Run the full seed script (rebuild everything)**

`cd backend && node scripts/seed-hydro-demo.mjs --base http://127.0.0.1:3001`

Expected: Start server first (the script calls HTTP API). The script itself will create datasource/dataset/charts/dashboard.

Wait—script calls HTTP API so server must be running. Sequence:
1. Restore DB
2. Start server: `cd backend && node src/server.js &`
3. Sleep 2s for server to boot
4. Run seed script
5. Kill server, verify data

Corrected sequence:
```bash
cp /tmp/kanban.db.bak.1789567913 backend/data/kanban.db
rm -f backend/data/kanban.db-wal backend/data/kanban.db-shm
cd backend && node src/server.js &
sleep 2
cd backend && node scripts/seed-hydro-demo.mjs --base http://127.0.0.1:3001
# Expected: all 16 charts PASS
kill $(lsof -ti :3001)
```

- [ ] **Step 5: Run backend regression tests**

`cd backend && npm test 2>&1 | tail -8`
Expected: 221+ pass, 0 fail

- [ ] **Step 6: Start server, verify dashboard in browser + timezone endpoint**

```bash
cd backend && node src/server.js &
sleep 2
curl -s http://127.0.0.1:3001/api/config | python3 -c "import sys,json;print(json.load(sys.stdin))"
```
Expected: `{'timezone': 'Asia/Shanghai'}`

Check dashboard list:
```bash
TOKEN=$(curl -s -m 5 -X POST http://127.0.0.1:3001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@kanban.local","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
curl -s http://127.0.0.1:3001/api/dashboards -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']),[x['name'] for x in d['data']])"
```
Expected: 1 dashboard, name 包含水电站

- [ ] **Step 7: Final commit (if any fixups needed during test run)**

If Step 4/5 revealed any issues that required code fixes, commit those fixes separately.

```bash
git status
# Commit only if there are changes
```

---

## Summary of Expected Test Output

| Step | Expected |
|---|---|
| Task 1 Step 2 | config-timezone.test.js: 2 PASS |
| Task 2 Step 6 | front-end build: 0 errors |
| Task 4 Step 4 | seed script: 16/16 chart assertions PASS |
| Task 4 Step 5 | npm test: 221+ pass / 0 fail |
| Task 4 Step 6 | /api/config returns `timezone: 'Asia/Shanghai'` |

## Commit Log (expected)

```
feat(backend): TIMEZONE config + GET /api/config 公开接口
feat(frontend): formatDateTime 按配置时区渲染 + /api/config 加载
feat(scripts): 水电站 seed 扩充 12站×365天×14字段+16图表
```
