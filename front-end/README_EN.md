# KanRay Frontend

> 中文: [README.md](./README.md)

Vue 3 + Vite single-page app providing dashboards, the chart builder, Forms, the big-screen designer and system administration screens.

## Development
```bash
npm install
npm run dev      # http://localhost:5173，/api 代理到 3001
npm run build    # 产物输出 dist/
npm run preview  # 预览构建产物
```

The commands above install dependencies and serve the app: `npm run dev` starts Vite on port 5173 with `/api` proxied to the backend on port 3001, `npm run build` emits to `dist/`, and `npm run preview` serves that build.

## Tests

```bash
npm test
```

Running the single `npm test` command executes all of the suites described below.

Pure node scripts with no browser dependency, covering the layout algorithm, database icons, chart config, form rendering, dataset types, the top loading bar, the HTTP method matrix, front/back chart-type parity, the ECharts locale mapping, and the i18n message key parity and CJK residue scan.

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

## Internationalization (12 Business Domains)

The supported locales are declared in `src/i18n/constants.js`: `zh-CN` (the default) and `en-US`. The catalogues are split across 12 business domains, matching the file names under `src/i18n/locales/<locale>/<domain>.js` one to one.

| Domain | Coverage | English example |
| --- | --- | --- |
| `common` | Shared actions / settings / HTTP status / empty states | `actions.confirm` = Confirm |
| `auth` | Sign-in / registration | `login.title` = Sign in |
| `layout` | Menu / profile | `menu.admin` = Administration |
| `chart` | Chart categories / types / runtime / aggregation / derived metrics | `categories.bar` = Bar |
| `datasource` | Data sources | No copy yet |
| `dataset` | Field types / list / detail / metrics / data sources / SQL / schema tree / drag-and-drop / ETL / sync | `fieldType.string` = Text |
| `form` | Field types / designer / list / filling / submissions | `fieldType.select` = Dropdown |
| `bigscreen` | Screen list / editor / context menu / status bar / shortcuts / left panel | `list.title` = Big Screen Design |
| `admin` | Users / permissions / roles / audit / Open API | `user.title` = Users |
| `openapi` | Personal access tokens | `token.title` = Personal access tokens |
| `audit` | Audit log | No copy yet |
| `validation` | Validation messages | No copy yet |

> **Note**: `datasource`, `audit` and `validation` are currently empty placeholders (`export default {}`) whose copy is still to be filled in; the audit copy that is visible in the UI temporarily lives under `admin.audit`. There is also a `dashboard.js` that is merged into the catalogue object but is not listed in `DOMAINS`, so it does not count towards these 12 domains.

When adding copy, keep the zh-CN and en-US files in sync. `npm test` verifies that all 12 domain files exist, that the flattened key sets of the two locales are exactly identical, that no value is empty, and that no CJK residue is left in en-US.

Copy coming back from the API is a dual-field pair: `message` is the Chinese text and `messageEn` is an optional English text. The front end picks between them with `pickLocaleText(locale, message, messageEn)` from `src/i18n/locale-util.js` — the English UI prefers `messageEn` and falls back to Chinese when it is absent, so a missing translation only affects readability of the English UI.
