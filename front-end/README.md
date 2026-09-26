# KanRay 前端

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

纯 node 脚本，无浏览器依赖，校验布局算法、数据源图标、图表配置、表单渲染、数据集类型、顶栏 loading、HTTP 方法矩阵、图表类型前后端同步，以及 i18n 词典键一致性与 CJK 残留扫描。

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

---

# KanRay frontend

Vue 3 + Vite single-page app providing dashboards, the chart builder, the form center, the big-screen designer and system administration screens.

## Development

```bash
npm install
npm run dev      # http://localhost:5173, /api proxied to 3001
npm run build    # output to dist/
npm run preview  # preview the production build
```

## Tests

```bash
npm test
```

Pure node scripts with no browser dependency, covering the layout algorithm, database icons, chart config, form rendering, dataset types, the top loading bar, the HTTP method matrix, front/back chart-type parity, and the i18n message key parity and CJK residue scan.

## Layout

| Directory | Purpose |
|---|---|
| `src/views/` | Routed pages |
| `src/components/` | Shared components (layout, chart renderer, form renderer, chart library wrappers) |
| `src/screen-designer/` | Big-screen designer (component library, canvas, property panel, templates) |
| `src/stores/` | Pinia state (app settings, auth, user profile) |
| `src/api/` | axios wrapper and endpoint definitions |
| `src/i18n/` | vue-i18n instance and the zh-CN / en-US message catalogues |
| `src/utils/` | Themes, dates, chart library wrappers, layout algorithms and other pure helpers |
| `scripts/` | node test scripts and Playwright E2E scripts |
