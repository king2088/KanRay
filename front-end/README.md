# KanRay 前端

> English: [README_EN.md](./README_EN.md)

Vue 3 + Vite 单页应用，提供看板、图表构建器、表单中心、大屏设计器与系统管理界面。

## 开发

```bash
npm install
npm run dev      # http://localhost:5173，/api 代理到 3001
npm run build    # 产物输出 dist/
npm run preview  # 预览构建产物
```

## 测试

```bash
npm test
```

纯 node 脚本，无浏览器依赖，校验布局算法、数据源图标、图表配置、表单渲染、数据集类型、顶栏 loading、HTTP 方法矩阵、图表类型前后端同步、ECharts locale 映射，以及 i18n 词典键一致性与 CJK 残留扫描。

## 目录

| 目录 | 职责 |
|---|---|
| `src/views/` | 路由页面 |
| `src/components/` | 通用组件（布局、图表渲染器、表单渲染器、图表库封装） |
| `src/screen-designer/` | 大屏设计器（组件库、画布、属性面板、模板） |
| `src/stores/` | Pinia 状态（app 设置、登录态、用户信息） |
| `src/api/` | axios 封装与接口定义 |
| `src/i18n/` | vue-i18n 实例与中英文词典 |
| `src/utils/` | 主题、日期、图表库封装、布局算法等纯工具 |
| `scripts/` | node 测试脚本与 Playwright E2E 脚本 |

## 国际化（12 个业务域）

支持的语言定义在 `src/i18n/constants.js`：`zh-CN`（默认）与 `en-US`。词典按 12 个业务域拆分，与 `src/i18n/locales/<locale>/<domain>.js` 的文件名一一对应。

| 域 | 覆盖范围 | 英文示例 |
| --- | --- | --- |
| `common` | 通用动作 / 设置 / HTTP 状态 / 空态 | `actions.confirm` = Confirm |
| `auth` | 登录 / 注册 | `login.title` = Sign in |
| `layout` | 菜单 / 个人中心 | `menu.admin` = Administration |
| `chart` | 图表分类 / 类型 / 运行时 / 聚合 / 衍生指标 | `categories.bar` = Bar |
| `datasource` | 数据源 | 暂无文案 |
| `dataset` | 字段类型 / 列表 / 详情 / 指标 / 数据源 / SQL / schema 树 / 拖拽 / ETL / 同步 | `fieldType.string` = Text |
| `form` | 字段类型 / 设计器 / 列表 / 填写 / 提交记录 | `fieldType.select` = Dropdown |
| `bigscreen` | 大屏列表 / 编辑器 / 右键菜单 / 状态栏 / 快捷键 / 左侧面板 | `list.title` = Big Screen Design |
| `admin` | 用户 / 权限 / 角色 / 审计 / 开放 API | `user.title` = Users |
| `openapi` | 个人访问令牌 | `token.title` = Personal access tokens |
| `audit` | 审计日志 | 暂无文案 |
| `validation` | 校验提示 | 暂无文案 |

> **注意**：`datasource` / `audit` / `validation` 三个域目前是空占位（`export default {}`），文案待后续补齐；界面上可见的审计文案暂时挂在 `admin.audit` 下。另有 `dashboard.js` 已并入词典对象，但未列入 `DOMAINS`，因此不计入这 12 个域。

新增文案时 zh-CN 与 en-US 两个文件需同步维护。`npm test` 会校验 12 个域文件齐备、两语言展平后的键集合完全一致、无空值，并扫描 en-US 侧的 CJK 残留。

后端下发的接口文案为双字段：`message` 是中文，`messageEn` 是可选英文。前端用 `src/i18n/locale-util.js` 的 `pickLocaleText(locale, message, messageEn)` 选择——英文界面优先取 `messageEn`，缺失时回退中文，因此漏译只影响英文界面可读性。

---
