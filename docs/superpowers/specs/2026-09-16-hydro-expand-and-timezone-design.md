# 水电站数据扩充 + 时区配置设计

日期：2026-09-16
状态：已批准（用户确认"两部分都按方案做"）

## 背景

系统当前只有一个「水电站行业运营」看板（id 67，单 MySQL 数据源），存在两个问题：

1. **数据量与图表过少**：`testdb.demo_hydro` 只有 6 电站 × 15 天 = 90 行，业务字段仅 6 个（station/river/province/capacity_mw/generation_mwh/report_date），看板只有 6 个图表，展示过于单薄。
2. **时间显示少 8 小时**：后端存储时间戳全部为 UTC（SQLite `datetime('now')`、MySQL `CURRENT_TIMESTAMP`、代码 `new Date().toISOString()`），前端 `formatDate()` 只做字符串截取、不做时区转换，因此界面显示的"更新时间"是原始 UTC，比中国时区（UTC+8）正好少 8 小时。

本设计把数据源扩充为 12 电站 × 365 天、新增 7 个业务字段（共 13 个业务字段，含 id 共 14 列），看板扩充到 14-16 个图表；并新增时区配置（默认 Asia/Shanghai），前端按配置时区渲染时间。

## 目标

- 单 MySQL 数据源 `demo_hydro` 扩充为约 4380 行、14 个字段（含 id，13 个业务字段），支撑 16 个多样化图表。
- 看板「水电站行业运营」（id 67）扩充到 14-16 个 widget。
- 新增 `GET /api/config`（无需登录）返回 `timezone`；前端统一按配置时区渲染所有时间字段；默认 Asia/Shanghai。
- 存量数据、DB schema、写入路径不变（存储仍为 UTC），仅显示层调整。

## 非目标

- 不迁移已存量数据的存储时区（保留 UTC 存储）。
- 不做多语言 / locale 化。
- 不改动后端写入时间戳的逻辑。
- 不做"看板分享链接"之外的新路由。

## 方案一：数据扩充

### 1.1 `demo_hydro` 表结构（MySQL，testdb）

在现有 6 个业务字段基础上新增 7 个字段，含 id 共 14 列（13 个业务字段）：

| 字段 | 类型 | 说明 | 生成规则 |
|---|---|---|---|
| `id` | INT PK | 主键 | 自增 |
| `station` | VARCHAR(64) | 电站名 | 12 座 |
| `river` | VARCHAR(64) | 流域 | 7 条 |
| `province` | VARCHAR(64) | 省份 | 6 个 |
| `capacity_mw` | INT | 装机容量(MW) | 固定每站 |
| `generation_mwh` | INT | 日发电量(MWh) | `capacity * 24 * load_rate` |
| `report_date` | DATE | 报告日期 | 2025-07-01 ~ 2026-06-30 共 365 天 |
| `load_rate` | DECIMAL(5,4) | 负荷率(%) | 0.60~0.98，夏季高冬季低 + 确定性噪声 |
| `revenue_yuan` | INT | 日营收(元) | `generation_mwh * 电价(0.28~0.42) * 1000` |
| `water_level_m` | DECIMAL(6,2) | 水位(m) | 各站基准水位 ± 6m 波动 |
| `inflow_m3s` | INT | 入库流量(m³/s) | 流域季节相关的来水曲线 + 噪声 |
| `unit_count` | INT | 机组数(台) | 1~16 |
| `self_use_rate` | DECIMAL(5,4) | 厂用电率(%) | 0.001~0.008 |
| `maintenance_state` | VARCHAR(16) | 检修状态 | 正常运行 / 计划检修 / 故障停机；约 5%~8% 天数为检修 |

确定性：仍用 mulberry32 固定种子生成，保证重灌幂等且同一站同一天值稳定。

### 1.2 电站清单（12 座）

| 电站 | 流域 | 省份 | 装机(MW) | 基准水位(m) |
|---|---|---|---|---|
| 三峡大坝 | 长江 | 湖北 | 22500 | 175 |
| 白鹤滩 | 金沙江 | 四川 | 16000 | 825 |
| 溪洛渡 | 金沙江 | 四川 | 13860 | 600 |
| 向家坝 | 金沙江 | 四川 | 6400 | 380 |
| 乌东德 | 金沙江 | 四川 | 10200 | 975 |
| 小湾 | 澜沧江 | 云南 | 4200 | 1240 |
| 二滩 | 雅砻江 | 四川 | 3300 | 1200 |
| 龙羊峡 | 黄河 | 青海 | 1280 | 2600 |
| 丰满 | 松花江 | 吉林 | 1672 | 264 |
| 天生桥一级 | 南盘江 | 贵州 | 1200 | 645 |
| 岩滩 | 红水河 | 广西 | 1810 | 223 |
| 葛洲坝 | 长江 | 湖北 | 2735 | 66 |

流域 8 条：长江 / 金沙江 / 澜沧江 / 雅砻江 / 黄河 / 松花江 / 南盘江 / 红水河。省份 7 个：湖北、四川、云南、青海、吉林、贵州、广西。

### 1.3 字段编号（builder 数据集字段引用）

字段顺序决定 `f_0..f_11` 编号，前端/后端图表 config 全部按此引用：

| f_# | 字段 | label | type |
|---|---|---|---|
| f_0 | id | ID | number |
| f_1 | station | 电站 | string |
| f_2 | river | 流域 | string |
| f_3 | province | 省份 | string |
| f_4 | capacity_mw | 装机容量 | number |
| f_5 | generation_mwh | 发电量 | number |
| f_6 | report_date | 报告日期 | date |
| f_7 | load_rate | 负荷率 | number |
| f_8 | revenue_yuan | 日营收 | number |
| f_9 | water_level_m | 水位 | number |
| f_10 | inflow_m3s | 入库流量 | number |
| f_11 | unit_count | 机组数 | number |
| f_12 | self_use_rate | 厂用电率 | number |
| f_13 | maintenance_state | 检修状态 | string |

含 id 在内共 14 个字段（f_0..f_13）：id + 6 原始业务字段（station/river/province/capacity_mw/generation_mwh/report_date）+ 7 个新增字段（load_rate/revenue_yuan/water_level_m/inflow_m3s/unit_count/self_use_rate/maintenance_state）。

## 方案二：看板图表扩充（14-16 个）

沿用现有「水电站行业运营」看板（id 67）与 `demo_hydro` 单一 MySQL 数据源，重建/替换现有 223-228 六个水电站图表，扩到 16 个图表。图表类型从系统已支持的 40+ 种中选取：

| # | 图表名 | 类型 | dimensions | metrics |
|---|---|---|---|---|
| 1 | 总装机容量 | stat | — | sum f_4 |
| 2 | 年度总发电量 | stat | — | sum f_5 |
| 3 | 年度总营收 | stat | — | sum f_8 |
| 4 | 平均负荷率 | stat | — | avg f_7 |
| 5 | 各电站发电量对比 | barClustered | f_1 | sum f_5 |
| 6 | 流域发电占比 | pie | f_2 | sum f_5 |
| 7 | 省份装机占比 | doughnut | f_3 | sum f_4 |
| 8 | 日发电趋势 | line (f_6 day) | f_6 granularity day | sum f_5 |
| 9 | 月度营收趋势 | line (f_6 month) | f_6 granularity month | sum f_8 |
| 10 | 负荷率仪表盘 | gauge | f_1(单值 avg f_7) | avg f_7 |
| 11 | 各省发电量月度热力 | heatmap | f_3 × f_6 month | sum f_5 |
| 12 | 电站×月份发电热力 | heatmap | f_1 × f_6 month | sum f_5 |
| 13 | 机组容量构成 | treemap | f_1 × f_11 | capacity f_4 |
| 14 | 检修状态分布 | pie | f_13 | count |
| 15 | 流量与发电气泡 | bubble | f_10 × f_5 | count/sum f_8 |
| 16 | 发电量日历热力 | calendar | f_6 | sum f_5 |

> 注：`gauge` 的聚合仅支持单指标单值，配置时以其支持的 config 形态为准（若 gauge 不聚合，则用 `avg f_7` 的 statTrend/stat 兜底）。实现阶段先按现有 `validateChartPayload` 与 query-engine 支持的 config 结构落地，方法同现有 223-228 创建流程。

看板布局：沿用现有 `createDashboard` + `updateDashboard({layout})` 的 grid（col 1-12，hPx 固定），16 个 widget 排 4 行 × 4 列或按内容 2/4/6 宽度排布。

图表创建方式复用 `seed-hydro-demo.mjs` 内既有逻辑（POST /api/charts + dashboard layout）。

## 方案三：时区配置

### 根因

- SQLite `datetime('now')` → UTC；MySQL `CURRENT_TIMESTAMP` → 会话时区（默认 UTC）；`new Date().toISOString()` → UTC ISO。
- 前端 5 处 `formatDate()` 均为字符串截取（`replace('T',' ').slice(0,19)`），不做时区转换：
  - `front-end/src/views/DashboardList.vue:95-97`
  - `front-end/src/views/ChartList.vue:158-160`
  - `front-end/src/views/DatasetList.vue:144-146`
  - `front-end/src/views/DatasetDetail.vue:131-133`
  - `front-end/src/components/dashboard/ChartLibraryPanel.vue:171-173`
- 另有两处直接输出原始时间：`DataSourceDetail.vue:71`（`last_sync_at`）、`UserAdmin.vue:36` 与 `AuditView.vue:20`（el-table 直接绑定 created_at）。

### 实现

1. **后端** `backend/src/config/index.js` 新增：
   ```js
   timezone: String(process.env.TIMEZONE || 'Asia/Shanghai')
   ```
   同时加入 `backend/README.md` 环境变量表与 `.env.example`。

2. **新增公开接口** `GET /api/config`（无需登录，挂到 app.js 或 auth 之外的路由），返回 `{ code:0, data:{ timezone } }`。放在新文件 `backend/src/routes/system.routes.js` 并挂为 `app.use('/api/config', ...)`（单一路由直接挂闭包亦可）。

3. **前端**：
   - 新建 `front-end/src/utils/datetime.js`：
     ```js
     export function formatDateTime(s, tz = 'Asia/Shanghai') {
       if (!s) return '-'
       const utc = String(s).includes('T') ? String(s).replace('Z', '') : String(s).replace(' ', 'T')
       const date = new Date(utc + 'Z') // 裸 UTC 无时区标记 -> 补 Z
       if (Number.isNaN(date.getTime())) return String(s)
       return new Intl.DateTimeFormat('zh-CN', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(date)
     }
     ```
   - 5 处 `formatDate` 改为调用 `formatDateTime(s, timezone)`；`timezone` 从 store 读取。
   - `DataSourceDetail.vue` 的 `last_sync_at`、`nextSync()` 与 `UserAdmin.vue`/`AuditView.vue` 改为统一走 `formatDateTime`。
   - 新增 `front-end/src/stores/app.js` 中 `timezone` 状态（默认 `Asia/Shanghai`），在 `app.js` 的启动流程（`applyInitial` 或新增 action）里 `fetch('/api/config')` 拉取；请求失败回退默认值不阻塞渲染。
   - `front-end/src/api/index.js` 增加 `configApi.get()`。

### 兼容性

- 存量数据仍为 UTC，显示层统一加 8。
- 若未来部署到其他时区，仅改后端 `TIMEZONE`，前端自动跟随。
- `Intl.DateTimeFormat` 为浏览器原生能力，无新依赖。

## 数据流

```
后端 config (env TIMEZONE) --GET /api/config--> 前端 store.timezone
后端 DB (UTC datetime) ----REST 原样返回----> 前端 utils/datetime.formatDateTime(utc, timezone) --> 界面按中国时区显示
MySQL demo_hydro (12站×365天×14字段) --builder 数据集 f_0..f_13--> 16 charts --> dashboard 67 布局
```

## 错误处理

- `/api/config` 无法访问：前端回退默认 `Asia/Shanghai`，页面不阻塞。
- `formatDateTime` 遇到无法解析的字符串：原样返回输入。
- 数据源重灌：`seed-hydro-demo.mjs` 保持幂等（DROP+CREATE 表、--mysql-only / 全量模式）。

## 测试

1. **数据**：`node backend/scripts/seed-hydro-demo.mjs` 全量重跑 <-> 断言 `demo_hydro` 行数 = 4380、12 站各 365 天、无空值。
2. **图表**：POST `/api/charts/:id/data` 对 16 图逐一断言 rows 有值（calendar/treemap/heatmap 等类型按引擎支持验证）。
3. **看板**：GET `/api/dashboards` 确认 id 67 layout 含 16 widget。
4. **时区**：
   - 后端：单测 config 默认 `Asia/Shanghai`、env 覆盖生效；GET /api/config 返回 timezone。
   - 前端：`formatDateTime('2026-09-16 10:00:00','Asia/Shanghai')` 期望输出含 `2026/09/16 18:00` 等（Intl 输出格式），写 vitest 用例。
5. **回归**：`cd backend && npm test` 全绿；`front-end` 若有 vitest 同样跑。

## 部署与配置

- 后端新增环境变量 `TIMEZONE`（默认 `Asia/Shanghai`），写入 README 表与 `.env.example`。

## 开放的决策（实现前需明确）

- gauge 图表对"负荷率"的 config 形态：若引擎不支持聚合，退化为 stat 显示平均负荷率（表 4 与 10 合并）。
- heatmap 双维度（f_3×f_6、f_1×f_6）的 config 结构：实现时按现有 `bigQuery`/`aggregate` 支持的 dimensions 数组处理。