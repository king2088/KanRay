# 看板分享链接（公开只读）设计

> 日期：2026-09-16 ｜ 状态：已评审通过
> 需求：创建看板分享链接，让其他人通过链接 + 密码直接查看看板内容（只读）

## 1. 目标

为看板提供**可管理、可过期、密码保护**的公开分享链接。创建者（owner/admin）可为一个看板创建多条分享链接，每条链接可独立设置密码与过期时间；任何拿到链接的人输入正确密码后，即可**只读**查看该看板（图表正常渲染），无需系统账号。

## 2. 范围

**包含**：
- 分享链接 CRUD（创建 / 列表 / 修改密码与过期 / 删除）
- 公开访问前端页面（`/s/:token`）：密码门禁 → 只读看板渲染
- 独立于登录态的公开 API（token + 短时效 share JWT）
- 图表数据查询走 `query-engine`，复用现有渲染链路
- `dashboard:share` 权限位（admin/analyst/editor 内建角色授予）

**不包含（排后续）**：
- 资源级用户/角色授权（RB-05/06 Grants）
- 看板内嵌 iframe（V-04 embed）
- 分享访问统计、水印、只读模式的筛选/钻取交互
- 内嵌密码的链接、无密码链接（本期一律要求密码）

## 3. 架构

### 3.1 数据模型：新表 `dashboard_shares`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增 |
| dashboard_id | INTEGER NOT NULL | FK → dashboards.id，级联删除 |
| token | TEXT NOT NULL UNIQUE | 128-bit 随机（base64url），URL 定位 |
| password_hash | TEXT NOT NULL | bcrypt（cost 10，复用 bcryptjs） |
| expires_at | TEXT | NULL = 永久，否则 ISO 时间 |
| is_active | INTEGER NOT NULL DEFAULT 1 | 软停用（保留记录） |
| created_by | INTEGER NOT NULL | FK → users.id |
| created_at / updated_at | TEXT NOT NULL | ISO 时间 |

- DDL 需同步到 6 种方言（sqlite/mysql/postgres/mssql/oracle）+ `db/schema.js` 幂等回填映射（`ensureSchema`），保证老库升级时自动建表。
- 原表删除（dashboard delete）→ `ON DELETE CASCADE` 级联清理分享记录。

### 3.2 权限

- 新权限位：`dashboard:share`（seeds.js，27 → 28 个）。
- 授权给内建角色 `admin` / `analyst` / `editor`；`viewer` 不授予。
- 管理操作复用 `access.service.js`：创建/列表/改/删分享须为看板 owner 或 admin。

### 3.3 后端路由

#### A. 管理路由（需登录 + `dashboard:share`）

| 方法/路径 | 说明 |
| --- | --- |
| POST `/api/dashboards/:id/shares` | body `{ password, expiresAt? }`；返回记录 + `shareUrl = {origin}/s/{token}` |
| GET `/api/dashboards/:id/shares` | 列表（不含 password_hash） |
| PATCH `/api/shares/:shareId` | body `{ password?, expiresAt?, isActive? }` 任一可选 |
| DELETE `/api/shares/:shareId` | 硬删除 |

校验：`password` ≥ 4 位；`expiresAt` 为合法 ISO 且晚于当前时间。

#### B. 公开路由（无登录态，`/api/public/shares`）

| 方法/路径 | 说明 |
| --- | --- |
| GET `/meta`（`:token/meta`） | 无需密码。返回 `{ dashboardName, requiresPassword: true, expired, inactive }`，供门禁页展示 |
| POST `/verify`（`:token/verify`） | body `{ password }`。校验 active/未过期 + 密码正确 → 签发**分享态 JWT** |
| GET `/dashboard`（`:token/dashboard`） | 需 Bearer 分享态 JWT（typ:'share'）。返回看板名、gap、cardStyle、layout、各 chart 渲染元信息（chart_type/config/dataset 字段 label），**不含** SQL、凭据、表名 |
| POST `/charts/:chartId/data`（`:token/charts/:chartId/data`） | 需 Bearer 分享态 JWT。校验 `:chartId` 属于该看板 layout 后走 `query-engine` 执行，返回 `{columns, rows}` |

#### C. 分享态 JWT

- 复用 `jwt.js`：payload `{ typ: 'share', shareId, dashboardId, token }`，有效期 24h。
- 中间件校验：JWT 可验 + `typ==='share'` + payload.token 与路径 `:token` 一致。
- 前端将分享态 JWT 存 `sessionStorage`。

### 3.4 安全要点

- `/verify` 加 `express-rate-limit`（10 次 / 15 分钟 / token），429 防暴力。
- 图表数据端点校验「chart 必须属于被分享看板的 layout」，防越权读他人资源。
- 公开接口返回信息最小化：不泄漏数据源地址、表名、SQL、内部 ID 之外的一切。
- 分享态 JWT 不落 URL，仅 Authorization header。

### 3.5 前端

- **路由**：`/s/:token` 为公开页（路由 `meta.public = true`，守卫放行不跳登录），组件 `ShareBoardView.vue`。
- **ShareApi**：独立 axios 实例（不带普通登录 JWT，仅带分享态 JWT header）。
- **ShareGate.vue**：进入后先 `GET meta` → 展示看板名；expired/inactive 显示对应提示；否则密码框 → `POST verify` → 存分享态 JWT → 进入只读视图。
- **ShareBoardView.vue**：只读渲染，复用 `DashboardCanvas` / `GridBoard` / `ChartTile` / `EChartRenderer`；无编辑入口、无导航，仅「刷新」按钮（重新拉取全部 chart data）。
- **ShareDialog.vue**（管理侧）：看板列表/详情入口按钮（有 `dashboard:share` 权限显示）→ 创建/列表/改密码、改过期、启停/删除、复制链接。

### 3.6 数据流

```
访问 /s/:token
  → GET meta（展示看板名 / 过期提示）
  → 输密码 → POST verify 签发分享态 JWT（24h）
  → GET dashboard（layout + chart 渲染配置）
  → 逐个 chart POST data → EChartRenderer 渲染
  → 刷新按钮重新拉取全部 chart data
```

## 4. 错误处理

| 场景 | HTTP 状态 | code | 前端显示 |
| --- | --- | --- | --- |
| share/token 不存在 | 404 | 404 | 分享不存在或已被删除 |
| 已过期 | 403 | 40301 | 分享链接已过期，请联系创建者 |
| 已停用 | 403 | 40302 | 分享已被关闭 |
| 密码错误 | 401 | 40101 | 密码错误，可重试 |
| 频繁尝试 | 429 | 429 | 尝试次数过多，请稍后再试 |
| 分享态 JWT 缺失/无效/跨 token | 401 | 40102 | 请重新输入密码 |

## 5. 测试

- **后端**（`node --test`）：share.service 单测 + 路由集成测试——
  创建/列表/改/删、所有权隔离（他人 403）、verify 成功/密码错/过期/停用、rate-limit、dashboard 载荷不含 SQL/凭据、chart 越权（访问不属于该看板的 chart → 404/403）。
- **前端**：沿用 `test-m35-e2e.mjs` 风格手动验证——分享 → 匿名访问 → 输密码 → 查看。

## 6. 实现顺序（小步提交）

1. 数据层：6 方言 DDL + schema.js 回填 + share.service
2. 权限 seed：`dashboard:share` + 角色授权
3. 管理路由（create/list/patch/delete）
4. 公开路由（meta/verify/dashboard/data）+ rate-limit + 分享态 JWT 中间件
5. 前端：shareApi + 路由放行 + ShareGate + ShareBoardView
6. 前端：ShareDialog + 管理侧入口按钮
7. 后端测试 + 手动验证