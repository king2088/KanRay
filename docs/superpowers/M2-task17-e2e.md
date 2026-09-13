# M2 Task 17 — Frontend DataSource Pages + CDP E2E

Date: 2026-09-13 · Branch: `feature/m2-datasources`

## Scope

Frontend data-source pages (list / create-edit dialog / detail with schema tree) wired to the M2
backend `/api/datasources*` endpoints, plus an end-to-end check driven over CDP against the live
dev stack (backend + vite proxy + headless Chrome).

## Environment used

- Backend: `backend/src/server.js` restarted against the dev DB `backend/data/kanban.db` (port 3001).
  Note: the previously-running backend process did **not** have the M2 datasource routes (404 on
  `/api/datasources`); it was restarted for this task.
- Frontend: `front-end` vite dev server (port 5173, proxies `/api` → 3001), HMR picked up all edits.
- Live databases: `kanban-live-mysql` (Docker, 127.0.0.1:13306) and `kanban-live-mariadb` (13307).
- Dev DB already contained admin user `admin@kanban.local / admin123`, a MySQL datasource
  (`live-mysql`, id 1 → 127.0.0.1:13306/testdb) and SQL dataset `live-sales` (id 61).
- Probe: `/tmp/probe-dslist.cjs` written in CommonJS (`require('playwright-core')` present in
  `front-end/node_modules`) — but it drives the browser through the plain CDP `WebSocket` to the
  already-running headless Chrome on `--remote-debugging-port=9333` (same pattern as existing
  `/tmp/probe-*.cjs`), enabling `Page`/`Runtime` and driving the page via `Runtime.evaluate`.

## E2E results (CDP probe `/tmp/probe-dslist.cjs`)

All 20/20 steps passed:

1. Auth boot — login via `/api/auth/login` from the page context, token written to
   `localStorage` (`kanban_access`/`kanban_refresh`/`kanban_user`), navigate to `/datasources`. PASS
2. `/datasources` renders: `.page-title === 数据源`, table has ≥1 row. PASS
3. Sidebar menu contains `数据源` item (first in MENU_ITEMS). PASS
4. Row renders type tag (`MySQL`) and status tag (`启用`). PASS
5. 新建数据源 opens the `el-dialog`. PASS
6. Type select: MySQL chosen from the grouped driver dropdown (disabled `planned` drivers shown as 暂不支持). PASS
7. Config fields filled (host/port/database/user/password, incl. `el-input-number` port). PASS
8. 测试连接 → success `el-alert` with message `连接成功`. PASS
9. 保存 closes the dialog and `load()` refreshes. PASS
10. New datasource row appears in list. PASS
11. `/datasources/1` (live-mysql) loads detail header + `el-tree`. PASS
12. Schema level lazy-loads (5 schemas, incl. `testdb`). PASS
13. Expanding `testdb` lazy-loads tables (1 table: `sales`, with 创建数据集 button). PASS
14. Expanding `sales` lazy-loads columns (`id (int)`, `product (varchar)`, `amount (decimal)`). PASS
15. Tree 创建数据集 → `ElMessageBox.prompt` → register-table → success message. PASS
16. After creation auto-navigates to `/datasets/<new-id>` (dataset 62 `e2e-sales-…`). PASS
17. `/datasets` shows the sql dataset row with the `数据库` badge. PASS

Screenshots captured: `/tmp/ds-list.png`, `/tmp/ds-dialog-success.png`,
`/tmp/ds-after-create.png`, `/tmp/ds-detail-tree.png`, `/tmp/ds-new-dataset.png`,
`/tmp/ds-dataset-badge.png`.

## Notable findings fixed during this task

- **Strong element-plus lazy-tree semantics**: an `el-tree` with `lazy` + `load` builds its root
  children via `load(root, resolve)` — the `data` prop's root items are *not* rendered. The
  plan's `DataSourceDetail.vue` shape (schema→tables→columns) is preserved, but `loadNode` now
  resolves the schema level when called with the tree root (`node.data.type` falsy). Without this
  the tree rendered its own empty block.
- The previously-running backend was stale (no datasource routes); restarted to pick up M2 code.
- A stale build artifact from earlier probes was unrelated; `npm run build` passes.

## Build

```
cd front-end && npm run build   →  ✓ built in ~0.6s, no errors
```

## Files

- Created: `front-end/src/views/DataSourceList.vue`, `DataSourceFormDialog.vue`,
  `DataSourceDetail.vue`
- Modified: `front-end/src/api/index.js` (datasourceApi), `front-end/src/router/menu.js`,
  `front-end/src/router/index.js`, `front-end/src/views/DatasetList.vue`

## Verdict

**PASS** — build succeeds and all CDP e2e steps (list / create / test / save / schema tree lazy-load /
register-table dataset) pass.