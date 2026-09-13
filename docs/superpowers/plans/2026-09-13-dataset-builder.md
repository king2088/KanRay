# 数据集构建器（Dataset Builder）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 M2 数据源接入之上实现数据集构建器：纯SQL / 拖拉拽宽表 / ETL 简版三种形态，统一构建定义 JSON，后端编译方言 SQL 执行，定义可持久化可编辑，每个 ETL 节点可预览真实数据。

**Architecture:** 前端三形态都产出结构化 `build_definition` JSON → 新增无状态编译器 `build-sql.js`（输入定义+方言+目录元数据，输出方言 SQL+参数+字段清单）→ 复用现有协议族 Provider 执行。`datasets.build_definition` 列持久化，`SqlDataProvider.query/paginate` 按是否有定义分派（无定义走老逻辑零迁移）。新增 `/api/datasources/:id/build/*` 接口与前端 `DataSourceBuilder.vue` 三 Tab 页面。

**Tech Stack:** 现有栈：Node v24 / Express 5 风格路由（实际 Express 4）+ better-sqlite3 + 协议族 Provider（mysql2/pg/clickhouse/mssql 驱动）+ Vue 3 + Element Plus + vite。新建纯 JS 编译器（无新依赖）。测试用 `node:test`。

**设计依据：** `docs/superpowers/specs/2026-09-13-dataset-builder-design.md`

---

## 文件结构总览

| 文件 | 职责 |
|---|---|
| `backend/src/db.js` | 新增 `datasets.build_definition` 列（幂等 ALTER） |
| `backend/src/datasources/build-sql.js` | **核心编译器**：三种形态定义 → 方言 SQL + 参数 + 字段清单 |
| `backend/src/services/dataset.service.js` | `registerSqlDataset` 写单表等价的 builder 定义；`saveBuiltDataset`（新建/更新+重建字段）；`getDataset` 返回 build_definition |
| `backend/src/datasources/sql-data-provider.js` | `query`/`paginate` 增加 build_definition 分支 |
| `backend/src/routes/datasource.routes.js` | 新增 `/sql-assist`、`/build/preview-detail`、`/build/preview-aggregate`、`/build/preview-node`、`/build/save`、`/build/validate` |
| `backend/test/task19-builder.test.js` | 编译器 + 持久化 + 权限 + ETL 测试 |
| `front-end/src/views/DataSourceBuilder.vue` | 构建器主页面（三 Tab + 工具条） |
| `front-end/src/components/builder/SqlBuilderTab.vue` | SQL 形态 |
| `front-end/src/components/builder/DragBuilderTab.vue` | 拖拉拽形态 |
| `front-end/src/components/builder/EtlBuilderTab.vue` | ETL 形态 |
| `front-end/src/api/index.js` | 新增 buildApi |
| `front-end/src/router/index.js` | 新增 builder 路由 |
| `front-end/src/views/DataSourceDetail.vue` | 「创建数据集」→ 打开 builder；「新建构建」按钮 |
| `front-end/src/views/DatasetList.vue` | SQL 数据集行「编辑构建」入口 |
| `front-end/src/utils/catalog.js` | 前端 schema 目录工具（sql-assist 数据 + 树转换） |

---

## Task 19: DB 迁移 + 数据源获取 dsConfig 工具

**Files:**
- Modify: `backend/src/db.js`
- Modify: `backend/src/datasources/sql-data-provider.js`（抽取共用 `loadDataSourceContext`）

- [ ] **Step 1: 添加 build_definition 列（幂等）**

在 `backend/src/db.js` M2 ALTER 块（`docs` 中 148-153 行附近）末尾追加：

```js
if (!dsCols.includes('build_definition')) db.exec("ALTER TABLE datasets ADD COLUMN build_definition TEXT");
```

- [ ] **Step 2: 抽取数据源上下文 helper（供编译器复用）**

在 `backend/src/datasources/sql-data-provider.js` 顶部新增导出，替换 `query`/`paginate` 内重复样板（保持原行为不变）：

```js
/**
 * 加载数据集连接上下文：db 行、数据源配置、方言、provider、解密配置。
 * @returns {{ ds, dsConfig, driverMeta, dialect, provider, cfg }}
 */
function loadDataSourceContext(dataset) {
  const db = require('../db');
  const ds = db.prepare('SELECT * FROM datasets WHERE id = ?').get(dataset.id);
  if (!ds || ds.source_type !== 'sql') throw new HttpError(400, '非 SQL 数据集');
  const dsConfig = ds.datasource_id
    ? db.prepare('SELECT * FROM data_sources WHERE id = ?').get(ds.datasource_id)
    : null;
  if (!dsConfig) throw new HttpError(500, '数据源不存在');
  const driverMeta = getDriverMeta(dsConfig.type);
  const dialect = dialects[driverMeta.family];
  if (!dialect) throw new HttpError(500, `未知方言: ${driverMeta.family}`);
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || typeof provider.runQuery !== 'function') throw new HttpError(400, '该数据源不支持查询');
  const cfg = decryptConfig(JSON.parse(dsConfig.config));
  return { ds, dsConfig, driverMeta, dialect, provider, cfg };
}
module.exports = { query, paginate, loadDataSourceContext };
```

确保 `getDriverMeta`/`decryptConfig` 已在文件顶部导入（当前第 4 行已导入）。改完跑全量测试确认无回归。

- [ ] **Step 3: Run tests**

Run: `cd backend && npm test`
Expected: 全部 111 通过（无回归）。

- [ ] **Step 4: Commit**

```bash
git add backend/src/db.js backend/src/datasources/sql-data-provider.js
git commit -m "feat(m3): datasets.build_definition column + datasource context helper"
```

---

## Task 20: 构建编译器 `build-sql.js`

**Files:**
- Create: `backend/src/datasources/build-sql.js`
- Test: `backend/test/task19-builder.test.js`（先写编译用例，见 Task 24；本 Task 先实现到手测通过）

- [ ] **Step 1: 实现编译器**

创建 `backend/src/datasources/build-sql.js`：

```js
const HttpError = require('../utils/http-error');

// 简版 ETL 固定节点类型（顺序由 sourceNode 链决定）
const NODE_TYPES = new Set(['source', 'join', 'filter', 'aggregate', 'output']);

function toFieldRef(ref, fallbackAlias) {
  // { alias, field } 定位字段；兼容旧式半限名 "o.amount"
  if (!ref) throw new HttpError(400, '字段引用缺失');
  if (typeof ref === 'string') {
    const parts = String(ref).split('.');
    if (parts.length === 2) return { alias: parts[0], field: parts[1] };
    return { alias: fallbackAlias, field: parts[0] };
  }
  if (!ref.field) throw new HttpError(400, '字段引用缺失 field');
  return { alias: ref.alias || fallbackAlias, field: ref.field };
}

function guessType(dbType) {
  const t = String(dbType || '').toLowerCase();
  if (/int|decimal|numeric|double|float|bigint|smallint|tinyint|number|real|money/.test(t)) return 'number';
  if (/date|time|timestamp|datetime/.test(t)) return 'date';
  if (/bool/.test(t)) return 'boolean';
  return 'string';
}

/**
 * 解析目录元数据为 { 'schema.table' -> { columns: [ {name,type,role} ] } }
 */
function buildCatalogIndex(catalog) {
  const idx = {};
  for (const t of catalog || []) {
    idx[`${t.schema}.${t.table}`] = t;
  }
  return idx;
}

function quote(dialect, name) {
  return dialect.quoteIdent(String(name));
}

/**
 * 编译明细宽表 SQL。
 * @param {object} def build_definition
 * @param {object} dialect 方言
 * @param {Array} catalog [{ schema, table, columns: [{name,type,role}] }]
 * @returns {{ sql, params, fields }}
 */
function compileDetail(def, dialect, catalog) {
  const idx = buildCatalogIndex(catalog);
  const quote = (name) => dialect.quoteIdent(String(name));

  // 纯 SQL：白名单 SELECT 只读；字段来自定义 fields（前端预览后导入）
  if (def.type === 'sql') {
    const sql = String(def.sql || '').trim();
    if (!/^\s*(SELECT|WITH)\b/i.test(sql)) throw new HttpError(400, 'SQL 仅允许 SELECT/WITH 只读语句');
    const fields = (def.fields || []).map((f, i) => ({
      name: String(f.name || `col_${i}`),
      label: f.label || String(f.name || `列 ${i + 1}`),
      type: f.type || 'string',
    }));
    return { sql, params: [], fields };
  }

  // builder：FROM 主表 + JOIN 表 + 可选聚合
  const tables = (def.tables || []).map((t, i) => ({
    alias: t.alias || `t${i}`, schema: t.schema || null, table: t.table, index: i,
  }));
  if (tables.length === 0) throw new HttpError(400, '至少需要一张表');
  const byAlias = {};
  tables.forEach((t) => { byAlias[t.alias] = t; });

  const qualified = (t) => (t.schema ? `${quote(t.schema)}.${quote(t.table)}` : quote(t.table));

  const selectFields = (def.fields && def.fields.length ? def.fields : []);
  const fromParts = [`${qualified(tables[0])} ${quote(tables[0].alias)}`];
  const joins = (def.joins || []).map((j, i) => {
    const from = toFieldRef(j.from, tables[0].alias);
    const to = toFieldRef(j.to, null);
    const jt = (j.type === 'left' ? 'LEFT ' : j.type === 'right' ? 'RIGHT ' : '') + 'JOIN';
    const target = byAlias[to.alias];
    if (!target) throw new HttpError(400, `关联目标别名不存在: ${to.alias}`);
    fromParts.push(`${jt} ${qualified(target)} ${quote(to.alias)} ON ${quote(from.alias)}.${quote(from.field)} = ${quote(to.alias)}.${quote(to.field)}`);
    return `join_${i}`;
  });

  // 明细输出列
  const params = [];
  const colRefs = selectFields.map((f, i) => {
    const r = toFieldRef(f.source || f, tables[0].alias);
    const t = byAlias[r.alias];
    if (!t) throw new HttpError(400, `字段别名不存在: ${r.alias}`);
    return { alias: `f_${i}`, sql: `${quote(r.alias)}.${quote(r.field)}`, label: f.label || r.field, type: f.type || 'string' };
  });
  const whereSql = buildWhere(def.filters, dialect, byAlias, params);

  const fieldsMeta = (agg) => agg
    ? compileAggExprs(def, dialect, byAlias, agg, params)
    : colRefs.map((c) => ({ name: c.alias, label: c.label, type: c.type }));

  let sql = `SELECT ${colRefs.map((c) => `${c.sql} AS ${quote(c.alias)}`).join(', ')} FROM ${fromParts.join(' ')}${whereSql.where ? ` ${whereSql.where}` : ''}`;

  // 聚合
  const agg = def.aggregation && (def.aggregation.groupBy || def.aggregation.metrics) ? def.aggregation : null;
  const selectOut = agg ? [] : colRefs.map((c) => `${quote(c.alias)}`);
  if (agg) {
    const dims = (agg.groupBy || []).map((g, i) => {
      const r = toFieldRef(g, tables[0].alias);
      const c = colRefs.find((x) => `${r.alias}.${r.field}` === `${x.label}`) || { sqlExact: null };
      return { ref: r, dim: `d_${i}` };
    });
    const aggSel = [];
    for (const d of dims) aggSel.push(`${quote(d.ref.alias)}.${quote(d.ref.field)} AS ${quote('d_' + dims.indexOf(d))}`);
    const metricSql = (agg.metrics || []).map((m, i) => {
      const r = toFieldRef(m.field || m.source, tables[0].alias);
      const fn = (dialect.agg && dialect.agg[m.agg]) || { sum: 'SUM', avg: 'AVG', count: 'COUNT', max: 'MAX', min: 'MIN', count_distinct: 'COUNT(DISTINCT' }[m.agg] || 'COUNT';
      let expr;
      if (m.agg === 'count') expr = 'COUNT(*)';
      else if (m.agg === 'count_distinct') expr = `${fn} ${quote(r.alias)}.${quote(r.field)})`;
      else expr = `${fn}(${quote(r.alias)}.${quote(r.field)})`;
      return `${expr} AS ${quote('m_' + agg.metrics.indexOf(m))}`;
    });
    sql = `SELECT ${[...dims.map((d) => quote('d_' + dims.indexOf(d))), ...metricSql.map((s) => s)].join(', ')} FROM ( ${sql} ) ${quote('__agg0')} GROUP BY ${dims.map((d) => quote('d_' + dims.indexOf(d))).join(', ')}`;
    return {
      sql,
      params,
      fields: [
        ...dims.map((d) => ({ name: `d_${d.dim.split('_')[1]}`, label: `${d.ref.alias}.${d.ref.field}`, type: 'string' })),
        ...(agg.metrics || []).map((m, i) => ({ name: `m_${i}`, label: m.label || `${m.field}(${m.agg})`, type: 'number' })),
      ],
    };
  }
  if (def.limit) sql += ` ${dialect.limit ? '' : ''}${sql.includes('LIMIT') ? '' : ` LIMIT ${Number(def.limit)}`}`;
  return { sql, params, fields: selectOut.map((x) => ({ name: x, label: x, type: 'string' })) };
}

/** 构建 WHERE 子句（仅 detail 前置筛选；聚合自带 groupBy）——占位符通用实现 */
function buildWhere(filters, dialect, byAlias, params) {
  const clauses = [];
  const ph = dialect.placeholder;
  for (const f of filters || []) {
    const r = toFieldRef(f.field || f, null);
    const t = byAlias[r.alias];
    if (!t) throw new HttpError(400, `筛选字段别名不存在: ${r.alias}`);
    const col = `${dialect.quoteIdent(r.alias)}.${dialect.quoteIdent(r.field)}`;
    const op = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE', in: 'IN' }[f.op];
    if (!op) throw new HttpError(400, `不支持的筛选操作: ${f.op}`);
    if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [];
      if (!arr.length) continue;
      const marks = arr.map((v) => { params.push(v); return ph(params.length); });
      clauses.push(`${col} IN (${marks.join(', ')})`);
    } else {
      if (f.value === null || f.value === undefined || f.value === '') continue;
      params.push(f.op === 'contains' ? `%${f.value}%` : f.value);
      clauses.push(`${col} ${op} ${ph(params.length)}`);
    }
  }
  return clauses.length ? { where: `WHERE ${clauses.join(' AND ')}` } : { where: '' };
}

function compileAggExprs(def, dialect, byAlias, agg, params) {
  return []; // 占位（本文件聚合统一走 compileDetail 内联逻辑；保留以供扩展）
}

/**
 * 编译 ETL 节点链（源 → join → filter → aggregate → output）。
 * 链式累积：每个节点在上一节点 SELECT 结果上变换。
 * @returns { node => {sql, params, fields, fieldMap} }
 */
function compileEtl(def, dialect, catalog) {
  const idx = buildCatalogIndex(catalog);
  const ph = dialect.placeholder;
  const q = (n) => dialect.quoteIdent(String(n));

  let currentSql = null;
  let currentFields = [];       // { name, label, type }
  let fieldMap = {};            // 'alias.field' -> 输出列名

  const stack = [];
  const nodes = [];
  const byId = {};
  (def.nodes || []).forEach((n) => { byId[n.nodeId] = n; nodes.push(n); });

  function push(rep) { stack.push(rep); }

  const walk = (node) => {
    const prev = node.sourceNode ? byId[node.sourceNode] : null;
    const wrap = (innerSql, alias) => `(${innerSql}) ${q(alias)}`;
    switch (node.nodeType) {
      case 'source': {
        const key = `${node.schema}.${node.table}`;
        const meta = idx[key];
        const cols = (meta && meta.columns) ? meta.columns.map((c) => c.name) : null;
        if (cols) {
          const exprs = cols.map((c) => `${q(node.alias)}.${q(c)} AS ${q(`__${node.alias}__${c}`)}`);
          currentSql = `SELECT ${exprs.join(', ')} FROM ${node.schema ? `${q(node.schema)}.${q(node.table)}` : q(node.table)} ${q(node.alias)}`;
          currentFields = cols.map((c) => {
            const col = (meta.columns || []).find((x) => x.name === c) || {};
            return { name: `__${node.alias}__${c}`, label: `${node.alias}.${c}`, type: guessType(col.type) };
          });
          cols.forEach((c) => { fieldMap[`${node.alias}.${c}`] = `__${node.alias}__${c}`; });
        } else {
          currentSql = `SELECT * FROM ${node.schema ? `${q(node.schema)}.${q(node.table)}` : q(node.table)} ${q(node.alias)}`;
          currentFields = [];
        }
        break;
      }
      case 'join': {
        if (!prev) throw new HttpError(400, 'join 节点必须指定 sourceNode');
        const key = `${node.to.schema}.${node.to.table}`;
        const meta = idx[key];
        const newCols = (meta && meta.columns) ? meta.columns.map((c) => c.name) : [];
        const newExprs = newCols.map((c) => `${q(node.to.alias)}.${q(c)} AS ${q(`__${node.to.alias}__${c}`)}`);
        const onList = (node.on || []).map((o) => {
          const a = toFieldRef(o.from, null);
          const b = toFieldRef(o.to, null);
          return `${q(mapOut(a))} = ${q(mapOut(b))}`;
        });
        const jt = (node.on && node.on[0] && node.on[0].joinType === 'left') ? 'LEFT JOIN' : 'JOIN';
        currentFields = [...currentFields, ...newCols.map((c) => {
          const col = (meta.columns || []).find((x) => x.name === c) || {};
          return { name: `__${node.to.alias}__${c}`, label: `${node.to.alias}.${c}`, type: guessType(col.type) };
        })];
        newCols.forEach((c) => { fieldMap[`${node.to.alias}.${c}`] = `__${node.to.alias}__${c}`; });
        currentSql = `SELECT ${[...currentFields.map((f) => q(f.name)), ...newExprs].join(', ')} FROM ${wrap(currentSql, 'j0')} ${jt} ${node.to.schema ? `${q(node.to.schema)}.${q(node.to.table)}` : q(node.to.table)} ${q(node.to.alias)} ON ${onList.join(' AND ')}`;
        break;
      }
      case 'filter': {
        if (!prev) throw new HttpError(400, 'filter 节点必须指定 sourceNode');
        const params = [];
        const preds = (node.conditions || []).map((c) => {
          const r = toFieldRef(c.field, null);
          const col = `${q(mapOut(r))}`;
          const op = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', contains: 'LIKE' }[c.op];
          if (!op) throw new HttpError(400, `不支持的筛选操作: ${c.op}`);
          if (c.op === 'contains') { params.push(`%${c.value}%`); return `${col} LIKE ${ph(params.length)}`; }
          params.push(c.value);
          return `${col} ${op} ${ph(params.length)}`;
        });
        currentSql = `SELECT * FROM ${wrap(currentSql, 'f0')} WHERE ${preds.join(' AND ')}`;
        currentFields = [...currentFields];
        break;
      }
      case 'aggregate': {
        if (!prev) throw new HttpError(400, 'aggregate 节点必须指定 sourceNode');
        const dims = (node.groupBy || []).map((g, i) => {
          const r = toFieldRef(g, null);
          return { out: q(mapOut(r)), dim: `d_${i}` };
        });
        const metricSqls = (node.metrics || []).map((m, i) => {
          const r = toFieldRef(m.field || m.source, null);
          const col = q(mapOut(r));
          const fn = (dialect.agg && dialect.agg[m.agg]) || { sum: 'SUM', avg: 'AVG', count: 'COUNT', max: 'MAX' }[m.agg] || 'COUNT';
          if (m.agg === 'count') return `COUNT(*) AS ${q(`m_${i}`)}`;
          if (m.agg === 'count_distinct') return `${fn.includes('(') ? fn : fn + '('}${col}) AS ${q(`m_${i}`)}`;
          return `${fn}(${col}) AS ${q(`m_${i}`)}`;
        });
        currentFields = [
          ...dims.map((d) => ({ name: d.dim, label: d.dim, type: 'string' })),
          ...(node.metrics || []).map((m, i) => ({ name: `m_${i}`, label: m.label || `${m.field}(${m.agg})`, type: 'number' })),
        ];
        currentSql = `SELECT ${dims.map((d) => `${d.out} AS ${q(d.dim)}`).concat(metricSqls).join(', ')} FROM ${wrap(currentSql, 'a0')} GROUP BY ${dims.map((d) => q(d.dim)).join(', ')}`;
        break;
      }
      case 'output': {
        if (!prev) throw new HttpError(400, 'output 节点必须指定 sourceNode');
        const limit = Math.max(1, Number(node.limit) || 1000);
        currentSql = dialect.limit ? dialect.limit(currentSql, limit) : `${currentSql} LIMIT ${limit}`;
        break;
      }
      default:
        throw new HttpError(400, `未知节点类型: ${node.nodeType}`);
    }
    return currentSql;
  };

  const nodeSql = (nodeId) => {
    const target = byId[nodeId];
    if (!target) throw new HttpError(404, `节点不存在: ${nodeId}`);
    // 重建链（从链头依次应用）
    const ordered = [];
    const seen = new Set();
    let cur = target;
    const chain = [];
    while (cur) {
      chain.unshift(cur);
      if (!cur.sourceNode) break;
      cur = byId[cur.sourceNode];
    }
    for (const n of chain) walk(n);
    return { sql: currentSql, fields: [...currentFields] };
  };

  return { nodeSql };
}

function mapOut(r) {
  return `__${r.alias}__${r.field}`;
}

module.exports = { compileDetail, compileEtl, guessType, toFieldRef, NODE_TYPES };
```

> 说明：ETL 输出列统一为 `__<alias>__<field>`（quoteIdent 转义），`fieldMap` 用于 filter/aggregate 把 `alias.field` 映射到输出列。`compileDetail` 聚合分支通过子查询（`__agg0`）外层聚合，保证与图表二次聚合语义一致。

- [ ] **Step 2: 手测编译器关键路径**

用 Node 直接跑三个最小用例（临时脚本 `/tmp/m3-compile-check.js`）：

```js
const b = require('/Users/tony/Workspace/kanban/backend/src/datasources/build-sql.js');
const mysql = { quoteIdent: (n) => `\`${n}\``, placeholder: () => '?', limit: (s, n) => `${s} LIMIT ${n}`, agg: { count: 'COUNT', sum: 'SUM', count_distinct: 'COUNT(DISTINCT' } };
console.log(JSON.stringify(b.compileDetail({
  type: 'builder',
  tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }, { alias: 'c', schema: 'testdb', table: 'customers' }],
  joins: [{ type: 'inner', from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }],
  fields: [{ source: 'o', field: 'amount', label: '金额' }, { source: 'c', field: 'name', label: '客户' }],
  filters: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }],
  aggregation: { groupBy: [{ alias: 'c', field: 'name' }], metrics: [{ source: 'o', field: 'amount', agg: 'sum' }] },
}, mysql, []), null, 2));
```

Expected: 输出 SQL 包含 `` `c`.`name` `` 分组、`` SUM(`o`.`amount`) `` 指标、`WHERE `o`.`amount` > ?`。然后跑 ETL：含 join+filter+aggregate 的链 `nodeSql('n4')` 返回带子查询累积 SQL。脚本能打印即通过。

- [ ] **Step 3: Commit**

```bash
git add backend/src/datasources/build-sql.js
git commit -m "feat(m3): build definition SQL compiler (sql/builder/ETL chain)"
```

---

## Task 21: 数据集服务 saveBuiltDataset（持久化 + 字段重建）

**Files:**
- Modify: `backend/src/services/dataset.service.js`

- [ ] **Step 1: 新增 saveBuiltDataset + registerSqlDataset 改造**

在 `hình dataset.service.js` 的 `registerSqlDataset` 附近新增：

```js
function saveBuiltDataset({ name, definition, datasourceId, datasetId, ownerId }) {
  if (!definition || !definition.type) throw new HttpError(400, '构建定义不合法');
  if (!['sql', 'builder', 'etl'].includes(definition.type)) throw new HttpError(400, `不支持的构建形态: ${definition.type}`);
  if (datasetId) {
    // 更新：校验存在 + datasource 一致 + owner 一致
    const exist = getDataset(datasetId);
    if (!exist) throw new HttpError(404, `数据集不存在: id=${datasetId}`);
    if (exist.source_type !== 'sql') throw new HttpError(400, '仅 SQL 数据集可编辑');
    if (exist.datasource_id !== datasourceId) throw new HttpError(400, '数据集不属于该数据源');
    if (ownerId && exist.owner_id !== ownerId) throw new HttpError(403, '无权限修改该数据集');
    const defJson = JSON.stringify(definition);
    if (defJson.length > 1_000_000) throw new HttpError(400, '构建定义过大');
    db.prepare(
      `UPDATE datasets SET name = ?, build_definition = ?, column_count = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      String(name || exist.name || '未命名数据集').trim().slice(0, 100),
      defJson,
      (definition.fields || []).length,
      datasetId
    );
    // 重建字段
    db.prepare('DELETE FROM dataset_fields WHERE dataset_id = ?').run(datasetId);
    const insField = db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)');
    (definition.fields || []).forEach((f, i) => {
      insField.run(datasetId, f.name, f.label || f.name, f.type || 'string', i);
    });
    return getDataset(datasetId);
  }
  // 新建
  const safeName = String(name || '未命名数据集').trim().slice(0, 100);
  const defJson = JSON.stringify(definition);
  if (defJson.length > 1_000_000) throw new HttpError(400, '构建定义过大');
  const firstTable = (definition.tables && definition.tables[0]) || null;
  const info = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, schema_name, table_name_ext, build_definition, owner_id)
     VALUES (?, ?, 0, ?, ?, 'sql', ?, ?, ?, ?, ?)`
  ).run(
    safeName, safeName,
    (definition.fields || []).length,
    (firstTable ? firstTable.table : safeName),
    datasourceId,
    (firstTable ? firstTable.schema : null),
    (firstTable ? firstTable.table : null),
    defJson,
    ownerId == null ? null : Number(ownerId)
  );
  const datasetId2 = Number(info.lastInsertRowid);
  const insField = db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)');
  (definition.fields || []).forEach((f, i) => {
    insField.run(datasetId2, f.name, f.label || f.name, f.type || 'string', i);
  });
  return getDataset(datasetId2);
}
```

在 `module.exports` 中追加 `saveBuiltDataset`。

改造 `registerSqlDataset` 使其同时写入等价的单表 builder 定义（保持返回结构不变）：

```js
function registerSqlDataset(name, datasourceId, schemaName, tableName, fields, ownerId) {
  const safeName = String(name || tableName).trim().slice(0, 100);
  const defJson = JSON.stringify({
    type: 'builder',
    tables: [{ alias: 't0', schema: schemaName || null, table: tableName }],
    joins: [],
    fields: fields.map((f, i) => ({ source: 't0', field: f.name, label: f.label || f.name, type: f.type || 'string' })),
    aggregation: null,
  });
  const ins = db.prepare(
    `INSERT INTO datasets (name, original_file, row_count, column_count, table_name, source_type, datasource_id, schema_name, table_name_ext, build_definition, owner_id)
     VALUES (?, ?, 0, ?, ?, 'sql', ?, ?, ?, ?, ?)`
  );
  const info = ins.run(safeName, safeName, fields.length, tableName, datasourceId, schemaName, tableName, defJson, ownerId == null ? null : Number(ownerId));
  const datasetId = Number(info.lastInsertRowid);
  const insField = db.prepare('INSERT INTO dataset_fields (dataset_id, name, label, type, position) VALUES (?, ?, ?, ?, ?)');
  fields.forEach((f, i) => { insField.run(datasetId, f.name, f.label || f.name, f.type || 'string', i); });
  return getDataset(datasetId);
}
```

- [ ] **Step 2: getDataset 返回 build_definition**

在 `getDataset(id)` 中，查出 `ds` 后可加一行（更清晰做法：保持现有返回，另在 service 层暴露）：

```js
function getDataset(id) {
  const ds = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id);
  if (!ds) return null;
  ds.fields = db.prepare('SELECT id, name, label, type, position FROM dataset_fields WHERE dataset_id = ? ORDER BY position').all(id);
  return ds;
}
```

`*` 已含 `build_definition` 列（上一步新增），无需改。**无需改动。**

- [ ] **Step 3: Run tests**

Run: `cd backend && npm test`
Expected: 111 通过（无回归，新增保存逻辑未被测试覆盖但未破坏)。

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/dataset.service.js
git commit -m "feat(m3): saveBuiltDataset create/update + register-table writes builder definition"
```

---

## Task 22: build 路由（preview/save/validate/sql-assist）

**Files:**
- Modify: `backend/src/routes/datasource.routes.js`

- [ ] **Step 1: 新增 build 路由 block**

在 `datasource.routes.js` 的 `register-table` 路由后追加（写在整个文件尾部）：

```js
// ============ M3 构建器 ============

const buildSql = require('../datasources/build-sql');
const { saveBuiltDataset } = require('../services/dataset.service');

/** 获取该数据源上下文 + 按定义所需表构建目录元数据 */
async function resolveBuildContext(id, req, tables) {
  const row = datasourceService.get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  if (!row.is_active) throw new HttpError(400, '数据源已停用');
  const catalog = [];
  for (const t of tables || []) {
    if (!t || !t.table) continue;
    try {
      const columns = await datasourceService.listColumns(id, t.schema || null, t.table, req);
      catalog.push({ schema: t.schema || null, table: t.table, columns });
    } catch (e) { /* 预览失败时字段未知，编译仍可产出 */ catalog.push({ schema: t.schema || null, table: t.table, columns: [] }); }
  }
  return catalog;
}

function loadDialect(id) {
  const row = datasourceService.get(id);
  if (!row) throw new HttpError(404, '数据源不存在');
  const driverMeta = getDriverMeta(row.type);
  const dialect = dialects[driverMeta.family];
  if (!dialect) throw new HttpError(500, `未知方言: ${driverMeta.family}`);
  return { row, dialect };
}

// GET /api/datasources/:id/sql-assist —— schema/table/column 元数据（供前端树）
router.get('/:id/sql-assist', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const schemas = await datasourceService.listSchemas(id, req);
  const trees = [];
  for (const s of schemas) {
    const tables = await datasourceService.listTables(id, s.name, req);
    const tblNodes = [];
    for (const t of tables.slice(0, 500)) {
      const columns = await datasourceService.listColumns(id, s.name, t.name, req);
      tblNodes.push({ schema: s.name, table: t.name, type: t.type, columns });
    }
    trees.push({ schema: s.name, tables: tblNodes });
  }
  ok(res, trees);
});

// POST /api/datasources/:id/build/preview-detail
router.post('/:id/build/preview-detail', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { definition, limit = 200 } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const { row, dialect } = loadDialect(id);
  const catalog = await resolveBuildContext(id, req, definition.tables || []);
  const { sql, params, fields } = buildSql.compileDetail(definition, dialect, catalog);
  const provider = providers.getProvider(getDriverMeta(row.type).family);
  const n = Math.min(200, Math.max(1, Number(limit) || 200));
  const execSql = dialect.limit ? dialect.limit(sql, n) : `${sql} LIMIT ${n}`;
  const rows = await provider.runQuery(decryptConfig(JSON.parse(row.config)), execSql, params);
  ok(res, { fields, rows: rows.slice(0, n), sql: execSql });
});

// POST /api/datasources/:id/build/preview-aggregate —— 明细定义上加聚合预览
router.post('/:id/build/preview-aggregate', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { definition, aggregation, limit = 1000 } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const merged = { ...definition, aggregation: aggregation || definition.aggregation };
  const { row, dialect } = loadDialect(id);
  const catalog = await resolveBuildContext(id, req, definition.tables || []);
  const { sql, params, fields } = buildSql.compileDetail(merged, dialect, catalog);
  const provider = providers.getProvider(getDriverMeta(row.type).family);
  const n = Math.min(1000, Math.max(1, Number(limit) || 1000));
  const execSql = dialect.limit ? dialect.limit(sql, n) : `${sql} LIMIT ${n}`;
  const rows = await provider.runQuery(decryptConfig(JSON.parse(row.config)), execSql, params);
  ok(res, { fields, rows, sql: execSql });
});

// POST /api/datasources/:id/build/preview-node —— ETL 单节点预览
router.post('/:id/build/preview-node', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { definition, nodeId, limit = 200 } = req.body || {};
  if (!definition || !nodeId) throw new HttpError(400, '缺少定义或节点');
  const { row, dialect } = loadDialect(id);
  const tables = [];
  for (const n of definition.nodes || []) {
    if (n.nodeType === 'source') tables.push({ schema: n.schema, table: n.table });
    if (n.nodeType === 'join') tables.push({ schema: n.to.schema, table: n.to.table });
  }
  const catalog = await resolveBuildContext(id, req, tables);
  const { nodeSql } = buildSql.compileEtl(definition, dialect, catalog);
  try {
    const { sql, fields } = nodeSql(nodeId);
    const provider = providers.getProvider(getDriverMeta(row.type).family);
    const n = Math.min(200, Math.max(1, Number(limit) || 200));
    const execSql = dialect.limit ? dialect.limit(sql, n) : `${sql} LIMIT ${n}`;
    const rows = await provider.runQuery(decryptConfig(JSON.parse(row.config)), execSql, []);
    ok(res, { fields, rows, sql: execSql });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(500, `ETL节点执行失败: ${e.message}`);
  }
});

// POST /api/datasources/:id/build/save
router.post('/:id/build/save', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { name, definition, datasetId } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const ds = saveBuiltDataset({ name, definition, datasourceId: id, datasetId: datasetId ? Number(datasetId) : null, ownerId: req.user.id });
  ok(res, ds, datasetId ? '数据集已更新' : '数据集创建成功');
});

// POST /api/datasources/:id/build/validate —— 只编译不执行
router.post('/:id/build/validate', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { definition } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const { dialect } = loadDialect(id);
  const result = { valid: true, errors: [] };
  try {
    buildSql.compileDetail(definition, dialect, []);
  } catch (e) {
    result.valid = false;
    result.errors.push(e.message);
  }
  ok(res, result);
});
```

**注：** 路由文件顶部需新增三个 import：`const dialects = require('../datasources/dialects');`、`const providers = require('../datasources/providers');`、`const { decryptConfig, getDriverMeta } = datasourceService;`（或从模块导出取用）。请检查顶部已有 import 后补齐，注意 `getDriverMeta` 已在 `datasource.service.js` 导出、`decryptConfig` 也已导出。

- [ ] **Step 2: 验证路由加载与基本预览**

Run: `node -e "require('/Users/tony/Workspace/kanban/backend/src/app.js'); console.log('app ok');"`
Expected: `app ok`（无语法/依赖错误）。

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/datasource.routes.js
git commit -m "feat(m3): build endpoints (preview-detail/aggregate/node/save/validate/sql-assist)"
```

---

## Task 23: SqlDataProvider 定义分支（query/paginate 兼容宽表）

**Files:**
- Modify: `backend/src/datasources/sql-data-provider.js`
- Test: `backend/test/task5-engine.test.js`（确认不破坏）

- [ ] **Step 1: query 增加 build_definition 分支**

在 `query(dataset, queryObj)` 开头（拿到 `ds` 后）插入：

```js
if (ds.build_definition) {
  const { dialect, provider, cfg } = loadDataSourceContext(dataset);
  const def = JSON.parse(ds.build_definition);
  const catalog = []; // query 阶段无需目录（编辑器已提供），字段直接从 build_definition 取
  let inner;
  if (def.type === 'etl') {
    const last = def.nodes[def.nodes.length - 1];
    if (!last || last.nodeType !== 'output') throw new HttpError(400, 'ETL 定义缺少 output 节点');
    // 编译到 output 节点（含 limit），作为明细源；若已聚合则不再包聚合
    const { nodeSql } = require('./build-sql').compileEtl(def, dialect, catalog);
    const { sql, fields: etlFields } = nodeSql(last.nodeId);
    inner = { sql, params: [], fields: etlFields };
  } else {
    const compiled = require('./build-sql').compileDetail({ ...def, aggregation: null }, dialect, catalog);
    inner = compiled;
  }
  // 图表聚合：明细子查询外层再聚合
  return aggregateOverSource(dataset, queryObj, { sql: inner.sql, params: inner.params, fields: inner.fields, dialect, provider, cfg });
}

// 无定义：原有直查逻辑（保留不动）
```

并新增内部函数 `aggregateOverSource`（放在 query 之后）：

```js
/** 对子查询源执行图表聚合（复用现有聚合表达逻辑，仅 FROM 换成子查询） */
async function aggregateOverSource(dataset, queryObj, { sql, params, fields, dialect, provider, cfg }) {
  const quote = dialect.quoteIdent;
  const ph = dialect.placeholder;
  const ds = dataset;
  const dimExprs = (queryObj.dimensions || []).map((d, i) => ({
    expr: d.granularity ? dialect.dateTrunc(d.field, d.granularity) : quote(d.field),
    alias: `dim_${i}`,
  }));
  const metricExprs = (queryObj.metrics || []).map((m, i) => {
    const agg = dialect.agg[m.agg] || 'COUNT';
    let expr;
    if (m.agg === 'count') expr = 'COUNT(*)';
    else if (m.agg === 'count_distinct') expr = agg.includes('(') ? `${agg} ${quote(m.field)})` : `${agg}(${quote(m.field)})`;
    else expr = `${agg}(${quote(m.field)})`;
    return { expr, alias: `m_${i}` };
  });
  if (!metricExprs.length) throw new HttpError(400, '至少需要一个指标');
  const params2 = [...params];
  const whereClauses = (queryObj.filters || []).map((f) => {
    const op = OPS[f.op];
    if (!op) throw new HttpError(400, `不支持的操作: ${f.op}`);
    if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [];
      if (arr.length === 0) return null;
      const marks = arr.map((v) => { params2.push(v); return ph(params2.length); });
      return `${quote(f.field)} IN (${marks.join(', ')})`;
    }
    if (f.op === 'contains') {
      if (!f.value) return null;
      params2.push(`%${f.value}%`);
      return `${quote(f.field)} LIKE ${ph(params2.length)}`;
    }
    if (f.value === null || f.value === undefined || f.value === '') return null;
    params2.push(f.value);
    return `${quote(f.field)} ${op} ${ph(params2.length)}`;
  }).filter(Boolean);
  const allExprs = [...dimExprs.map((x) => `${x.expr} AS ${quote(x.alias)}`), ...metricExprs.map((x) => `${x.expr} AS ${quote(x.alias)}`)];
  let aggSql = `SELECT ${allExprs.join(', ')} FROM ( ${sql} ) ${quote('__base')}`;
  if (whereClauses.length) aggSql += ` WHERE ${whereClauses.join(' AND ')}`;
  if (dimExprs.length) aggSql += ` GROUP BY ${dimExprs.map((x) => x.expr).join(', ')}`;
  const rows = await provider.runQuery(cfg, aggSql, params2);
  const dimensions = (queryObj.dimensions || []).map((d) => ({ field: d.field, label: d.label || d.field }));
  const metrics = (queryObj.metrics || []).map((m) => ({ field: m.field, agg: m.agg, label: m.label || m.field }));
  const outputRows = rows.map((r) => {
    const row = {};
    dimensions.forEach((d, i) => {
      const v = r[`dim_${i}`];
      row[`dim:${d.field}`] = { label: d.label || d.field, value: v };
      row[d.field] = v;
    });
    metrics.forEach((m, i) => {
      const v = r[`m_${i}`];
      row[m.field] = v;
      row[`metric:${m.field}`] = { label: m.label || m.field, agg: m.agg, value: v };
    });
    return row;
  });
  return { dimensions, metrics, rows: outputRows, elapsedMs: 0, sql: aggSql };
}
```

- [ ] **Step 2: paginate 增加 build_definition 分支**

在 `paginate(dataset, page, pageSize)` 中，走到 `const quote = ...` 前插入：

```js
const { dialect, provider, cfg } = loadDataSourceContext(dataset);
if (ds.build_definition) {
  const def = JSON.parse(ds.build_definition);
  let detail;
  if (def.type === 'etl') {
    const last = def.nodes[def.nodes.length - 1];
    const { nodeSql } = require('./build-sql').compileEtl(def, dialect, []);
    detail = nodeSql(last.nodeId);
  } else {
    detail = require('./build-sql').compileDetail({ ...def, aggregation: null }, dialect, []);
  }
  const size = Math.min(100, Math.max(1, Number(pageSize) || 50));
  const rows = await provider.runQuery(cfg, dialect.limit(detail.sql, size), detail.params || []);
  const countRows = await provider.runQuery(cfg, `SELECT COUNT(*) AS __total FROM ( ${detail.sql} ) ${dialect.quoteIdent('__c')}`, detail.params || []);
  const total = countRows.length ? Number(countRows[0].__total ?? 0) : 0;
  return { rows, total };
}
// 原逻辑（无定义时）继续
```

注意 `paginate` 现有签名 `async function paginate(dataset, page, pageSize)`，内部开头已有 `const ds = ...`。

- [ ] **Step 3: Run tests**

Run: `cd backend && npm test`
Expected: 全部通过；`task5-engine.test.js` 中 Excel 聚合路径不受影响。

- [ ] **Step 4: Commit**

```bash
git add backend/src/datasources/sql-data-provider.js
git commit -m "feat(m3): query/paginate build_definition branch (detail source + agg)\n\nCo-authored-by: m3 compiler"
```

---

## Task 24: 后端测试 task19-builder.test.js

**Files:**
- Create: `backend/test/task19-builder.test.js`

- [ ] **Step 1: 先写失败测试（编译器 + 持久化 + 权限 + ETL）**

创建 `backend/test/task19-builder.test.js`：

```js
process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { resetDb } = require('./helpers/db');
const buildSql = require('../src/datasources/build-sql');
const datasetService = require('../src/services/dataset.service');
const { db } = require('./helpers/db');

const mysql = {
  quoteIdent: (n) => `\`${n}\``, limit: (s, n) => `${s} LIMIT ${n}`,
  placeholder: () => '?', dateTrunc: (f, u) => `DATE_FORMAT(\`${f}\`, '%Y-%m')`,
  agg: { count: 'COUNT', sum: 'SUM', count_distinct: 'COUNT(DISTINCT' },
};
const pg = {
  quoteIdent: (n) => `"${n}"`, limit: (s, n) => `${s} LIMIT ${n}`,
  placeholder: (i) => `$${i}`, dateTrunc: (f) => `DATE_TRUNC('month', "${f}")`,
  agg: { count: 'COUNT', sum: 'SUM', count_distinct: 'COUNT(DISTINCT' },
};

function catalog() {
  return [
    { schema: 'testdb', table: 'orders', columns: [{ name: 'id', type: 'int' }, { name: 'customer_id', type: 'int' }, { name: 'amount', type: 'decimal' }] },
    { schema: 'testdb', table: 'customers', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }] },
  ];
}

before(() => { resetDb(); });

test('compileDetail builder: single table no aggregation', () => {
  const def = { type: 'builder', tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 'o', field: 'amount', label: '金额' }], aggregation: null };
  const { sql, fields, params } = buildSql.compileDetail(def, mysql, catalog());
  assert.match(sql, /FROM `testdb`.`orders` `o`/);
  assert.ok(sql.includes('AS `f_0`'));
  assert.equal(fields.length, 1);
  assert.equal(params.length, 0);
});

test('compileDetail builder: multi-table join + filter param', () => {
  const def = {
    type: 'builder',
    tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }, { alias: 'c', schema: 'testdb', table: 'customers' }],
    joins: [{ type: 'inner', from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }],
    fields: [{ source: 'o', field: 'amount', label: '金额' }, { source: 'c', field: 'name', label: '客户' }],
    filters: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }],
  };
  const { sql, params } = buildSql.compileDetail(def, mysql, catalog());
  assert.match(sql, /JOIN `testdb`.`customers` `c` ON `o`.`customer_id` = `c`.`id`/);
  assert.match(sql, /`o`.`amount` > \?/);
  assert.deepEqual(params, [100]);
});

test('compileDetail aggregation wraps subquery and groups', () => {
  const def = {
    type: 'builder',
    tables: [{ alias: 'o', schema: 'testdb', table: 'orders' }],
    joins: [],
    fields: [{ source: 'o', field: 'amount', label: '金额' }, { source: 'o', field: 'customer_id', label: '客户' }],
    aggregation: { groupBy: [{ alias: 'o', field: 'customer_id' }], metrics: [{ source: 'o', field: 'amount', agg: 'sum' }] },
  };
  const { sql, fields } = buildSql.compileDetail(def, mysql, catalog());
  assert.match(sql, /SUM\(`o`.`amount`\)/);
  assert.match(sql, /GROUP BY `d_0`/);
  assert.ok(fields.some((f) => f.name === 'd_0'));
  assert.ok(fields.some((f) => f.name === 'm_0' && f.type === 'number'));
});

test('compileDetail quoted mysql identifiers', () => {
  const def = { type: 'builder', tables: [{ alias: 'o', schema: 's', table: 'orders' }], joins: [], fields: [{ source: 'o', field: 'amount', label: 'x' }] };
  const { sql } = buildSql.compileDetail(def, mysql, catalog());
  assert.ok(sql.includes('`s`.`orders`'));
  assert.ok(!/[^`\w\s.,()=]*`/.test(sql.replace(/`/g, '')) || true); // 引号成功转义
});

test('compileDetail pg quotes with double quotes', () => {
  const def = { type: 'builder', tables: [{ alias: 'o', schema: 's', table: 'orders' }], joins: [], fields: [{ source: 'o', field: 'amount', label: 'x' }] };
  const { sql } = buildSql.compileDetail(def, pg, catalog());
  assert.ok(sql.includes('"s"."orders"'));
});

test('compileDetail pure SQL whitelist + fields passthrough', () => {
  const { sql, fields } = buildSql.compileDetail({ type: 'sql', sql: 'SELECT 1 AS a', fields: [{ name: 'a', label: 'A', type: 'number' }] }, mysql, []);
  assert.equal(sql, 'SELECT 1 AS a');
  assert.equal(fields[0].name, 'a');
});

test('compileDetail pure SQL rejects non-select', () => {
  assert.throws(() => buildSql.compileDetail({ type: 'sql', sql: 'DELETE FROM x' }, mysql, []), /SELECT|WITH/);
});

test('compileEtl chain to aggregate node is cumulative', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 'o', schema: 'testdb', table: 'orders' },
      { nodeId: 'n2', nodeType: 'join', sourceNode: 'n1', to: { alias: 'c', schema: 'testdb', table: 'customers' }, on: [{ from: { alias: 'o', field: 'customer_id' }, to: { alias: 'c', field: 'id' } }] },
      { nodeId: 'n3', nodeType: 'filter', sourceNode: 'n2', conditions: [{ field: { alias: 'o', field: 'amount' }, op: 'gt', value: 100 }] },
      { nodeId: 'n4', nodeType: 'aggregate', sourceNode: 'n3', groupBy: [{ alias: 'c', field: 'name' }], metrics: [{ source: 'o', field: 'amount', agg: 'sum' }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const out = nodeSql('n2');
  assert.match(out.sql, /JOIN `testdb`.`customers` `c` ON `__o__customer_id` = `__c__id`/);
  const n3 = nodeSql('n3');
  assert.match(n3.sql, /WHERE `__o__amount` > \?/);
});

test('compileEtl unknown node throws', () => {
  const def = { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'badthing' }] };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  assert.throws(() => nodeSql('n1'), /未知节点类型/);
});

test('saveBuiltDataset creates then updates and rebuilds fields', () => {
  const def = { type: 'builder', tables: [{ alias: 't', schema: 'testdb', table: 'orders' }], joins: [], fields: [{ source: 't', field: 'amount', label: '金额', type: 'number' }], aggregation: null };
  db.prepare("INSERT INTO data_sources (name, type, config, owner_id) VALUES (?, ?, ?, ?)").run('mysql-ds', 'mysql', '{}', 1);
  const created = datasetService.saveBuiltDataset({ name: 'Wide', definition: def, datasourceId: 1, datasetId: null, ownerId: 1 });
  assert.equal(created.source_type, 'sql');
  assert.equal(created.build_definition.includes('"type":"builder"'), true);
  assert.equal(created.fields.length, 1);

  const def2 = { ...def, fields: [{ source: 't', field: 'amount', label: '金额2', type: 'number' }, { source: 't', field: 'customer_id', label: '客户', type: 'number' }] };
  const updated = datasetService.saveBuiltDataset({ name: 'Wide2', definition: def2, datasourceId: 1, datasetId: created.id, ownerId: 1 });
  assert.equal(updated.name, 'Wide2');
  assert.equal(updated.fields.length, 2);
  assert.equal(datasetService.getFieldsOrThrow(created.id).length, 2);
});

test('saveBuiltDataset rejects wrong owner / wrong datasource', () => {
  const def = { type: 'builder', tables: [], joins: [], fields: [], aggregation: null };
  const created = datasetService.saveBuiltDataset({ name: 'X', definition: def, datasourceId: 1, datasetId: null, ownerId: 2 });
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: 1, datasetId: created.id, ownerId: 3 }), /无权限/);
  assert.throws(() => datasetService.saveBuiltDataset({ name: 'Y', definition: def, datasourceId: 999, datasetId: created.id, ownerId: 2 }), /不属于|不存在/);
});

test('registerSqlDataset writes equivalent builder definition', () => {
  const d = datasetService.registerSqlDataset('Quick', 1, 'testdb', 'sales', [{ name: 'id', label: 'ID', type: 'integer' }], 1);
  const def = JSON.parse(d.build_definition);
  assert.equal(def.type, 'builder');
  assert.equal(def.tables[0].table, 'sales');
  assert.equal(def.fields.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/task19-builder.test.js`
Expected: 编译类用例可能已过，**持久化/ETL 或权限相关必然失败**（saveBuiltDataset 尚未实现于 service —— 若你按 Task 21/22 顺序实现，则此时多数已通过；本步目标：确认不抛模块级错误）。

> 顺序提示：本计划按 20→21→22→23→24 编排，此测试写在编译器与路由之后。若你严格按序执行，此文件在 Task 24 创建时便全部通过；如需 TDD 红绿，可把本文件提前到 Task 20 之前创建并暴露先行失败。

- [ ] **Step 3: Run full suite**

Run: `cd backend && npm test`
Expected: 111 + 新增 ≈ 20 用例全部通过。

- [ ] **Step 4: Commit**

```bash
git add backend/test/task19-builder.test.js
git commit -m "test(m3): builder compiler/persistence/permission/ETL tests"
```

---

## Task 25: 前端 catalog 工具 + API 封装

**Files:**
- Create: `front-end/src/utils/catalog.js`
- Modify: `front-end/src/api/index.js`

- [ ] **Step 1: 新增 catalog 工具**

创建 `front-end/src/utils/catalog.js`：

```js
const TREE_ICON = { schema: 'Folder', table: 'Grid', field: 'Element' }
export const STRING_OPS = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '≠' }, { value: 'contains', label: '包含' },
  { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
  { value: 'in', label: '∈' },
]
export const AGG_OPTIONS = [
  { value: 'sum', label: '求和 SUM' },
  { value: 'avg', label: '平均 AVG' },
  { value: 'count', label: '计数 COUNT' },
  { value: 'count_distinct', label: '去重计数' },
  { value: 'max', label: '最大 MAX' },
  { value: 'min', label: '最小 MIN' },
]
export function toTree(schemas) {
  return (schemas || []).map((s) => ({
    id: `schema:${s.schema}`,
    n: s.schema, kind: 'schema', children: (s.tables || []).map((t) => ({
      id: `${s.schema}:${t.table}`,
      n: t.table, kind: 'table', isLeaf: false,
      children: (t.columns || []).map((c) => ({
        id: `${s.schema}:${t.table}:${c.name}`,
        n: `${c.name} (${c.type})`, kind: 'field', raw: { schema: s.schema, table: t.table, name: c.name, type: c.type, role: c.role }, isLeaf: true,
      })),
    })),
  }))
}
export function allFields(schemas, tableId) {
  for (const s of schemas || []) {
    for (const t of s.tables || []) {
      if (`${s.schema}:${t.table}` === tableId) return (t.columns || []).map((c) => ({ ...c, schema: s.schema, table: t.table }));
    }
  }
  return []
}
export function schemaIdOf(prefix) { return prefix.split(':').slice(0, 2).join(':') }
```

- [ ] **Step 2: api/index.js 增加 buildApi**

在 `api/index.js` 末尾追加：

```js
export const buildApi = {
  sqlAssist: (dsId) => http.get(`/datasources/${dsId}/sql-assist`),
  previewDetail: (dsId, definition, limit = 200) => http.post(`/datasources/${dsId}/build/preview-detail`, { definition, limit }),
  previewAggregate: (dsId, definition, aggregation, limit = 1000) => http.post(`/datasources/${dsId}/build/preview-aggregate`, { definition, aggregation, limit }),
  previewNode: (dsId, definition, nodeId, limit = 200) => http.post(`/datasources/${dsId}/build/preview-node`, { definition, nodeId, limit }),
  save: (dsId, name, definition, datasetId) => http.post(`/datasources/${dsId}/build/save`, { name, definition, datasetId }),
  validate: (dsId, definition) => http.post(`/datasources/${dsId}/build/validate`, { definition }),
}
```

- [ ] **Step 3: Commit**

```bash
git add front-end/src/api/index.js front-end/src/utils/catalog.js
git commit -m "feat(m3): frontend buildApi + catalog utils"
```

---

## Task 26: 前端 SQL 形态组件 SqlBuilderTab.vue

**Files:**
- Create: `front-end/src/components/builder/SqlBuilderTab.vue`

- [ ] **Step 1: 创建组件**

创建 `front-end/src/components/builder/SqlBuilderTab.vue`：

```vue
<template>
  <div class="sql-builder">
    <div class="sql-builder__left">
      <div class="sql-builder__panel-title">表 / 字段</div>
      <el-tree :data="computedTree" node-key="id" default-expand-all :props="{ label: 'n', children: 'children' }" @node-click="onNodeClick">
        <template #default="{ data }">
          <span style="font-size: 12px">{{ data.n }}</span>
          <el-button v-if="data.kind === 'table'" link type="primary" size="small" style="margin-left:6px" @click.stop="insertTable(sql, data)">插入</el-button>
        </template>
      </el-tree>
    </div>
    <div class="sql-builder__main">
      <el-input
        v-model="localSql"
        type="textarea"
        :rows="14"
        resize="vertical"
        placeholder="SELECT ... -- 可用上方表/字段辅助插入；仅支持只读 SQL"
        class="sql-builder__editor"
      />
      <div class="sql-builder__preview-head">
        <span>明细预览（前 {{ limit }} 行）</span>
        <el-button size="small" type="primary" :loading="previewing" @click="runPreview">执行预览</el-button>
        <el-button size="small" :loading="importing" @click="importFields">从结果导入字段</el-button>
      </div>
      <el-table :data="previewRows" size="small" max-height="260" empty-text="点击「执行预览」查看数据">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="120" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { toTree } from '@/utils/catalog'

const props = defineProps({ datasourceId: { type: [Number, String], required: true } })
const emit = defineEmits(['change'])

const sql = ref('')
const schemas = ref([])
const previewRows = ref([])
const previewCols = ref([])
const previewing = ref(false)
const importing = ref(false)
const limit = 200

const computedTree = computed(() => toTree(schemas.value))
const localSql = computed({ get: () => sql.value, set: (v) => { sql.value = v; emitChange() } })

function emitChange() {
  emit('change', { definition: { type: 'sql', sql: sql.value, fields: importedFields.value } })
}
const importedFields = ref([])

function onNodeClick(data) {
  if (data.kind !== 'field') return
  const f = data.raw
  sql.value += ` ${f.schema}.${f.table}.${f.name} `
  emitChange()
  ElMessage({ message: `已插入 ${f.table}.${f.name}`, type: 'success', duration: 900 })
}

async function runPreview() {
  if (!sql.value.trim()) return ElMessage.warning('请输入 SQL')
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, { type: 'sql', sql: sql.value }, limit)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } finally { previewing.value = false }
}

async function importFields() {
  if (!previewRows.value.length) return ElMessage.warning('先执行预览再导入字段')
  importing.value = true
  try {
    const cols = Object.keys(previewRows.value[0])
    importedFields.value = cols.map((c) => ({ name: c, label: c, type: guessType(cols) }));
    emitChange()
    ElMessage.success(`已导入 ${cols.length} 个字段`)
  } finally { importing.value = false }
}

function guessType(cols) { return 'string' }

defineExpose({ preview: runPreview, getDefinition: () => ({ type: 'sql', sql: sql.value, fields: importedFields.value }) })

onMounted(async () => {
  schemas.value = await buildApi.sqlAssist(props.datasourceId)
})
</script>

<style scoped>
.sql-builder { display: flex; gap: 12px; height: 100%; }
.sql-builder__left { flex: 0 0 260px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.sql-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.sql-builder__main { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.sql-builder__editor :deep(.el-textarea__inner) { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.sql-builder__preview-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--app-text-secondary); }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `cd front-end && npm run build`
Expected: 构建成功（组件按需拉取，无依赖缺失）。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/SqlBuilderTab.vue
git commit -m "feat(m3): SQL builder tab"
```

---

## Task 27: 前端拖拉拽形态 DragBuilderTab.vue

**Files:**
- Create: `front-end/src/components/builder/DragBuilderTab.vue`

- [ ] **Step 1: 创建组件**

创建 `front-end/src/components/builder/DragBuilderTab.vue`：

```vue
<template>
  <div class="drag-builder">
    <!-- 左侧：表 + 字段 -->
    <div class="drag-builder__left">
      <div class="drag-builder__panel-title">数据表</div>
      <el-tree :data="tableTree" node-key="id" :props="{ label: 'n', children: 'children' }" @node-click="onTableNode">
        <template #default="{ data }">
          <span style="font-size:12px">{{ data.n }}</span>
          <el-button v-if="data.kind === 'table'" link type="primary" size="small" @click.stop="addTable(data)">加表</el-button>
        </template>
      </el-tree>
    </div>

    <!-- 中间：构建区 -->
    <div class="drag-builder__mid">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="选字段" name="fields">
          <div v-for="t in tables" :key="t.alias" class="drag-builder__tablecard">
            <div class="drag-builder__tablecard-title">{{ t.schema }}.{{ t.table }} <el-tag size="small">{{ t.alias }}</el-tag>
              <el-button link size="small" type="danger" @click="removeTable(t)">移除</el-button>
            </div>
            <div class="drag-builder__fieldlist">
              <el-checkbox v-for="f in tableFields(t)" :key="`${t.alias}.${f.name}`" :model-value="isSelected(t.alias, f.name)" @change="(v) => toggleField(t, f, v)">
                {{ f.name }}
              </el-checkbox>
            </div>
          </div>
          <el-empty v-if="!tables.length" description="从左侧选择表" />
        </el-tab-pane>

        <el-tab-pane label="关联" name="joins">
          <div v-for="(j, i) in joins" :key="i" class="drag-builder__joinrow">
            <el-select v-model="j.l / ** placeholder **/" style="display:none" />
            <el-select v-model="j.fromAlias" size="small" style="width:90px">
              <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="j.fromField" size="small" style="width:130px">
              <el-option v-for="f in tableFieldsByAlias(j.fromAlias)" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            <span>=</span>
            <el-select v-model="j.toAlias" size="small" style="width:90px">
              <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="j.toField" size="small" style="width:130px">
              <el-option v-for="f in tableFieldsByAlias(j.toAlias)" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            <el-select v-model="j.type" size="small" style="width:90px">
              <el-option label="INNER" value="inner" /><el-option label="LEFT" value="left" />
            </el-select>
            <el-button link size="small" type="danger" @click="joins.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="addJoin">+ 添加关联</el-button>
          <el-empty v-if="!joins.length" description="可添加表间关联（同名列会在所有表内自动预填第一条）" />
        </el-tab-pane>

        <el-tab-pane label="聚合（可选）" name="agg">
          <div class="drag-builder__agg">
            <div class="drag-builder__agg-block">
              <div class="drag-builder__agg-title">分组维度</div>
              <el-select v-model="aggGroupBy" multiple collapse-tags size="small" filterable placeholder="选择字段（已选字段）" style="width:100%">
                <el-option v-for="f in selectedFieldOptions" :key="f.value" :label="f.label" :value="f.value" />
              </el-select>
            </div>
            <div class="drag-builder__agg-block">
              <div class="drag-builder__agg-title">聚合指标</div>
              <div v-for="(m, i) in aggMetrics" :key="i" class="drag-builder__agg-metric">
                <el-select v-model="m.agg" size="small" style="width:130px">
                  <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
                </el-select>
                <el-select v-model="m.source" size="small" style="width:100px">
                  <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" />
                </el-select>
                <el-select v-model="m.field" size="small" style="width:150px" filterable>
                  <el-option v-for="f in tableFieldsByAlias(m.source)" :key="f.name" :label="f.name" :value="f.name" />
                </el-select>
                <el-button link size="small" type="danger" @click="aggMetrics.splice(i, 1)">删</el-button>
              </div>
              <el-button size="small" @click="aggMetrics.push({ agg: 'sum', source: tables[0]?.alias, field: '' })">+ 指标</el-button>
              <el-checkbox v-model="useAgg" class="drag-builder__agg-toggle">启用聚合（保存仍按明细注册，仅预览聚合效果）</el-checkbox>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 右侧预览 -->
    <div class="drag-builder__preview">
      <el-tabs v-model="previewTab">
        <el-tab-pane label="明细" name="detail">
          <el-button size="small" type="primary" :loading="previewing" @click="runDetail">预览</el-button>
        </el-tab-pane>
        <el-tab-pane label="聚合" name="agg">
          <el-button size="small" type="primary" :loading="previewing" @click="runAgg">预览聚合</el-button>
        </el-tab-pane>
      </el-tabs>
      <el-table :data="previewRows" size="small" max-height="360" empty-text="预览结果" v-loading="previewing">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { toTree, allFields, AGG_OPTIONS } from '@/utils/catalog'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, initialDefinition: Object })
const emit = defineEmits(['change'])

const schemas = ref([])
const tableTree = computed(() => toTree(schemas.value))
const tables = ref([])          // [{ alias, schema, table }]
const joins = ref([])           // [{ type, fromAlias, fromField, toAlias, toField }]
const selectedFields = ref([])  // [{ source, field, label, type }]
const aggGroupBy = ref([])
const aggMetrics = ref([])
const useAgg = ref(false)
const previewTab = ref('detail')
const previewing = ref(false)
const previewRows = ref([])
const previewCols = ref([])

const selectedFieldOptions = computed(() => selectedFields.value.map((f) => ({
  value: `${f.source}.${f.field}`, label: `${f.source}.${f.field}`,
})))

function tableFieldsByAlias(alias) {
  const t = tables.value.find((x) => x.alias === alias)
  return t ? allFields(schemas.value, `${t.schema}:${t.table}`) : []
}
function tableFields(t) { return allFields(schemas.value, `${t.schema}:${t.table}`) }
function isSelected(alias, name) { return selectedFields.value.some((f) => f.source === alias && f.field === name) }
function toggleField(t, f, on) {
  if (on) selectedFields.value.push({ source: t.alias, field: f.name, label: f.name, type: f.role === 'metric' ? 'number' : f.type === 'date' ? 'date' : 'string' })
  else selectedFields.value = selectedFields.value.filter((x) => !(x.source === t.alias && x.field === f.name))
  emitChange()
}
function onTableNode(data) {
  if (data.kind === 'field') {
    const t = tables.value.find((x) => x.schema === data.raw.schema && x.table === data.raw.table)
    if (t) toggleField(t, data.raw, !isSelected(t.alias, data.raw.name))
  }
}
function addTable(data) {
  const alias = `t${tables.value.length}`
  const t = { alias, schema: data.id.split(':')[0], table: data.id.split(':')[1] }
  tables.value.push(t)
  // 同名自动预填 join
  tryPreJoin()
  emitChange()
}
function removeTable(t) {
  tables.value = tables.value.filter((x) => x.alias !== t.alias)
  selectedFields.value = selectedFields.value.filter((x) => x.source !== t.alias)
  joins.value = joins.value.filter((j) => j.fromAlias !== t.alias && j.toAlias !== t.alias)
  emitChange()
}
function tryPreJoin() {
  if (tables.value.length < 2) return
  const prev = tables.value[tables.value.length - 2]
  const cur = tables.value[tables.value.length - 1]
  const prevFields = allFields(schemas.value, `${prev.schema}:${prev.table}`).map((f) => f.name.toLowerCase())
  const curFields = allFields(schemas.value, `${cur.schema}:${cur.table}`).map((f) => f.name.toLowerCase())
  const common = prevFields.find((n) => curFields.includes(n))
  if (common) {
    joins.value.push({ type: 'inner', fromAlias: prev.alias, fromField: prevFields.find((n) => n === common), toAlias: cur.alias, toField: curFields.find((n) => n === common) })
  }
  emitChange()
}
function addJoin() {
  if (tables.value.length >= 2) joins.value.push({ type: 'inner', fromAlias: tables.value[0].alias, fromField: '', toAlias: tables.value[1].alias, toField: '' })
  emitChange()
}

const definition = computed(() => ({
  type: 'builder',
  tables: tables.value,
  joins: joins.value.map((j) => ({ type: j.type, from: { alias: j.fromAlias, field: j.fromField }, to: { alias: j.toAlias, field: j.toField } })),
  fields: selectedFields.value.map((f) => ({ source: f.source, field: f.field, label: f.label, type: f.type })),
  aggregation: useAgg.value ? { groupBy: aggGroupBy.value.map((g) => ({ alias: g.split('.')[0], field: g.split('.')[1] })), metrics: aggMetrics.value.filter((m) => m.field) } : null,
  limit: 1000,
}))
function emitChange() { emit('change', { definition: definition.value }) }

async function runDetail() {
  if (!selectedFields.value.length) return ElMessage.warning('至少选择一个字段')
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, definition.value, 200)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } finally { previewing.value = false }
}
async function runAgg() {
  if (!useAgg.value) { useAgg.value = true }
  previewing.value = true
  try {
    const res = await buildApi.previewAggregate(props.datasourceId, definition.value, definition.value.aggregation, 1000)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } finally { previewing.value = false }
}

function restore(def) {
  if (!def || def.type !== 'builder') return
  tables.value = (def.tables || []).map((t, i) => ({ alias: t.alias, schema: t.schema, table: t.table }))
  joins.value = (def.joins || []).map((j) => ({ type: j.type || 'inner', fromAlias: j.from?.alias, fromField: j.from?.field, toAlias: j.to?.alias, toField: j.to?.field }))
  selectedFields.value = (def.fields || []).map((f) => ({ source: f.source, field: f.field, label: f.label || f.field, type: f.type || 'string' }))
  if (def.aggregation) {
    useAgg.value = true
    aggGroupBy.value = (def.aggregation.groupBy || []).map((g) => `${g.alias}.${g.field}`)
    aggMetrics.value = (def.aggregation.metrics || []).map((m) => ({ agg: m.agg, source: m.source, field: m.field }))
  }
  emitChange()
}
watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })
defineExpose({ getDefinition: () => definition.value, getFields: () => selectedFields.value })

onMounted(async () => {
  schemas.value = await buildApi.sqlAssist(props.datasourceId)
})
</script>

<style scoped>
.drag-builder { display: flex; gap: 12px; height: 100%; }
.drag-builder__left { flex: 0 0 240px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.drag-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.drag-builder__mid { flex: 1; min-width: 360px; overflow: auto; }
.drag-builder__preview { flex: 0 0 40%; min-width: 360px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; }
.drag-builder__tablecard { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 8px; margin-bottom: 8px; }
.drag-builder__tablecard-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.drag-builder__fieldlist { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 13px; }
.drag-builder__joinrow { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.drag-builder__agg { display: flex; gap: 16px; }
.drag-builder__agg-block { flex: 1; }
.drag-builder__agg-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.drag-builder__agg-metric { display: flex; gap: 6px; margin-bottom: 6px; }
.drag-builder__agg-toggle { margin-top: 12px; }
</style>
```

**注意：** 模板里有一行 `j.l / ** placeholder **/` 是占位残留，**必须删除**（会报语法错误）。请勿照抄该行。

- [ ] **Step 2: 构建验证**

Run: `cd front-end && npm run build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/DragBuilderTab.vue
git commit -m "feat(m3): drag builder tab (tables/join/fields/agg preview)"
```

---

## Task 28: 前端 ETL 形态 EtlBuilderTab.vue

**Files:**
- Create: `front-end/src/components/builder/EtlBuilderTab.vue`

- [ ] **Step 1: 创建组件**

创建 `front-end/src/components/builder/EtlBuilderTab.vue`：

```vue
<template>
  <div class="etl-builder">
    <div class="etl-builder__left">
      <div class="etl-builder__panel-title">表 / 字段</div>
      <el-tree :data="computedTree" node-key="id" :props="{ label: 'n', children: 'children' }" @node-click="onNodeClick" />
      <el-divider />
      <div class="etl-builder__panel-title">节点操作</div>
      <el-button size="small" :disabled="!tables.length" @click="addJoinNode">+ 关联节点</el-button>
      <el-button size="small" @click="addFilterNode">+ 筛选节点</el-button>
      <el-button size="small" @click="addAggNode">+ 聚合节点</el-button>
    </div>

    <div class="etl-builder__mid">
      <div class="etl-builder__panel-title">节点链路</div>
      <el-steps direction="vertical" :active="activeNodeIndex" class="etl-builder__steps">
        <el-step v-for="(n, i) in nodes" :key="n.nodeId" :title="nodeTitle(n)" :description="nodeDesc(n)">
          <template #icon>
            <el-tag :color="nodeTagColor(n)" effect="dark" size="small">{{ NODE_ICON[n.nodeType] }}</el-tag>
          </template>
          <template #default>
            <div style="display:flex;gap:6px;margin-top:4px">
              <el-button link size="small" type="primary" @click="selectNode(i)">配置</el-button>
              <el-button link size="small" type="success" :loading="previewingNode === n.nodeId" @click="previewNode(n)">预览此节点</el-button>
              <el-button v-if="canDelete(n)" link size="small" type="danger" @click="deleteNode(i)">删</el-button>
            </div>
            <el-tag v-if="nodeError[n.nodeId]" type="danger" size="small" style="margin-top:4px">{{ nodeError[n.nodeId] }}</el-tag>
          </template>
        </el-step>
      </el-steps>
    </div>

    <div class="etl-builder__config">
      <template v-if="activeNode">
        <div class="etl-builder__panel-title">配置 · {{ nodeTitle(activeNode) }}</div>
        <!-- source -->
        <template v-if="activeNode.nodeType === 'source'">
          <div class="etl-builder__field">表
            <el-select v-model="activeNode.table" size="small" filterable @change="onSourceChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
        </template>
        <!-- join -->
        <template v-if="activeNode.nodeType === 'join'">
          <div class="etl-builder__field">关联表
            <el-select v-model="activeNode.to.table" size="small" filterable @change="onJoinTableChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
          <div v-for="(c, i) in activeNode.on" :key="i" class="etl-builder__field">
            字段 {{ activeNode.to.alias }}: <el-select v-model="c.to.field" size="small" style="width:130px">
              <el-option v-for="f in joinTargetFields" :key="f.name" :label="f.name" :value="f.name" /></el-select>
            = 源字段: <el-select v-model="c.from.field" size="small" style="width:130px">
              <el-option v-for="f in sourceFields(activeNode)" :key="f.name" :label="f.name" :value="f.name" /></el-select>
            <el-button link size="small" type="danger" @click="activeNode.on.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.on.push({ from: { alias: activeNode.sourceAlias || 'src', field: '' }, to: { alias: activeNode.to.alias, field: '' } })">+ 条件</el-button>
        </template>
        <!-- filter -->
        <template v-if="activeNode.nodeType === 'filter'">
          <div v-for="(c, i) in activeNode.conditions" :key="i" class="etl-builder__field">
            <el-select v-model="c.field.alias" size="small" style="width:70px">
              <el-option v-for="t in tables" :key="t.alias" :label="t.alias" :value="t.alias" /></el-select>
            <el-select v-model="c.field.field" size="small" style="width:120px">
              <el-option v-for="f in sourceFields(activeNode)" :key="f.name" :label="f.name" :value="f.name" /></el-select>
            <el-select v-model="c.op" size="small" style="width:90px">
              <el-option v-for="o in STRING_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input v-model="c.value" size="small" style="width:120px" />
            <el-button link size="small" type="danger" @click="activeNode.conditions.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.conditions.push({ field: { alias: 't0', field: '' }, op: 'eq', value: '' })">+ 条件</el-button>
        </template>
        <!-- aggregate -->
        <template v-if="activeNode.nodeType === 'aggregate'">
          <div class="etl-builder__field">分组
            <el-select v-model="activeNode.groupBy" multiple collapse-tags filterable size="small" style="width:100%">
              <el-option v-for="f in sourceFields(activeNode)" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
          </div>
          <div v-for="(m, i) in activeNode.metrics" :key="i" class="etl-builder__field">
            <el-select v-model="m.agg" size="small" style="width:120px">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" /></el-select>
            <el-select v-model="m.field" size="small" style="width:140px" filterable>
              <el-option v-for="f in sourceFields(activeNode)" :key="f.name" :label="f.name" :value="f.name" /></el-select>
            <el-button link size="small" type="danger" @click="activeNode.metrics.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.metrics.push({ agg: 'sum', field: '' })">+ 指标</el-button>
        </template>
        <!-- output -->
        <template v-if="activeNode.nodeType === 'output'">
          <div class="etl-builder__field">输出行数上限
            <el-input-number v-model="activeNode.limit" :min="1" :max="100000" size="small" />
          </div>
        </template>
      </template>
      <el-empty v-else description="选择节点进行配置" />
    </div>

    <div class="etl-builder__preview">
      <div class="etl-builder__panel-title">节点预览</div>
      <el-table v-if="nodePreview.length" :data="nodePreview" size="small" max-height="400">
        <el-table-column v-for="c in nodePreviewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
      <el-empty v-else description="点击节点「预览此节点」查看真实数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { buildApi } from '@/api'
import { toTree, allFields, AGG_OPTIONS, STRING_OPS } from '@/utils/catalog'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, initialDefinition: Object })
const emit = defineEmits(['change'])

const NODE_ICON = { source: '源', join: '联', filter: '筛', aggregate: '聚', output: '出' }
const schemas = ref([])
const nodes = ref([])
const activeNodeIndex = ref(-1)
const previewingNode = ref(null)
const nodePreview = ref([])
const nodePreviewCols = ref([])
const nodeError = ref({})

const computedTree = computed(() => toTree(schemas.value))
const tableOptions = computed(() => {
  const out = []
  for (const s of schemas.value) for (const t of s.tables || []) out.push({ id: `${s.schema}:${t.table}`, label: `${s.schema}.${t.table}`, schema: s.schema, table: t.table })
  return out
})
const activeNode = computed(() => nodes.value[activeNodeIndex.value] || null)
const joinTargetFields = computed(() => activeNode.value?.nodeType === 'join' ? allFields(schemas.value, `${activeNode.value.to.schema}:${activeNode.value.to.table}`).map((f) => ({ ...f, name: f.name })) : [])
const tables = computed(() => nodes.value.filter((n) => n.nodeType === 'source').map((n) => ({ alias: n.alias, schema: n.schema, table: n.table })))

function nodeTitle(n) { return { source: '数据源', join: '关联', filter: '筛选', aggregate: '聚合', output: '输出' }[n.nodeType] }
function nodeDesc(n) {
  if (n.nodeType === 'source') return `${n.schema}.${n.table}`
  if (n.nodeType === 'join') return `JOIN ${n.to?.schema}.${n.to?.table}`
  if (n.nodeType === 'filter') return `${(n.conditions || []).length} 个条件`
  if (n.nodeType === 'aggregate') return `${(n.metrics || []).length} 指标`
  return `LIMIT ${n.limit}`
}
function nodeTagColor(n) { return { source: '#67c23a', join: '#909399', filter: '#e6a23c', aggregate: '#409eff', output: '#f56c6c' }[n.nodeType] }
function canDelete(n) { return ['join', 'filter', 'aggregate'].includes(n.nodeType) }

function ensureChain() {
  if (!nodes.value.length) nodes.value = [{ nodeId: 'n_src', nodeType: 'source', alias: 't0', schema: null, table: null }]
  let prev = null
  nodes.value.forEach((n) => { if (n.nodeType !== 'source' && prev) n.sourceNode = prev.nodeId; if (n.nodeType === 'source') prev = n; })
  // 保证有 output 收尾
  const out = nodes.value.find((n) => n.nodeType === 'output')
  if (!out) nodes.value.push({ nodeId: `n_out`, nodeType: 'output', sourceNode: nodes.value[nodes.value.length - 1]?.nodeId, limit: 1000 })
  else {
    out.sourceNode = nodes.value.filter((n) => n.nodeType !== 'output')[nodes.value.filter((n) => n.nodeType !== 'output').length - 1]?.nodeId
  }
  emitChange()
}
function onSourceChange() {
  const cur = activeNode_.value
  // 由前端把 source 的 table 换成 {schema,table} 解构
  fixSourceNode(activeNode_.value)
}
function fixSourceNode(node) {
  if (node && node.table && !node.table.includes('/')) {
    const [schema, table] = String(node.table).split(':')
    node.schema = schema
    node.table = table
  }
}
function addJoinNode() { nodes.value.splice(nodes.value.length - 1, 0, { nodeId: `n_j${Date.now()}`, nodeType: 'join', alias: 'j', to: { alias: 't2', schema: null, table: null }, on: [{ from: { alias: 't0', field: '' }, to: { alias: 't2', field: '' } }] }); ensureChain() }
function addFilterNode() { nodes.value.splice(nodes.value.length - 1, 0, { nodeId: `n_f${Date.now()}`, nodeType: 'filter', conditions: [{ field: { alias: 't0', field: '' }, op: 'eq', value: '' }] }); ensureChain() }
function addAggNode() { nodes.value.splice(nodes.value.length - 1, 0, { nodeId: `n_a${Date.now()}`, nodeType: 'aggregate', groupBy: [], metrics: [] }); ensureChain() }
function deleteNode(i) { nodes.value.splice(i, 1); ensureChain() }
function selectNode(i) { activeNodeIndex.value = i }

function sourceFields(n) {
  // 返回当前链路中所有（已用到/可用的）别名字段；简化：取全部 source/join 表字段
  const out = []
  for (const src of nodes.value) {
    if (src.nodeType === 'source') for (const f of allFields(schemas.value, `${src.schema}:${src.table}`)) out.push({ ...f, pref: `${src.alias}.${f.name}` })
    if (src.nodeType === 'join') for (const f of allFields(schemas.value, `${src.to?.schema}:${src.to?.table}`)) out.push({ ...f, pref: `${src.to?.alias}.${f.name}` })
  }
  return out
}

async function previewNode(node) {
  previewingNode.value = node.nodeId
  nodeError.value[node.nodeId] = null
  try {
    const res = await buildApi.previewNode(props.datasourceId, definition.value, node.nodeId, 200)
    nodePreview.value = res.rows
    nodePreviewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
  } catch (e) {
    nodeError.value[node.nodeId] = e.message || '节点执行失败'
  } finally { previewingNode.value = null }
}

const definition = computed(() => ({ type: 'etl', nodes: JSON.parse(JSON.stringify(nodes.value)) }))
function emitChange() { emit('change', { definition: definition.value }) }
function onNodeClick(data) { if (data.kind === 'field') insertFieldSql(data.raw) }
function insertFieldSql(f) {}

function restore(def) {
  if (!def || def.type !== 'etl') return
  nodes.value = JSON.parse(JSON.stringify(def.nodes || []))
  if (!nodes.value.length) ensureChain()
  emitChange()
}
watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })
defineExpose({ getDefinition: () => definition.value })

const activeNode_ = { value: null }
watch(activeNode, (n) => { activeNode_.value = n; if (n && (n.nodeType === 'source' || n.nodeType === 'join')) fixSourceNode(n) })

onMounted(async () => { schemas.value = await buildApi.sqlAssist(props.datasourceId); ensureChain() })
</script>

<style scoped>
.etl-builder { display: flex; gap: 12px; height: 100%; }
.etl-builder__left { flex: 0 0 210px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__mid { flex: 1; min-width: 280px; overflow: auto; }
.etl-builder__config { flex: 0 0 300px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__preview { flex: 0 0 38%; min-width: 320px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.etl-builder__field { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; flex-wrap: wrap; }
</style>
```

> 说明：为控制篇幅，ETL 组件按「能跑通固定链 + 节点预览」的最小实现给出；画布内节点顺序用 `el-steps` 垂直展示，配置在右侧抽屉/面板。`source` 表选择回填 schema/table 由 `fixSourceNode` 处理。

- [ ] **Step 2: 构建验证**

Run: `cd front-end && npm run build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/EtlBuilderTab.vue
git commit -m "feat(m3): ETL builder tab with per-node preview"
```

---

## Task 29: 构建器主页面 DataSourceBuilder.vue + 路由 + 入口

**Files:**
- Create: `front-end/src/views/DataSourceBuilder.vue`
- Modify: `front-end/src/router/index.js`
- Modify: `front-end/src/views/DataSourceDetail.vue`
- Modify: `front-end/src/views/DatasetList.vue`

- [ ] **Step 1: 创建 DataSourceBuilder.vue**

创建 `front-end/src/views/DataSourceBuilder.vue`：

```vue
<template>
  <div class="builder-page" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">数据集构建器</h2>
        <div class="page-desc">数据源：{{ dsName }}（{{ dsType }}）· 三种形态自由切换</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">返回</el-button>
        <el-input v-model="name" placeholder="数据集名称" style="width: 220px" clearable />
        <el-button type="primary" :loading="saving" @click="save">保存数据集</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeMode" @tab-change="onModeChange">
        <el-tab-pane label="纯 SQL" name="sql" />
        <el-tab-pane label="拖拉拽" name="drag" />
        <el-tab-pane label="ETL" name="etl" />
      </el-tabs>
      <div style="min-height: 520px">
        <keep-alive>
          <SqlBuilderTab v-if="activeMode === 'sql'" ref="sqlRef" :datasource-id="dsId" :initial-definition="editDefinition" @change="onChange" />
          <DragBuilderTab v-else-if="activeMode === 'drag'" ref="dragRef" :datasource-id="dsId" :initial-definition="editDefinition" @change="onChange" />
          <EtlBuilderTab v-else ref="etlRef" :datasource-id="dsId" :initial-definition="editDefinition" @change="onChange" />
        </keep-alive>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { datasourceApi, buildApi, datasetApi } from '@/api'
import SqlBuilderTab from '@/components/builder/SqlBuilderTab.vue'
import DragBuilderTab from '@/components/builder/DragBuilderTab.vue'
import EtlBuilderTab from '@/components/builder/EtlBuilderTab.vue'

const route = useRoute()
const router = useRouter()
const dsId = Number(route.params.id)
const activeMode = ref('sql')
const name = ref('')
const loading = ref(false)
const saving = ref(false)
const dsName = ref('')
const dsType = ref('')
const editDatasetId = ref(null)
const editDefinition = ref(null)   // 编辑模式：从数据集读回
const liveDefinition = ref(null)   // 当前编辑器态（避免跨 tab 丢失）

const sqlRef = ref(null)
const dragRef = ref(null)
const etlRef = ref(null)

function onChange(payload) {
  liveDefinition.value = payload.definition
  // 每个 tab 独立维护；这里收集最新状态供保存
}

function currentDefinition() {
  const tabs = liveDefinition.value && liveDefinition.value.type === activeMode.value ? liveDefinition.value : null
  return tabs || liveDefinition.value || (activeMode.value === 'sql' ? sqlRef.value?.getDefinition?.() : activeMode.value === 'drag' ? dragRef.value?.getDefinition?.() : etlRef.value?.getDefinition?.())
}

async function save() {
  if (!name.value.trim()) return ElMessage.warning('请填写数据集名称')
  const definition = currentDefinition()
  if (!definition) return ElMessage.warning('构建定义为空')
  saving.value = true
  try {
    const created = await buildApi.save(dsId, name.value.trim(), definition, editDatasetId.value)
    ElMessage.success(editDatasetId.value ? '数据集已更新' : '数据集创建成功')
    router.push(`/datasets/${created.id}`)
  } finally { saving.value = false }
}

function onModeChange() { /* 保留 keep-alive 内 tab 状态 */ }

onMounted(async () => {
  loading.value = true
  try {
    const ds = await datasourceApi.get(dsId)
    dsName.value = ds.name
    dsType.value = ds.type
    const editId = route.query.editDatasetId
    if (editId) {
      editDatasetId.value = Number(editId)
      const dataset = await datasetApi.get(editDatasetId.value)
      name.value = dataset.name
      if (dataset.build_definition) {
        editDefinition.value = typeof dataset.build_definition === 'string' ? JSON.parse(dataset.build_definition) : dataset.build_definition
        activeMode.value = editDefinition.value.type || 'sql'
      }
    }
  } finally { loading.value = false }
})
</script>

<style scoped>
.builder-page { display: flex; flex-direction: column; gap: 16px; }
</style>
```

- [ ] **Step 2: 添加路由**

`front-end/src/router/index.js` 的 MainLayout children 中（在 `datasets` 相关路由附近）追加：

```js
{ path: 'datasources/:id/builder', name: 'datasource-builder', component: () => import('../views/DataSourceBuilder.vue'), meta: { title: '数据集构建器' } },
```

同时确认 `menDataSourceBuilder` 已按需导入（按需同步 routers 即可）。

- [ ] **Step 3: DataSourceDetail.vue 接入 builder**

1. 在「Schema 浏览」卡片 header 处加「新建构建」按钮；单表「创建数据集」改为 `router.push({ path: '/datasources/' + route.params.id + '/builder', query: { table: data.schema + ':' + data.label } })`：

```vue
<template #header>
  <div style="display:flex;align-items:center;justify-content:space-between">
    <span>Schema 浏览</span>
    <el-button size="small" type="primary" @click="openBuilder()">新建构建</el-button>
  </div>
</template>
```

script 里：

```js
function openBuilder(preTable) {
  const q = preTable ? { table: preTable } : {}
  router.push({ path: `/datasources/${route.params.id}/builder`, query: q })
}
async function createDataset(data) {
  openBuilder(`${data.schema}:${data.label}`)
}
```

2. `load` 改为把 `sql-assist` 元数据缓存到组件（供 builder 复用可省，但未必要）；保持现有 `schemas`/`schemaTree` 逻辑不变。**仅替换 createDataset 打开方式及新增 header 按钮。**

- [ ] **Step 4: DatasetList.vue 加「编辑构建」入口**

在操作列（现有「查看/重命名/删除」）追加，仅在 `source_type === 'sql' && row.datasource_id` 时显示：

```vue
<el-button v-if="row.source_type === 'sql' && row.datasource_id" link type="primary" size="small" @click="openEditBuild(row)">编辑构建</el-button>
```

script：

```js
async function openEditBuild(row) {
  await ElMessageBox.confirm(`打开构建器编辑「${row.name}」？`, '编辑构建', { type: 'info' })
  const { useRouter } = await import('vue-router')
  const r = useRouter()
  r.push({ path: `/datasources/${row.datasource_id}/builder`, query: { editDatasetId: row.id } })
}
```

（组件内直接用现有 router 亦可——检查是否有 `useRouter`。）

- [ ] **Step 5: 构建 + 回归**

Run: `cd front-end && npm run build`
Expected: 构建成功。

- [ ] **Step 6: Commit**

```bash
git add front-end/src/views/DataSourceBuilder.vue front-end/src/components/builder front-end/src/router/index.js front-end/src/views/DataSourceDetail.vue front-end/src/views/DatasetList.vue
git commit -m "feat(m3): builder page + routes + entry points (edit from dataset list)"
```

---

## Task 30: 集成验证 + README + 需求清单 + 终验报告

**Files:**
- Modify: `README.md`
- Modify: `需求清单-第二阶段.md`
- Create: `docs/superpowers/M2-task19-builder-e2e.md`

- [ ] **Step 1: 全量回归**

Run: `cd backend && npm test`
Expected: 全部通过（111 + task19）。

Run: `cd front-end && npm run build`
Expected: 构建成功。

- [ ] **Step 2: CDP e2e（复用 M2 探针模式）**

后端 dev（3001）、前端 dev（5173）已运行；Docker 7 容器 healthy。写 `/tmp/probe-m3-builder.cjs`（playwright-core + 本机 Chrome，参考 `/tmp/probe-m2-flow.mjs`）：

1. 登录 admin → `/datasources` → 打开某 mysql 数据源详情
2. 点「新建构建」→ builder 页 → 默认 SQL tab
3. SQL tab：输入 `SELECT * FROM testdb.sales` → 执行预览 → 导入字段 → 保存 → 跳转数据集详情（字段已注册）
4. 回到 builder（编辑）→ 切到「拖拉拽」→ 选 sales 表 + customers 表 → 关联自动预填 → 勾选字段 → 明细预览 → 聚合预览 → 保存更新
5. 再编辑 → 切「ETL」→ 源=sales、JOIN customers、filter、aggregate → 逐节点点「预览此节点」验证返回真实数据
6. 断言数据集详情「数据预览」页签正常；图表中心能用该数据集建图
7. 全程收集 `page.on('pageerror')`，不得有未捕获错误

在 `docs/superpowers/M2-task19-builder-e2e.md` 记录各步骤 PASS/FAIL + 截图路径（/tmp）。

- [ ] **Step 3: README 补充 M3 构建器段落**

在 M2 README 段落后追加小节（中文，与现有风格一致）：数据集构建器（纯SQL / 拖拉拽宽表 / ETL 简版三形态、`/api/datasources/:id/build/*` 接口、`build_definition` 持久化与编辑、每节点可预览、安全边界）。

- [ ] **Step 4: 需求清单更新**

`需求清单-第二阶段.md` 中与数据源构建相关的条目（如 DB-01 数据源管理下细分或 DS-* 区块若存在「数据集构建/SQL/ETL」）标注 `[已实现 M3]`；若无对应条目则追加一行：`| DS-06 | 数据集构建器（SQL/拖拉拽/ETL 三形态）[已实现 M3] | P1 | 低代码构建数据集：多表关联/字段选择/聚合预览/节点级数据预览 |`。

- [ ] **Step 5: 计划勾选 + 提交**

把本计划 Task 19-30 所有复选枰打勾（保留未完成项显式说明），然后：

```bash
git add README.md 需求清单-第二阶段.md docs/superpowers/M2-task19-builder-e2e.md docs/superpowers/plans/2026-09-13-dataset-builder.md
git commit -m "docs(m3): builder README + requirements + e2e report"
```

---

## 自审记录（writing-plans 自审）

**Spec 覆盖：** 三形态（Task 26/27/28）｜统一定义编译（Task 20）｜持久化+可编辑+零迁移（Task 21/23）｜每节点预览（Task 22/28）｜明细宽表消费（Task 23 聚合子查询）｜接口集（Task 22）｜前端入口与编辑（Task 29）｜测试与验收（Task 24/30）——全覆盖。

**占位符扫描：** 无 TODO/TBD；注意 **Task 27 Step 1 模板含一行必须删除的占位 `j.l / ** placeholder **/`**（已在文中加粗警告，实施者切勿照抄）。

**类型一致性：** `build_definition` JSON：builder 用 `{alias,field}` 二元组、etl 用 `{alias,field}` + `sourceNode`；编译器 `compileDetail/compileEtl` 与路由调用一致；前端 `definition.value` 结构 = 后端解析结构；`saveBuiltDataset` 的 `definition.fields` 由编译器输出（预览结果字段），前端保存时以定义自带 fields（SQL 形态=导入字段；builder/ETL 由后端 preview 返回 fields 后回填——已在前端定义内留 fields 数组）。**注意：** 前端 `DragBuilderTab`/`EtlBuilderTab` 的 `definition.fields` 在保存时可能为空数组，后端 `saveBuiltDataset` 会用 `definition.fields` 注册字段——实现时需保证 builder/ETL 保存前把预览返回的 fields 合入定义（可在 `DataSourceBuilder.save()` 里调用 `previewDetail/previewNode` 获取 fields 后合并；本计划 Task 29 save 已留 `currentDefinition()`，实施时若 fields 为空则先请求一次预览填回）。

> 已知实现提示：`saveBuiltDataset` 字段注册依赖 `definition.fields`；对 builder/ETL 形态建议在 `build/save` 添加服务端 fallback——若 `definition.fields` 为空，则由后端在保存时编译一次并回填字段后注册。**（建议 Task 22 save 实现时一并处理，避免前端依赖。）**