# 2026-09-16 水电站行业看板（单一 MySQL 数据源重建）

## 背景

此前 AI 把「水电站数据 + 看板」做成 9 容器多源巨型重灌（Oracle/ES/Trino/ClickHouse…），
从未交付。实际只需一个 MySQL 数据源即可。本计划**推翻巨型方案**，按用户要求最小重建：

- **单一数据源**：`Live MySQL`（127.0.0.1:13306, testdb）。
- **单事实表**：`demo_hydro`（6 电站 × 15 天 = 90 行确定性数据）。
- 1 个 builder 数据集 + 6 个图表 + 1 个「水电站运营分析」看板。

## 根因（前 AI 卡死原因）

它把数据源/数据集/图表/看板元数据都建好了（数据源81、数据集393、图表223-228、看板67），
但 MySQL `demo_hydro` 表为**空**（0 行），图表 `/data` 全查不到数，于是在灌数据死循环。

## 方案

### 1) MySQL 灌数（幂等：先 DROP 再重建）
- 表：`demo_hydro(id INT PK, station VARCHAR, river VARCHAR, province VARCHAR, capacity_mw INT, generation_mwh INT, report_date DATE)`。
- 6 座电站（确定性、按真实装机量）：
  三峡(长江/湖北/22500)、白鹤滩(金沙江/四川/16000)、溪洛渡(金沙江/四川/13860)、
  向家坝(金沙江/四川/6400)、小湾(澜沧江/云南/4200)、龙羊峡(黄河/青海/1280)。
- 2026-04-01 ~ 04-15 共 15 天，`generation_mwh = round(capacity_mw * 24 * coeff)`，
  coeff 由确定性伪随机（seed 固定）取 0.55~0.95 → 每天每站 ≈ 1.7 万~51 万 MWh。

### 2) 清理旧业务数据（依赖序）
dashboards → charts → datasets → data_sources，保留 users/roles/permissions。

### 3) 重建单一 MySQL 源
`datasourceService.create()`: name=`Live MySQL`, type=`mysql`, mode=`direct`,
config={host:127.0.0.1, port:13306, database:testdb, user:root, password:Kanban@123}。

### 4) builder 数据集（build_definition）
`{type:'builder', tables:[{alias:'t0', schema:'testdb', table:'demo_hydro'}], joins:[], fields:[7列显式中文label]}`。

### 5) 图表（6 个，参照既有 223-228 的 config）
- bar 各电站发电量（f_1 × sum f_5）
- doughnut 流域发电占比（f_2 × sum f_5）
- doughnut 省份装机占比（f_3 × sum f_4）
- line 日发电趋势（f_6 date × sum f_5）
- stat 总装机容量（sum f_4）
- stat 总发电量（sum f_5）

### 6) 看板「水电站运营分析」（6 widget 栅格）

## 验证
- 灌数后 `SELECT COUNT(*)` = 90。
- 每图表 `POST /api/charts/:id/data` 均 rows>0（bar 6 行、line 15 行、stat 1 行）。
- `GET /api/dashboards` 有且仅有一条 `水电站运营分析`。
- 回归：backend `npm test` 全绿。
- 前端无改动。

## 实施
- `backend/scripts/seed-hydro-demo.mjs`（ESM，createRequire 风格），一键完成：
  1. mysql2 直连灌 demo_hydro；
  2. 直接 DB 清业务数据；
  3. 服务层 create datasource / saveBuiltDataset / createChart / createDashboard；
  4. 每图表以 query-engine 验证 rows>0，汇总 PASS/FAIL 与退出码。
- 不涉及 Redis/锁/迁移等既有改动，不影响已提交的 #1/#3/#5 工作。

## 风险
- port 3001 有运行中的后端（PID 54225）；脚本直接操作 SQLite 有占用，采用服务层同进程操作即可（整脚本在 backend 目录内、require 后端自身 store）。
- `demo_hydro` 由坏 AI 建过空表，直接 DROP 重建，无残留。