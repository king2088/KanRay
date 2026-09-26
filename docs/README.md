# KanRay · 文档中心

本目录是项目的**完整产品说明书**。按角色分为多个独立文档，覆盖从安装部署到日常使用的全流程。每篇文档均为**中英双语对照**：中文段落在前，英文段落在后。

> 快速上手（部署命令、初始账号、常用命令）见根目录 [README](../README.md)。本文档面向更深入的使用与运维。

# KanRay · Documentation Hub

This directory holds the project's **complete product manual**. It is split into standalone documents by role, covering everything from installation and deployment to day-to-day use. Every document is **bilingual**: the Chinese paragraph comes first, followed by its English counterpart.

> For a quick start (deployment commands, default account, common commands) see the root [README](../README.md). This hub is for deeper usage and operations topics.

## 读者导航

| 角色 | 先读 | 再读 |
|------|------|------|
| 业务用户（上传数据 / 建图表 / 搭看板 / 搭大屏 / 设计表单） | [快速开始](快速开始.md) | [用户手册](01-用户手册.md) |
| 管理员（用户 / 角色 / 审计 / API Key） | [快速开始](快速开始.md) | [管理员手册](02-管理员手册.md) |
| 数据工程师（连接外部数据库 / 数据集构建） | [快速开始](快速开始.md) | [数据源与构建器](03-数据源与构建器.md) |
| 大屏使用者（可视化大屏 / 驾驶舱 / 汇报展示） | [用户手册](01-用户手册.md) | [大屏设计器使用手册](07-大屏设计器使用手册.md) |
| 表单使用者（设计 / 发布 / 分享在线表单，采集数据） | [表单中心使用手册](08-表单中心使用手册.md) | [用户手册](01-用户手册.md) |
| 外部系统开发者（开放 API 集成） | [开放 API 集成指南](04-开放API集成指南.md) | — |
| 运维（Docker / systemd / 多实例部署、数据库与 Redis 配置、密钥管理） | [部署运维手册](05-部署运维手册.md) | [常见问题 FAQ](06-常见问题FAQ.md) |

## Reader Navigation

| Role | Read first | Then read |
|------|------|------|
| Business users (upload data / build charts / assemble dashboards / build big screens / design forms) | [Quick start](快速开始.md) | [User manual](01-用户手册.md) |
| Administrators (users / roles / audit / API keys) | [Quick start](快速开始.md) | [Admin manual](02-管理员手册.md) |
| Data engineers (connect external databases / build datasets) | [Quick start](快速开始.md) | [Data sources & builder](03-数据源与构建器.md) |
| Big-screen authors (visualization screens / cockpits / presentations) | [User manual](01-用户手册.md) | [Big-screen designer manual](07-大屏设计器使用手册.md) |
| Form users (design / publish / share online forms, collect data) | [Form center manual](08-表单中心使用手册.md) | [User manual](01-用户手册.md) |
| External system developers (Open API integration) | [Open API integration guide](04-开放API集成指南.md) | — |
| Operations (Docker / systemd / multi-instance deployment, database and Redis configuration, key management) | [Deployment & operations manual](05-部署运维手册.md) | [FAQ](06-常见问题FAQ.md) |

## 文档清单

| 文档 | 内容 | 篇幅 |
|------|------|------|
| [快速开始](快速开始.md) | 镜像/源码两种启动方式、系统登录、3 分钟建第一个看板 | ~4 千字 |
| [01-用户手册](01-用户手册.md) | 数据上传 → 图表 → 看板 → 筛选联动 → 分享，日常操作全流程 | ~6 千字 |
| [02-管理员手册](02-管理员手册.md) | 用户管理、角色与权限点、审计日志、开放 API Key、访问令牌 | ~5 千字 |
| [03-数据源与构建器](03-数据源与构建器.md) | 22 种驱动、直连 vs 同步、SQL/拖拽/ETL 三种构建形态、表注册 | ~5 千字 |
| [04-开放API集成指南](04-开放API集成指南.md) | 凭证体系、6 个数据接口、CSV、限流与安全、错误码、Swagger | ~6 千字 |
| [05-部署运维手册](05-部署运维手册.md) | Docker / systemd 部署、环境变量全表、数据库（存储后端）切换、Redis 配置、多实例分布式部署、密钥轮换 | ~6 千字 |
| [06-常见问题FAQ](06-常见问题FAQ.md) | 按场景问答：登录 / 数据源 / 同步 / 分享 / 开放API 常见问题 | ~3 千字 |
| [07-大屏设计器使用手册](07-大屏设计器使用手册.md) | 大屏画布自由布局、组件库、数据绑定、模板、预览与分享、快捷键与权限 | ~5 千字 |
| [08-表单中心使用手册](08-表单中心使用手册.md) | 表单设计 / 发布与关闭 / 密码与公开分享 / 在线填写 / 提交记录，数据自动回写数据集 | ~3 千字 |

## Document List

| Document | Contents | Size |
|------|------|------|
| [Quick start](快速开始.md) | Two startup paths (container image / source), signing in, first dashboard in 3 minutes | ~4k words |
| [01-User manual](01-用户手册.md) | Data upload → charts → dashboards → cross-filtering → sharing, the full day-to-day workflow | ~6k words |
| [02-Admin manual](02-管理员手册.md) | User management, roles & permission points, audit log, Open API keys, access tokens | ~5k words |
| [03-Data sources & builder](03-数据源与构建器.md) | 22 drivers, direct vs sync, three builder modes (SQL / drag-and-drop / ETL), table registration | ~5k words |
| [04-Open API integration guide](04-开放API集成指南.md) | Credential system, 6 data endpoints, CSV, rate limiting & security, error codes, Swagger | ~6k words |
| [05-Deployment & operations manual](05-部署运维手册.md) | Docker / systemd deployment, full env-var table, database (storage backend) switching, Redis, multi-instance distributed deployment, key rotation | ~6k words |
| [06-FAQ](06-常见问题FAQ.md) | Scenario-based Q&A: sign-in / data sources / sync / sharing / Open API | ~3k words |
| [07-Big-screen designer manual](07-大屏设计器使用手册.md) | Free-layout big-screen canvas, component library, data binding, templates, preview & sharing, shortcuts & permissions | ~5k words |
| [08-Form center manual](08-表单中心使用手册.md) | Form design / publish & close / password & public sharing / filling online / submission records, with data written back to datasets | ~3k words |

## 编写约定

- 基准：以 `master` 分支的最新代码为准
- 默认账号：`admin@kanray.local / admin123`（生产环境务必修改，见部署手册）
- 文中以“系统管理 → 用户管理”样式表示菜单路径
- 双语排版：中文段落在前、英文段落在后；代码块与命令只写一份（与语言无关）；表格列头为中文时，在其后追加一份英文表格；截图只引用一次
- 专有名词不译：产品名 `KanRay`、技术栈名、权限码、API 路径、环境变量名保持原样

## Conventions

- Baseline: the latest code on the `master` branch
- Default account: `admin@kanray.local / admin123` (change it in production — see the deployment manual)
- Menu paths are written in the form “系统管理 → 用户管理”
- Bilingual layout: the Chinese paragraph comes first, the English one after it; code blocks and commands appear only once (they are language-neutral); when a table's headers are Chinese, an English table is appended right after; each screenshot is referenced once
- Proper nouns are not translated: the product name `KanRay`, technology stack names, permission codes, API paths, and environment variable names stay as-is
