# 数据集构建器（Dataset Builder）设计文档

- **日期**：2026-09-13
- **分支**：`feature/m2-datasources`
- **关联**：承接 M2 数据源接入（22 驱动注册表 / 协议族 Provider / AES-256-GCM / SqlDataProvider）

## 1. 目标与背景

M2 已支持将外部数据库单表注册为 SQL 数据集（`register-table` → `source_type='sql'`）。本设计将其扩展为**数据集构建器**：用户可在三种形态中自选，构建**多表宽表/汇总数据集**，且形态定义可持久化、可回源编辑。

三种形态（并存、用户自选，正式版本均需落地）：

1. **纯 SQL**：手写 SQL 生成数据集
2. **拖拉拽**：拖表 + 配关联 + 勾选字段（可选聚合），形成明细宽表
3. **ETL 简版**：固定节点链（源 → join → filter → aggregate → output），**每个节点可预览真实数据**

**本轮不做 AI**（AI 推关联 / NL2SQL / SQL 助手留待后续）。

### 消费模型

统一**明细宽表**消费：构建出的数据集在「图表中心」可见所有字段（= 宽表列），图表时再选维度/指标二次聚合，与现有 Excel 数据集体验一致。聚合可在构建器中可选预演（预览聚合页签），但保存时不固化聚合结果，只按明细字段注册。

## 2. 需求边界

- 角色：数据集读取（`datasource:read`）+ 资源 owner 隔离（`access.assertResource`）
- 支持的方言：现有 `dialects.js` 四族 —— `mysql`（含 mariadb/tidb/starrocks 等 family=mysql）、`pg`、`clickhouse`、`mssql`。仅 `capabilities.dataset === true` 的驱动可使用构建器
- 数据规模：节点/明细预览上限 200 行；聚合预览不受限
- 明确不做：AI 辅助、画布任意连线（完整 ETL）、物化中间表、跨库 JOIN、临时表/临时库
- 兼容：现有 `register-table`、老单表数据集（无 build_definition）零迁移

## 3. 架构总览

核心：**三种前端形态都产出结构化构建定义 JSON，后端统一编译为方言 SQL 并执行。**

```
前端三形态（SQL / 拖拉拽 / ETL）—— 各自产出 build_definition JSON
        │
        ▼
POST /api/datasources/:id/build/{preview-detail,preview-aggregate,preview-node,save,validate}
        │
        ▼
构建编译器 build-sql.js —— build_definition → 方言 SQL（quoteIdent 标识符 + placeholder 参数化）
        │
        ▼
协议族 Provider（mysql-family / pg-family / clickhouse / mssql）—— 真实执行
```

- 新增 `backend/src/datasources/build-sql.js`：纯函数编译器（无状态，可单测）
- 编辑器状态存内存（当前编辑态）；保存后定义落库 `datasets.build_definition`
- 查询消费路径不变：`/api/datasets/:id/rows`（paginate）与 `/query`（aggregate）在 sql 类别下走 SqlDataProvider，SqlDataProvider 内部改为"有 build_definition 则编译，无则按 schema/table 直查"。

## 4. 数据模型

### 4.1 `datasets` 新增列

```sql
ALTER TABLE datasets ADD COLUMN build_definition TEXT;
-- 存完整构建定义 JSON；null 表示老式单表数据集（兼容）
```

- `schema_name` / `table_name_ext` 仍写入（单表/宽表场景填主表；纯 SQL/ETL 场景可为 null）
- `datasource_id` 仍写入，用于编译时定位数据源类型与连接配置
- **零迁移**：老数据集无 `build_definition`，编译/预览/查询走回退逻辑（读 schema_name+table_name_ext 全列）

### 4.2 `build_definition` JSON 结构（三种形态）

```jsonc
// ① 纯 SQL
{ "type": "sql", "sql": "SELECT c.name ..." }

// ② 拖拉拽宽表
{ "type": "builder",
  "tables": [ { "alias": "o", "schema": "testdb", "table": "orders" },
              { "alias": "c", "schema": "testdb", "table": "customers" } ],
  "joins": [ { "type": "inner", "from": { "alias": "o", "field": "customer_id" },
               "to": { "alias": "c", "field": "id" } } ],
  "fields": [ { "source": "o", "field": "amount", "label": "金额", "type": "number" },
              { "source": "c", "field": "name", "label": "客户", "type": "string" } ],
  "aggregation": null /* 或 { "groupBy": ["c.name"], "metrics": [{ "source":"o","field":"amount","agg":"sum" }] } */ }

// ③ ETL 简版（固定节点链）
{ "type": "etl",
  "nodes": [
    { "nodeId": "n1", "nodeType": "source", "alias": "o", "schema": "testdb", "table": "orders" },
    { "nodeId": "n2", "nodeType": "join", "sourceNode": "n1",
      "to": { "alias": "c", "schema": "testdb", "table": "customers" },
      "on": [ { "from": { "alias": "o", "field": "customer_id" },
                "to":   { "alias": "c", "field": "id" },
                "joinType": "inner" } ] },
    { "nodeId": "n3", "nodeType": "filter", "sourceNode": "n2",
      "conditions": [ { "field": { "alias": "o", "field": "amount" }, "op": "gt", "value": 100 } ] },
    { "nodeId": "n4", "nodeType": "aggregate", "sourceNode": "n3",
      "groupBy": [ { "alias": "c", "field": "name" } ],
      "metrics": [ { "field": { "alias": "o", "field": "amount" }, "agg": "sum" } ] },
    { "nodeId": "n5", "nodeType": "output", "sourceNode": "n4", "limit": 1000 }
  ]}
```

约定：`{ alias, field }` 二元组定位字段，避免跨表重名歧义。`sourceNode` 引用前驱 nodeId（链式而非自由图，约束=简版 ETL）。

### 4.3 字段注册

保存时重建 `dataset_fields`（先 DELETE 该数据集旧字段，再 INSERT 明细字段清单）。字段的 `type` 在保存端推断（构建定义 fields/聚合结果列推断；跨表同名列默认字符串），图表中心直接可用。

## 5. 后端接口（均挂 `/api/datasources/:id/build` 前缀，RBAC `datasource:read` + `assertResource`）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/sql-assist` | 返回该数据源全部 schema→table→column 元数据（SQL 编辑器侧协助手/自动补全） |
| POST | `/build/preview-detail` | body=完整定义 → 编译执行 → 返回明细前 N 行 + 字段元数据 |
| POST | `/build/preview-aggregate` | body=定义+聚合参数 → 编译聚合 SQL 执行 → 聚合表 |
| POST | `/build/preview-node` | body=ETL 定义 + nodeId → 编译从源到该节点累计 SQL 执行 → 该节点真实数据 |
| POST | `/build/save` | body=定义(必)+[datasetId](更新时必) → 新建 INSERT 或校验 owner/datasource 一致后 UPDATE + 重建字段 → 返回 dataset |
| POST | `/build/validate` | 只编译不执行 → 语法/字段/结构校验 → 返回错误明细（前端实时校验用） |

权限：读类（sql-assist/preview-*/validate）`datasource:read`；`save` 为 `datasource:update`。

新增数据集读取接口的补充：`GET /api/datasets/:id` 返回体增加 `build_definition`（用于编辑回源）。

## 6. 构建编译器 `build-sql.js`

纯函数、无状态、无 IO：

```js
compile(buildDefinition, { datasource: dsConfig, dialect, provider }) → { sql, params, fields }
```

内部按三种形态分派：

- **sql 形态**：`sql` 原样执行（白名单校验：只允许 SELECT 开头的只读语句；参数化值不做，用户即 SQL 作者）。字段收集：执行后取返回行键或 `sql-assist` 推断。
- **builder 形态**：`FROM` 主表 + `JOIN 表 ON`（joinType）→ `WHERE`可选 → 聚合时 `GROUP BY + 聚合列`；非聚合 = 明细 SELECT。字段清单直接来自定义 `fields`。
- **etl 形态**：沿 `sourceNode` 链**累积编译**——每次变换在上一节点的 SELECT 结果上再包一层（子查询 / 或按节点语义直接 join 到 FROM 链）：

  单表可直连 FROM 省一层子查询；存在 join/filter/aggregate 时，累积 SQL 形态：
  `SELECT <fields> FROM ( <prev> ) AS tX JOIN ... WHERE ...`，实现逐节点可预览且不物化。

设计要点：

- 所有标识符经 `dialect.quoteIdent` 转义；一切值经 `dialect.placeholder(i)` + 参数数组（延续现有注入防护）
- 重名字段自动消歧：输出列别名带序号（如 `col_1`、`__m0`）
- `dialect.limit` 统一处理预览行数（MSSQL 为 TOP）
- 聚合无 GROUP BY 时退化为整表聚合单行
- 扩展点：`dateTrunc` 供聚合粒度；字段类型推断表（`typeMapping` 未来可用）

错误模型：

- 不合法定义 → `HttpError(400, '构建定义不合法: <详情>')`
- 字段/表不存在、编译失败 → `HttpError(400)`（定义问题）
- 连接失败/方言不支持 → `HttpError(500, '执行失败: <原因>')`（环境问题）
- ETL 无效节点 → `HttpError(500, 'ETL节点执行失败: <原因>')`（前端节点角标红色提示）

## 7. SqlDataProvider 改造（向后兼容）

- `query(dataset, queryObj)`：有 `build_definition` → 编译明细 SQL 作为子查询，外层按 queryObj 聚合/过滤（宽表语义）；无 → 现有直查逻辑
- `paginate(dataset, page, pageSize)`：有 `build_definition` → 编译明细 SQL 包 LIMIT + COUNT；无 → 现有逻辑
- `registerSqlDataset` 保持（新定义首张表=单表宽表也以 build_definition 存储，但优先复用原快捷按钮——见前端）

## 8. 前端

### 8.1 入口与路由

- 路由：`/datasources/:id/builder`（`DataSourceBuilder.vue`）
- `DataSourceDetail.vue`：单表「创建数据集」按钮 → 打开构建器（该表作为预填）；新增「新建构建」按钮 → 构建器空态
- `register-table` 快捷按钮保留（一键单表，不强制走构建器）
- `DatasetList.vue`：SQL 数据集行「编辑」下拉 →「编辑构建」→ `/datasources/:id/builder?editDatasetId=xxx`

### 8.2 构建器页面布局

`DataSourceBuilder.vue`（TopTab 三形态 + 共享工具条：名称输入、状态、保存按钮）

| Tab | 布局 |
|---|---|
| SQL | 左：schema→表→字段树（sql-assist）；中：textarea SQL + 「插入字段」按钮；底部：明细预览 |
| 拖拉拽 | 左：字段树多选；中：已选字段区（拖拽排序、别名/标签编辑）+ 关联配置区（同名自动预填、手动改 on 条件）+ 聚合配置（可选）；右下：明细/聚合双页签预览 |
| ETL | 竖向固定节点链（源/join/filter/aggregate/output 顺序固定，join/filter/聚合可增减）；左：字段树；点节点 → 右侧抽屉配置；「预览此节点」→ 真实数据表 |

**预览规则**：预览永远执行「当前内存态」（不落库、无副作用）；每个 ETL 节点底部「预览此节点」按钮独立请求 `preview-node`。

**保存/编辑**：新建 → `build/save`（无 datasetId）→ 跳转 `/datasets/:id`；编辑 → `GET /datasets/:id` 读 `build_definition` → `build/save`（带 datasetId）UPDATE。三形态均可编辑。

**交互增强**：ETL 节点执行失败 → 该节点红色角标 + 错误原因 tooltip，不阻塞其它节点预览。

## 9. 错误处理汇总

| 场景 | 表现 |
|---|---|
| 非法定义/字段/表不存在 | 400，构建器内联错误提示 |
| ETL 节点执行失败（连接/方言/超时） | 500，节点角标 + tooltip |
| 非 owner 访问/无权限 | 403（assertResource / requirePermission，现有机制） |
| 未登录 | 401（现有中间件） |
| 保存时 owner/datasource 不一致 | 400「数据集不属于该数据源或无权限」 |

## 10. 测试范围

### 后端（新增 `backend/test/task19-builder.test.js`）

- 编译：单表明细；多表 JOIN ON；聚合+GROUP BY；filter 参数化（EQ/IN/LT）；重名消歧；字段清单
- 方言：mysql 反引号 / pg 双引号 / mssql 方括号+TOP / clickhouse 括号，全部 quoteIdent
- 持久化：save 新建 INSERT + 更新 UPDATE（重建字段）；老数据集零迁移
- 权限：builder 接口 requirePermission + assertResource；非 owner 403
- ETL：source 节点预览；join+filter 累计；aggregate；无效节点 HttpError

### 前端

`npm run build`；CDP e2e（复用 M2 探针模式）覆盖三形态：新建→预览→保存→列表→编辑→保存→图表中心可用。

### 回归

`npm test`（111+M2 全量 + 新增 task19）全绿；`register-table`/老单表数据/图表聚合不回归。

## 11. 交付物

- 代码：`build-sql.js`、新 build 路由、`datasets.build_definition` 迁移、SqlDataProvider 分支、`DataSourceBuilder.vue` + 三形态组件、sql-assist 前端树
- 测试：task19-builder + e2e
- 文档：本设计 + 实施计划 + README 补 M2 构建器段落 + 需求清单相关条目状态