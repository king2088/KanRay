# M2 数据源接入 — Task 18 终验报告

- **分支**：`feature/m2-datasources`
- **日期**：2026-09-13
- **环境**：macOS（darwin）· Node v24 · 后端 :3001（dev DB `backend/data/kanban.db`）· 前端 :5173（Vite 代理）· Docker `kanban-live-*` 7 容器全 healthy
- **回归范围**：M1 全量单测 + 前端构建 + M2 全流程 CDP e2e + M1 两项回归 e2e + 安全自检 + README/需求清单更新

## 1. 各步骤结果

| Step | 内容 | 结果 |
|---|---|---|
| 1 | 后端单元测试 `cd backend && npm test` | ✅ 111 pass / 0 fail |
| 2 | 前端构建 `cd front-end && npm run build` | ✅ 成功（512ms） |
| 3 | 后端服务 :3001 | ✅ 就绪（`/api/auth/me` → 401） |
| 4 | 前端服务 :5173 | ✅ 就绪（`/` → 200） |
| 5 | CDP e2e — M2 全流程（数据源→数据集→图表） | ✅ 22/22 |
| 6 | mac e2e — config-panel（M1 回归） | ✅ 21/21 |
| 7 | mac e2e — rbac（M1 回归） | ✅ 14/14 |
| 8 | 安全自检 | ✅ 7/7（见 §5） |
| 9 | README.md 新增 M2 章节 | ✅ |
| 10 | 需求清单 DB-01~05 标注 `[已实现 M2]` | ✅ |
| 11 | `docs(m2): README + requirements checklist update` | ✅ |
| 12 | 全量回归 `npm test && npm run build` | ✅ 后提交 |

## 2. M2 全流程 CDP e2e（Step 5，`/tmp/probe-m2-flow.mjs`，playwright-core + 本机 Chrome headless）

覆盖：UI 登录 → 数据源列表（配置密码脱敏、连接测试）→ schema 树懒加载（testdb → sales → id/product/amount）→ 注册表→SQL 数据集 → 数据集详情（标题/字段定义数/数据源徽标）→ 图表构建器（SQL 字段入维度指标、柱状图实时预览、保存）→ 图表列表/编辑回显 → 图表数据接口 → 无 JS 报错。

**结果：22/22 PASS**（A1、B1~B3、C1~C3、D1~D4、E1~E11）

### 期间发现并修复 1 个缺陷

- **现象**：数据集详情「数据预览」页签对 SQL 数据集返回 `500`（`GET /api/datasets/:id/rows`）。
- **根因**：`paginateRows` 统一用本地 SQLite 表读取行数据，而 SQL 数据集的行在外部数据库（本地无对应表）→ 报错。
- **修复**：
  - `backend/src/datasources/sql-data-provider.js` 新增 `paginate()`：按方言引用库表、`LIMIT`/`TOP` 截断、`COUNT(*)` 求总量（仅首页语义，避免方言 OFFSET 差异）；
  - `backend/src/services/dataset.service.js` `paginateRows` 改为 `async`，按 `source_type === 'sql'` 走 provider 分支，Excel 路径不变；
  - `backend/src/routes/dataset.routes.js` `GET /:id/rows` 改为 `async/await`。
- **验证**：修复后 `GET /api/datasets/:id/rows` 返回 `{total:2, rows:[A=10.50, B=20.20]}`；e2e E11 通过且全程无 `[http>4xx]`。

## 3. M1 回归 e2e

### config-panel（21/21）

编辑图表显示配置（标题/数据标签/绘图区域/Y轴/图例/缩略轴/提示框/主题）→ 保存 → 校验 16 项配置落库（title、label、grid、yAxis、legend、tooltip、dataZoom、theme、colorPalette）→ 重新编辑回渲染。全部通过。

> 注：脚本内两处 `page.evaluate` 中的裸 `fetch()` 需携带 `kanban_access` 令牌，mac 运行包装为 `.e2e-mac.cjs` 时注入（不改动源脚本；Windows CI 行为不变）。

### rbac（14/14）

viewer 注册/登录 → 只见 owner 空看板 → `/api/admin/users` 403 → `POST /api/charts` 403 → 管理员全量可见 → UI 侧栏无系统管理、`/admin/users` 403 提示与空态。全部通过。

## 4. 后端回归

| 项 | 结果 |
|---|---|
| 驱动器注册表 22 条目 / tested 全能力 / planned 禁用 | ✅ |
| dialect 四族 quoteIdent / limit / dateTrunc / placeholder | ✅ |
| crypto 加解密往返 / 篡改抛错 / 掩码 | ✅ |
| 数据源 CRUD / 掩码 / 部分更新不破坏密码 / owner 隔离 / 无权限 403 / 未登录 401 | ✅ |
| registerSqlDataset / Excel 聚合回归 | ✅ |
| 查询引擎 sortBy 注入拒绝 / 指标下标校验 | ✅ |
| M1 认证/RBAC/审计/管理后台全量 | ✅ |

总计 **111 pass / 0 fail**。

## 5. 安全自检（Step 8）

| 检查项 | 结论 | 依据 |
|---|---|---|
| 密码 AES-256-GCM 加密存储 | ✅ | `crypto.js` `aes-256-gcm`，`iv:tag:ciphertext`，密钥由 `DATASOURCE_SECRET` SHA-256 派生 |
| API 永不返回明文密码 | ✅ | `datasource.service.js` `maskedConfig()` 在 `toPublic()` 中统一替换为 `********`（`safeConfigMasked` 亦同） |
| SQL 注入-标识符仅来自目录 | ✅ | `sql-data-provider.js` 表/字段名取自已注册元数据（register-table 来自结构浏览 `listColumns`），`quoteIdent` 包裹；`paginate` 同 |
| SQL 注入-值走参数化 | ✅ | `dialects.js` 占位符（`?`/`$n`/`@pN`），值入 `params` 数组，`runQuery(cfg, sql, params)` 预编译 |
| RBAC datasource:\* 权限 | ✅ | `datasource.routes.js` 全部路由 `requirePermission('datasource', ...)` |
| owner 隔离（access.service） | ✅ | 数据源/数据集路由 `access.assertResource` + 列表 `scopedWhere`（e2e 实测 viewer/analyst 隔离） |
| Docker 密码仅环境变量 | ✅ | `docker-compose.yml` 全部走 `environment:`，无硬编码于代码 |

## 6. 文档更新（Steps 9-10）

- `README.md`：新增「多数据源接入（M2）」章节 —— 22 种驱动（8 实测 / 6 协议兼容 / 8 规划中）、架构（驱动注册表 + 6 协议族 Provider + 方言抽象 + SqlDataProvider + AES-256-GCM）、`/api/datasources` 接口表、Docker live 环境、生产注意（`DATASOURCE_SECRET`）。
- `需求清单-第二阶段.md`：DB-01~05 标注 `[已实现 M2]`。

## 7. 变更文件

- `README.md`（新增 M2 章节）
- `需求清单-第二阶段.md`（DB-01~05 状态标注）
- `backend/src/datasources/sql-data-provider.js`（新增 `paginate()` + 导出）
- `backend/src/services/dataset.service.js`（`paginateRows` SQL 分支，async）
- `backend/src/routes/dataset.routes.js`（rows 路由 async/await）
- `docs/superpowers/plans/2026-09-12-m2-datasources.md`（Task 18 12 步全部勾选）
- `docs/superpowers/M2-task18-e2e.md`（本报告）

## 8. Commits

1. `3a54d10` — `docs(m2): README + requirements checklist update`
2. <!--FINAL_COMMIT_SHA--> — `chore(m2): final regression pass`（含代码修复 + 测试通过 + 计划勾选 + 本报告）