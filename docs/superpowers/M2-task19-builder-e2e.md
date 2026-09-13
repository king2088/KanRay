# M3 数据集构建器 — 终验报告

- **分支**：`feature/m2-datasources`
- **日期**：2026-09-13
- **环境**：macOS（darwin）· Node v24 · 后端 :3001（dev DB `backend/data/kanban.db`）· 前端 :5173（Vite 代理）· Docker `kanban-live-*` 7 容器全 healthy
- **回归范围**：M3/M3.5/M3.6 全量单测 + 前端构建 + CDP e2e（12 断言）+ Live schema 收敛验证（6/6）+ README/需求清单更新

## 1. 各步骤结果

| Step | 内容 | 结果 |
|---|---|---|
| 1 | 后端单元测试 `cd backend && npm test` | ✅ 133 pass / 0 fail |
| 2 | 前端构建 `cd front-end && npm run build` | ✅ 成功（544ms） |
| 3 | Live schema 收敛验证 `node backend/scripts/datasource-live/verify-schema-scope.mjs` | ✅ 6/6 |
| 4 | CDP e2e `node test-m35-e2e.mjs` | ✅ 12/12（10 用例 + 截图） |
| 5 | README.md 新增 M3 章节 | ✅ |
| 6 | 需求清单 DS-02/DS-10 标注 `[已实现 M3]` + Roadmap M3 行更新 | ✅ |
| 7 | 构建器代码评审 | ✅ 每任务 2 阶段评审（spec + code quality）通过 |

## 2. Live schema 收敛验证（Step 3）

`listSchemas` 收敛为单根（数据源 = 单库单 schema 语义）。脚本连 7 容器实测：

| 数据源 | 期望 | 实际 | 结果 |
|---|---|---|---|
| MySQL (13306) | `[testdb]` | `["testdb"]` | ✅ |
| MariaDB (13307) | `[testdb]` | `["testdb"]` | ✅ |
| TiDB (14000) | `[testdb]` | `["testdb"]` | ✅ |
| ClickHouse (18123) | `[testdb]` | `["testdb"]` | ✅ |
| PostgreSQL (15432) | `[public]` | `["public"]` | ✅ |
| SQL Server (11433) | `[dbo]` | `["dbo"]` | ✅ |

## 3. CDP e2e（Step 4，`test-m35-e2e.mjs`，playwright-core + 本机 Chrome headless）

覆盖：登录 → 数据源引导（id=1 MySQL → live testdb）→ 三种构建形态 tab 按定义 type 自动选中（sql/drag/etl）→ 深浅色截屏 → ETL Vue Flow 画布（custom nodes ≥ 2）→ 拖拽形态（左侧目录只显示表、拖 sales 表进画布 → field-card 渲染）→ 无 JS 报错。

**结果：12/12 PASS**：

| 用例 | 断言 | 结果 |
|---|---|---|
| bootstrap datasource id=1 (mysql / live testdb) | id/type 匹配 | ✅ |
| tab-map sql → 纯 SQL | active tab + CodeMirror 内容回显 | ✅ |
| tab-map drag → 拖拉拽 | active tab | ✅ |
| tab-map etl → ETL | active tab | ✅ |
| screenshots sql-dark.png + sql-light.png | 两张截图落盘 | ✅ |
| etl canvas: Vue Flow present | `.vue-flow` 可见 | ✅ |
| etl canvas: custom nodes >= 2 | `.etl-node-card` 数量 | ✅ |
| screenshot etl-light.png | 落盘 | ✅ |
| drag builder: nav → detail → builder → drag tab | 路径可达 | ✅ |
| drag builder: tables-only left tree (showFields=false) | sales 可见、打开/插入 = 0 | ✅ |
| drag builder: drop sales into mid renders field-card | `.field-card` hasText `testdb.sales` ≥ 1 | ✅ |

截图：`/tmp/opencode/cdp-m3.5/{sql-dark,sql-light,etl-light,drag-drop-in-mid}.png`

## 4. 构建器实现范围

- **纯 SQL**：CodeMirror 6 + `@codemirror/lang-sql`，目录驱动自动补全，预览/导入字段/保存
- **拖拉拽**：表目录（`showFields=false` 只显示表）→ 拖入画布 / 「上架」→ 字段卡片管理 → 关联自动预填 → 明细/聚合预览
- **ETL**：Vue Flow 算子画布（JOIN 含 `right` / FILTER / AGGREGATE），单输入固定链编译语义，逐节点预览
- **后端**：`/api/datasources/:id/build/{preview-detail,preview-aggregate,preview-node,save,validate}`，`build_definition` 持久化、老数据集零迁移、保存时服务端字段回填
- **SchemaTree 重写**：el-tree-v2 虚拟滚动 + 搜索过滤 + `showFields` prop，目录体验不再卡顿
- **M3.6 体验收尾**：单库单 schema 收敛、拖拽表直入画布、ETL 左栏去树、详情页搜索、构建页 100vh 布局

## 5. 代码评审

8 个 M3.6 实施任务全部按 subagent-driven-development 两阶段评审（spec 合规评审 + 代码质量评审）通过；评审发现的非阻塞问题（post-clear 展开重置、DOMStringList 安全、placeholder 语义、缩进）均已修复提交。