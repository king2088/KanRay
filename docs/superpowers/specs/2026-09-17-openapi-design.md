# 开放 API（OpenAPI 平台）设计

> 日期：2026-09-17 ｜ 状态：已评审通过
> 需求：需求清单-第二阶段 AD-04「RESTful 开放 API（P2，对标 Superset REST API：程序化管理图表/看板/数据集，产品化对接核心）」

## 1. 目标

面向**外部客户集成**，提供一套独立、契约稳定、可文档化的开放 REST API，外部系统可用**长效凭证（API Key / PAT）**拉取系统内的看板 / 图表 / 数据集数据（JSON 或 CSV），并与现有 RBAC / 归属校验保持同一套安全边界。

## 2. 范围

**包含（本期 S1+S2）**：
- 独立前缀 `/api/open/v1`，与内部 `/api/*` 物理隔离的 Router + 凭证中间件 `openAuth`
- 双凭证：管理员签发**静态 API Key**（带 scope）+ 用户自助 **PAT**（个人访问令牌），库内仅存 sha256 哈希，明文仅在创建 / 滚动时返回一次
- 数据消费端点：资源发现（charts/datasets/dashboards 列表）、图表取数、数据集自定义聚合、看板快照导出，支持 `?format=csv` / `Accept: text/csv`
- 管理面：`apikey:manage` 权限点（admin），`/api/admin/api-keys` 管理 API；`/api/auth/tokens` PAT 自助；前端「开放 API 管理页」+「个人中心 PAT」
- OpenAPI 3.0 文档：swagger-jsdoc 自动生成（仅收录 `/api/open/v1`），Swagger UI 挂 `/api/open/docs`，spec JSON 挂 `/api/open/v1/openapi.json`
- 按 key 限流 + 数据出口审计

**不包含（排后续）**：
- S3 程序化管理 CRUD（外部客户创建 / 编辑 / 删除资源）
- RLS 行级权限（M4 统一收口所有数据出口）
- 面向计费的配额 / 订阅体系
- 查询端点的自定义图表筛选（以数据集 aggregate 代替）
- 嵌入式 iframe

## 3. 架构

### 3.1 数据模型：新表 `api_keys`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增 |
| name | TEXT NOT NULL | 客户可辨识名 |
| type | TEXT NOT NULL DEFAULT 'static' | `static`（管理员签发）\| `pat`（客户自助） |
| user_id | INTEGER NOT NULL | 映射身份：static=客户专用账号，pat=本人 |
| key_hash | TEXT NOT NULL UNIQUE | sha256(明文)，hex |
| key_prefix | TEXT NOT NULL | 明文前 8 位，日志识别 / 吊销定位 |
| scopes | TEXT NOT NULL DEFAULT '[]' | JSON 数组；static 限定，pat=`[]`=继承本人全部权限 |
| status | TEXT NOT NULL DEFAULT 'active' | `active` \| `revoked` |
| expires_at | TEXT | 可选绝对过期 |
| last_used_at | TEXT | 最近一次成功调用 |
| created_by | INTEGER | static=管理员，pat=本人 |
| created_at / updated_at | TEXT NOT NULL | 时间戳 |

- DDL 同步到 6 种方言（sqlite/mysql/postgres/mssql/oracle，mariadb 复用 mysql），追加进 `db/ddl/*.js` 数组即可（`runDdl` 幂等执行，老库自动建表）。

### 3.2 凭证格式

- 明文：`kan_live_<24 位 url-safe base64 随机>`（≈32 字节熵）；PAT 用 `kan_pat_` 前缀。
- 库内仅存 `key_hash` + `key_prefix`；明文只在创建 / `rotate`（滚动）时返回一次。
- 请求头：`Authorization: Bearer kan_xxx`，或 `X-API-Key: kan_xxx`。

### 3.3 scope 语义（安全关键）

- **static key**：`scopes` 限定的权限与映射用户自身 RBAC **取交集**——key 声明了但账号没有该权限，拒绝（防"用 key 提权为超管/直读他人数据"）。
- **PAT**：`[]` = 完全继承本人权限，天然不越权。
- 判定顺序：Key 有效（`status=active` 且未过期）→ 账号 `is_active` → scope 门（∩ RBAC 门）→ 每端点 `access.assertResource` 归属校验。

### 3.4 错误码约定

- 沿用 `{code, message, data}`；`code` = HTTP 状态。
- **统一 401** 掩盖无效 / 已吊销 / 过期 Key（不向攻击者暴露 key 是否存在）；scope 不足与账号禁用 → 403；不存在 / 无权资源 → 404「资源不存在或无权访问」。
- CSV 模式出错返回纯文本错误 + 对应状态码（非 `{code,data}` 外壳）。

## 4. 端点

### 4.1 数据消费（前缀 `/api/open/v1`，均需 Bearer Key）

| 方法·路径 | 说明 | 权限 |
| --- | --- | --- |
| `GET /charts` | 可见图表列表（id/name/chartType/datasetName/config） | chart:read |
| `GET /datasets` | 可见数据集列表（字段元数据，不含构建 SQL） | dataset:read |
| `GET /dashboards` | 可见看板列表 | dashboard:read |
| `GET /charts/:id/data` | 按图表当前配置取数 → `{columns, rows}` | chart:read |
| `POST /datasets/:id/aggregate` | 自定义聚合 `{metrics, dimensions, filters?, timeGrain?, sortBy?, groupLimit?}` | dataset:read |
| `GET /dashboards/:id/export` | 看板元信息 + 全部图表数据 | dashboard:read |

**CSV**：`?format=csv` 或 `Accept: text/csv` → `text/csv; charset=utf-8`（带 BOM，Excel 友好），无 `{code,data}` 外壳。

**统一约定**：
- 正常响应：`{code:0, data, message}`；列表 `data.items + data.total`，支持 `?limit`（默认 50 / 上限 200）+ `?offset`。
- 取数复用 `chart.routes.js` 的双重 `assertResource`（图表 + 其数据集），防"查图表绕读他人数据集"。
- 聚合输入 zod 校验，metrics/dimensions 字段局限于数据集已注册字段（复用白名单机制）。
- **不返回** `query-engine` 的 `sql` / 表名（输出剥离）。
- `OPEN_API_MAX_ROWS`（默认 10000）截断，返回 `truncated:true`。

### 4.2 管理面（JWT 登录态）

| 方法·路径 | 说明 | 权限 |
| --- | --- | --- |
| `GET /api/admin/api-keys` | Key 列表（无明文） | apikey:manage |
| `POST /api/admin/api-keys` | 签发 static key（name/userId/scopes/expiresAt）→ 返回明文一次 | apikey:manage |
| `PATCH /api/admin/api-keys/:id` | 改名 / 改 scopes / 启停 / 改过期 | apikey:manage |
| `POST /api/admin/api-keys/:id/rotate` | 滚动 → 返回新明文一次 | apikey:manage |
| `DELETE /api/admin/api-keys/:id` | 硬删除 | apikey:manage |
| `GET /api/auth/tokens` | 本人 PAT 列表（无明文） | 登录态 |
| `POST /api/auth/tokens` | 生成本人 PAT → 返回明文一次 | 登录态 |
| `DELETE /api/auth/tokens/:id` | 吊销本人 PAT（只能本人） | 登录态 |

## 5. 安全与治理

- **限流**：按 `key_hash`（`express-rate-limit` 自定义 keyGenerator），默认 120 req/min/Key，`OPEN_API_RATE_PER_MIN` 可调；超限 429。
- **审计**：复用 `audit.service.log(info, req)`；取数 / 聚合 / 导出等**数据出口**落审计（`action='api:chart.data'` 等，`detail={keyId,keyPrefix,keyName,scopes}`）；发现类 GET 不落；Key 生命周期操作落审计（`resource_type='api_key'`）。
- **权限点**：新增 `apikey:manage`（28→29），仅 admin 内建角色授予；PAT 自助不占权限点。
- **输出白名单**：资源元信息 / CSV / 导出不含构建 SQL、表名、连接信息、密钥。
- **数据出口收口**：内部路由 + 公开分享 + `/api/open` 三条路径全部过 RBAC；`/api/open` 额外 Key 有效 + scope 门两层。

## 6. 前端

- **「开放 API」管理页**（admin，菜单挂系统设置组）：Key 列表（无明文）、签发 static key 表单（名称/映射账号/scopes 勾选/过期）、吊销 / 滚动（弹出明文一次 + "仅显示一次"提示）。
- **「个人中心」PAT**：右上角用户菜单入口，生成 / 列表 / 吊销 / 设有效期。
- `front-end/src/api` 新增 `openApiAdmin.js` / `tokenApi.js`。

## 7. 测试策略（TDD，node:test）

| 主题 | 覆盖 |
| --- | --- |
| 迁移 | api_keys 建表幂等、5 方言 DDL 一致性 |
| 凭证服务 | 生成格式 / 明文仅一次 / 哈希 / 吊销 / 滚动 / 过期 / scope 交集 |
| openAuth | 无效 401、revoked / 过期 401、scope 不足 403、禁用账号 403、last_used_at |
| 端点 | 发现 scope 过滤、取数双重断言、404 掩盖、聚合 zod / 白名单、CSV（BOM）、看板导出结构、truncated |
| 安全 | 按 key 429、审计 detail（取数才落）、list 不落、CSV 错误纯文本 |
| 管理 API | admin 签发 / 吊销 / 滚动 + apikey:manage 门、PAT 本人限本人 |
| 契约 | `/api/open/v1/openapi.json` 可载入且端点与 spec 对应 |

## 8. 交付顺序（8 个可提交节点）

1. `feat(db): api_keys 建表 + 多方言 DDL` + 迁移测试
2. `feat(backend): api_key 服务（生成/哈希/吊销/滚动）+ apikey:manage 权限点`
3. `feat(backend): openAuth 中间件 + 限流 + 审计钩子`
4. `feat(backend): /api/open/v1 发现端点`
5. `feat(backend): /api/open/v1 取数/聚合/导出 + CSV`
6. `feat(backend): /api/admin/api-keys + /api/auth/tokens 管理 API`
7. `feat(frontend): 开放 API 管理页 + 个人中心 PAT`
8. `feat(docs): swagger 集成 + README（权限点 29、示例 curl、错误码）`

## 9. 已知限制

- 资源可见性 = 现有 RBAC owner 隔离（客户专用账号）；RLS 行级权限待 M4 统一收口。
- 单实例内存限流；多实例部署限流计数不共享（与现有同步调度同级别限制）。
- 大数据量查询受 `OPEN_API_MAX_ROWS` 截断，不做服务端流式分页。