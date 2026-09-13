# 数据集构建器体验收尾（M3.6）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 M3.6 spec 中的六项体验修复——数据源单库粒度、SchemaTree 虚拟滚动/搜索/表目录、ETL 去树、拖拽 tab 拖入中间、详情页搜索、构建页 100% 高度——且保持全部现有测试通过。

**Architecture:** 后端在 `providers.listSchemas` 单点收敛为单根（MySQL 系/CH 取 cfg.database；PG→public、MSSQL→dbo）。前端 SchemaTree 重写为 ElTreeV2 虚拟滚动 + 内置 filterMethod + ResizeObserver 量测 + `showFields` prop。SQL/拖拽宿主面板改 flex 列让树自适应高度；拖拽目标移至中间字段面板；ETL 只留算子托盘。构建页改 `height: calc(100vh - var(--app-header-height))` flex column 全视口高度。主界面零新依赖（ElTreeV2 随 element-plus 内置）。

**Tech Stack:** Node 22 + `node:test`（后端 133 pass）；Vue 3 `<script setup>` + Element Plus 2.14.5（`el-tree-v2`）+ playwright-core（CDP e2e，test-m35-e2e.mjs）

---

### Task 1: 后端 listSchemas 单根收敛 + live 验证脚本（TDD）

**Files:**
- Create: `backend/scripts/datasource-live/verify-schema-scope.mjs`
- Modify: `backend/src/datasources/providers/mysql-family.js:24-32`
- Modify: `backend/src/datasources/providers/clickhouse.js:57-60`
- Modify: `backend/src/datasources/providers/pg-family.js:26-35`
- Modify: `backend/src/datasources/providers/mssql.js:23-33`

- [ ] **Step 1: Write failing verify script**

```js
// backend/scripts/datasource-live/verify-schema-scope.mjs
import { getProvider } from '../../src/datasources/providers/index.js'

const CASES = [
  { label: 'mysql',      family: 'mysql',      cfg: { host: '127.0.0.1', port: 13306, database: 'testdb', user: 'root',      password: 'Kanban@123' }, expect: 'testdb' },
  { label: 'mariadb',    family: 'mysql',      cfg: { host: '127.0.0.1', port: 13307, database: 'testdb', user: 'root',      password: 'Kanban@123' }, expect: 'testdb' },
  { label: 'tidb',       family: 'mysql',      cfg: { host: '127.0.0.1', port: 14000, database: 'testdb', user: 'root',      password: '' },            expect: 'testdb' },
  { label: 'clickhouse', family: 'clickhouse', cfg: { host: '127.0.0.1', port: 18123, database: 'testdb', user: 'default',   password: 'Kanban@123' }, expect: 'testdb' },
  { label: 'postgres',   family: 'pg',         cfg: { host: '127.0.0.1', port: 15432, database: 'testdb', user: 'postgres',  password: 'Kanban@123' }, expect: 'public' },
  { label: 'mssql',      family: 'mssql',      cfg: { host: '127.0.0.1', port: 11433, database: 'testdb', user: 'sa',        password: 'Kanban@123' }, expect: 'dbo' },
]

let failed = 0
for (const c of CASES) {
  try {
    const prov = getProvider(c.family)
    if (!prov) { console.log(`[FAIL] ${c.label}: provider not found`); failed++; continue }
    const schemas = await prov.listSchemas(c.cfg)
    const ok = schemas.length === 1 && schemas[0].name === c.expect
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${c.label} expect=[${c.expect}] got=${JSON.stringify(schemas.map((s) => s.name))}`)
    if (!ok) failed++
  } catch (e) {
    console.log(`[FAIL] ${c.label}: ${e.message}`)
    failed++
  }
}
console.log(failed ? `FAILED: ${failed}` : 'ALL SCHEMA-SCOPE CHECKS PASSED')
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Run verify script — expect FAIL (RED)**

```bash
cd /Users/tony/Workspace/kanban/backend
node scripts/datasource-live/verify-schema-scope.mjs
# Expected: mysql FAIL (got all schemas), clickhouse FAIL, etc.
```

- [ ] **Step 3: Implement listSchemas collapse (GREEN)**

Replace **mysql-family.js** listSchemas body (lines 24–31) with:

```js
async function listSchemas(cfg) {
  return cfg.database ? [{ name: cfg.database }] : [];
}
```

Replace **clickhouse.js** listSchemas body (lines 57–60) with:

```js
async function listSchemas(cfg) {
  return cfg.database ? [{ name: cfg.database }] : [];
}
```

Replace **pg-family.js** listSchemas body (lines 26–35) with:

```js
async function listSchemas() {
  return [{ name: 'public' }];
}
```

Replace **mssql.js** listSchemas body (lines 23–33) with:

```js
async function listSchemas() {
  return [{ name: 'dbo' }];
}
```

> mysql-family/clickhouse now short-circuit (no DB connection needed for catalog). pg/mssql return fixed root. No routes or build-sql touched.

- [ ] **Step 4: Re-run verify — expect ALL PASS**

```bash
cd /Users/tony/Workspace/kanban/backend
node scripts/datasource-live/verify-schema-scope.mjs
# Expected: ALL SCHEMA-SCOPE CHECKS PASSED
```

- [ ] **Step 5: Run existing backend test suite**

```bash
npm test
# Expected: 133 pass / 0 fail (unchanged baseline)
```

- [ ] **Step 6: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add backend/src/datasources/providers/{mysql-family.js,clickhouse.js,pg-family.js,mssql.js} backend/scripts/datasource-live/verify-schema-scope.mjs
git commit -m "feat(m3.6): collapse listSchemas to single schema per connection + live verify script"
```

---

### Task 2: SchemaTree rewrite — ElTreeV2 virtual scroll + search + showFields

**Files:**
- Modify: `front-end/src/components/builder/SchemaTree.vue` (full replace)

- [ ] **Step 1: Rewrite SchemaTree.vue**

```vue
<template>
  <div class="schema-tree">
    <el-input v-model="query" size="small" placeholder="搜索表 / 字段" clearable @input="onSearch" />
    <div class="schema-tree__body" ref="bodyEl">
      <el-tree-v2
        ref="treeRef"
        :data="treeData"
        :props="{ children: 'children', label: 'n', value: 'id' }"
        :height="treeHeight"
        :default-expanded-keys="defaultExpanded"
        :filter-method="filterMethod"
        :item-size="30"
      >
        <template #default="{ data }">
          <span
            class="schema-tree__node"
            :class="{ 'schema-tree__node--draggable': data.kind === 'table' }"
            :draggable="data.kind === 'table'"
            @dragstart="onDragStart($event, data.id)"
          >
            <el-icon :size="14" class="schema-tree__icon"><component :is="iconMap[data.kind]" /></el-icon>
            <span class="schema-tree__label">{{ data.n }}</span>
            <el-tag v-if="data.kind === 'field' && roleMeta(data.raw)?.metric" size="small" effect="plain" type="primary">指标</el-tag>
            <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.dimension" size="small" effect="plain" type="success">维度</el-tag>
            <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.time" size="small" effect="plain" type="warning">时间</el-tag>
            <span class="schema-tree__actions">
              <el-button v-if="data.kind === 'table'" link size="small" type="primary" @click.stop="emit('mount-table', data.id)">上架</el-button>
              <el-button v-if="data.kind === 'table' && showFields" link size="small" @click.stop="emit('open-table', data.id)">打开</el-button>
              <el-button v-if="data.kind === 'field'" link size="small" @click.stop="emit('pick-field', data.raw, $event)">插入</el-button>
            </span>
          </span>
        </template>
      </el-tree-v2>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Folder, Grid, Rank } from '@element-plus/icons-vue'
import { toTree } from '@/utils/catalog'

const props = defineProps({
  catalog: { type: Array, default: () => [] },
  showFields: { type: Boolean, default: true },
})
const emit = defineEmits(['mount-table', 'open-table', 'pick-field'])

const iconMap = { schema: Folder, table: Grid, field: Rank }
const query = ref('')
const treeRef = ref(null)
const bodyEl = ref(null)
const treeHeight = ref(300)

const fullTree = computed(() => toTree(props.catalog))
const treeData = computed(() =>
  props.showFields
    ? fullTree.value
    : fullTree.value.map((s) => ({
        ...s,
        children: (s.children || []).map((t) => ({ ...t, children: [], isLeaf: true })),
      }))
)
const defaultExpanded = computed(() => treeData.value.map((s) => s.id))

function filterMethod(value, data) {
  if (!value) return true
  return String(data.n || '').toLowerCase().includes(String(value).toLowerCase())
}

function onSearch(value) {
  treeRef.value?.filter(String(value || ''))
}

let ro = null
onMounted(() => {
  ro = new ResizeObserver(() => {
    if (bodyEl.value) treeHeight.value = Math.max(bodyEl.value.clientHeight, 60)
  })
  if (bodyEl.value) ro.observe(bodyEl.value)
})
onBeforeUnmount(() => ro?.disconnect())

function roleMeta(raw) {
  const role = raw?.role || ''
  return { metric: role === 'metric', dimension: role === 'dimension', time: role === 'time' }
}

function onDragStart(e, tableId) {
  e.dataTransfer.setData('text/plain', tableId)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.schema-tree { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.schema-tree__body { flex: 1; min-height: 0; }
.schema-tree__node { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.schema-tree__node--draggable { cursor: grab; }
.schema-tree__icon { color: var(--app-text-secondary); flex: 0 0 auto; }
.schema-tree__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.schema-tree__actions { display: none; gap: 2px; flex: 0 0 auto; }
.el-tree-node__content:hover .schema-tree__actions,
.el-tree-node__content:focus-within .schema-tree__actions { display: flex; }
:deep(.el-tree-node__content) { border-radius: 4px; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); }
</style>
```

> `el-tree-v2` API fact verified: `height` must be Number (ResizeObserver); `props.value` maps key field (no `node-key` attr); built-in `filterMethod(query, data)` + `filter()`.

- [ ] **Step 2: Verify build succeeds**

```bash
cd /Users/tony/Workspace/kanban/front-end
npm run build
# Expected: vite build success, no errors
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add front-end/src/components/builder/SchemaTree.vue
git commit -m "feat(m3.6): SchemaTree rewrite — ElTreeV2 virtual scroll, search, showFields"
```

---

### Task 3: SqlBuilderTab left panel flex column (height host)

**Files:**
- Modify: `front-end/src/components/builder/SqlBuilderTab.vue:99-104` (CSS block)

- [ ] **Step 1: Update CSS to flex column layout**

Replace the full `<style scoped>` block:

```css
<style scoped>
.sql-builder { display: flex; gap: 12px; height: 100%; }
.sql-builder__left { flex: 0 0 260px; display: flex; flex-direction: column; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: hidden; padding: 8px; }
.sql-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; flex-shrink: 0; }
.sql-builder__main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sql-builder__toolbar { display: flex; align-items: center; gap: 8px; }
.sql-builder__error { font-size: 12px; color: var(--el-color-danger); }
</style>
```

> Left panel: `overflow:hidden` (tree scrolls internally); flex column → tree fills remaining height; title fixed.

- [ ] **Step 2: Build**

```bash
cd /Users/tony/Workspace/kanban/front-end
npm run build
# Expected: success
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add front-end/src/components/builder/SqlBuilderTab.vue
git commit -m "feat(m3.6): SqlBuilderTab left panel flex layout for SchemaTree height"
```

---

### Task 4: DragBuilderTab — showFields=false, drop in mid, remove dropzone + e2e

**Files:**
- Modify: `front-end/src/components/builder/DragBuilderTab.vue:3-13` (template left+mid)
- Modify: `front-end/src/components/builder/DragBuilderTab.vue:111-118` (script imports)
- Modify: `front-end/src/components/builder/DragBuilderTab.vue:137-139` (script state)
- Modify: `front-end/src/components/builder/DragBuilderTab.vue:343-365` (style block)
- Modify: `test-m35-e2e.mjs:229-230` (add drag e2e case before final catch)

- [ ] **Step 1: Modify template — remove dropzone, set showFields=false, add mid @drop**

Replace lines 3–15 of DragBuilderTab.vue:

```html
    <div class="drag-builder__left">
      <div class="drag-builder__panel-title">目录 · 拖 / 上架数据表</div>
      <SchemaTree
        :catalog="schemas"
        show-fields="false"
        @mount-table="mountTable"
      />
    </div>

    <div
      class="drag-builder__mid"
      :class="{ 'drag-builder__mid--over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop="handleMidDrop"
    >
      <el-tabs v-model="activeTab" type="card" size="small">
```

- [ ] **Step 2: Update script imports — remove Plus icon (no longer used)**

Replace lines 111–118:

```js
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS } from '@/utils/catalog'
import SchemaTree from './SchemaTree.vue'
```

- [ ] **Step 3: Add dragOver state and handleMidDrop (near previewLimit/aliasMemory)**

Insert after line `const previewLimit = 200`:

```js
const dragOver = ref(false)
```

Insert after existing `onDropTable` function (line ~198):

```js
function handleMidDrop(e) {
  dragOver.value = false
  onDropTable(e)
}
```

- [ ] **Step 4: Update CSS — remove .dropzone, update left/mid**

Replace the full `<style scoped>` block (lines 342–365):

```css
<style scoped>
.drag-builder { display: flex; gap: 12px; height: 100%; }
.drag-builder__left { flex: 0 0 260px; display: flex; flex-direction: column; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: hidden; padding: 8px; }
.drag-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.drag-builder__mid { flex: 1; min-width: 480px; overflow: auto; border: 1px solid transparent; border-radius: 8px; transition: border-color 0.15s; }
.drag-builder__mid--over { border-color: var(--app-primary); background: rgba(0,0,0,0.02); }
.drag-builder__preview { flex: 0 0 40%; min-width: 360px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.drag-builder__preview-btn { margin-bottom: 8px; }
.drag-builder__error { font-size: 12px; color: var(--el-color-danger); }
.field-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 8px; margin-bottom: 10px; }
.field-card__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-card__table { font-size: 13px; font-weight: 600; }
.field-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 4px; }
.field-row:hover { background: var(--app-hover); }
.field-row__name { flex: 0 0 130px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.drag-row { cursor: grab; }
.join-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.join-eq { color: var(--app-text-secondary); }
.drag-builder__join-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.drag-builder__hint { font-size: 12px; color: var(--app-text-secondary); margin-top: 8px; }
.agg-block { margin-top: 12px; }
.agg-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.agg-metric { display: flex; gap: 6px; margin-bottom: 6px; }
</style>
```

- [ ] **Step 5: Add e2e drag case to test-m35-e2e.mjs**

Insert the following block **before** the final `} catch (e) {` (right after the ETL canvas case closing `})`):

```js
  // ---- 4. drag tab: drop table from tree into field pane ----
  await runCase('drag: drop table row into field pane', async () => {
    const dsId = await makeBuilderDataset(`m35-drg-${Date.now()}`, {
      type: 'builder', tables: [], joins: [], fields: [], aggregation: null, limit: 100,
    })
    await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
    await stripOverlay()
    await page.waitForSelector('.el-tabs__item.is-active', { timeout: 10000 })
    const activeOk = await page
      .waitForFunction(
        (t) => (document.querySelector('.el-tabs__item.is-active')?.innerText || '').includes(t),
        '拖拉拽',
        { timeout: 10000 }
      )
      .then(() => true)
      .catch(() => false)
    const before = await page.locator('.field-card').count()
    const treeRow = page.locator('.schema-tree__node').filter({ hasText: 'sales' }).first()
    await treeRow.waitFor({ state: 'visible', timeout: 10000 })
    await treeRow.dragAndDrop(page.locator('.drag-builder__mid'))
    await page.waitForSelector('.field-card', { timeout: 10000 }).catch(() => {})
    const after = await page.locator('.field-card').count()
    record('drag: drop table row into field pane', activeOk && after > before, `active=${activeOk} before=${before} after=${after}`)
  })
```

- [ ] **Step 6: Verify**

```bash
cd /Users/tony/Workspace/kanban/front-end && npm run build
cd /Users/tony/Workspace/kanban && node test-m35-e2e.mjs
# Expected: build success; ALL CDP CHECKS PASSED (now 10 cases)
```

- [ ] **Step 7: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add front-end/src/components/builder/DragBuilderTab.vue test-m35-e2e.mjs
git commit -m "feat(m3.6): DragBuilderTab drop-in-mid, tree table-only, remove dropzone + e2e"
```

---

### Task 5: ETL left panel — remove redundant SchemaTree

**Files:**
- Modify: `front-end/src/components/builder/EtlBuilderTab.vue:17-19` (template)
- Modify: `front-end/src/components/builder/EtlBuilderTab.vue:158` (script import)
- Modify: `front-end/src/components/builder/EtlBuilderTab.vue:179-180` (noop)

- [ ] **Step 1: Remove divider + 表/字段 + SchemaTree from template**

Delete these three lines (17–19):

```html
      <el-divider />
      <div class="etl-builder__panel-title">表 / 字段</div>
      <SchemaTree :catalog="schemas" @pick-field="() => {}" />
```

- [ ] **Step 2: Remove SchemaTree import**

Delete line 158:

```js
import SchemaTree from './SchemaTree.vue'
```

- [ ] **Step 3: Remove dead `noop`**

Delete lines 179–180:

```js
// eslint-disable-next-line no-unused-vars
const noop = () => {}
```

> `schemas` remains used by `tableOptions` and `sourceFields` — do not delete.

- [ ] **Step 4: Build**

```bash
cd /Users/tony/Workspace/kanban/front-end
npm run build
# Expected: success
```

- [ ] **Step 5: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add front-end/src/components/builder/EtlBuilderTab.vue
git commit -m "feat(m3.6): ETL left panel — remove redundant SchemaTree and divider"
```

---

### Task 6: DataSourceDetail — add lazy tree search

**Files:**
- Modify: `front-end/src/views/DataSourceDetail.vue:33-51` (template tree)
- Modify: `front-end/src/views/DataSourceDetail.vue:57-146` (script)

- [ ] **Step 1: Add search input before el-tree (inside el-card)**

Insert after the card header `</template>` (line 32), before `<el-tree`:

```html
        <el-input v-model="search" size="small" placeholder="搜索已加载的表 / 列" clearable style="margin-bottom: 8px" @input="onTreeSearch" />
```

- [ ] **Step 2: Wire tree ref and filterNode on el-tree**

Update `<el-tree` opening tag to include ref and filter:

```html
      <el-tree
        v-if="schemas.length"
        ref="treeRef"
        :data="schemaTree"
        lazy
        :load="loadNode"
        node-key="id"
        :filter-node-method="filterNode"
      >
```

- [ ] **Step 3: Add search state and functions to script**

After `const schemas = ref([])`, add:

```js
const search = ref('')
const treeRef = ref(null)
```

After the `iconOf` function, add:

```js
function filterNode(value, data) {
  if (!value) return true
  return String(data.label || '').toLowerCase().includes(String(value).toLowerCase())
}
function onTreeSearch(value) {
  treeRef.value?.filter(String(value || ''))
}
```

> `el-tree` exposes `.filter(query)`. For lazy trees, filter only affects already-loaded nodes; unloaded nodes remain unaffected (matches spec).

- [ ] **Step 4: Build**

```bash
cd /Users/tony/Workspace/kanban/front-end
npm run build
# Expected: success
```

- [ ] **Step 5: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add front-end/src/views/DataSourceDetail.vue
git commit -m "feat(m3.6): DataSourceDetail lazy tree search"
```

---

### Task 7: DataSourceBuilder — 100% viewport height + flex + padding

**Files:**
- Modify: `front-end/src/views/DataSourceBuilder.vue:15-28` (template card)
- Modify: `front-end/src/views/DataSourceBuilder.vue:118-120` (style block)

- [ ] **Step 1: Add classes to template elements**

Replace lines 15–21:

```html
    <el-card shadow="never" class="builder-card">
      <el-tabs v-model="activeMode" class="builder-tabs" @tab-change="onTabChange">
        <el-tab-pane label="纯 SQL" name="sql" />
        <el-tab-pane label="拖拉拽" name="drag" />
        <el-tab-pane label="ETL" name="etl" />
      </el-tabs>
      <div class="builder-page__content">
```

- [ ] **Step 2: Replace entire style block**

```css
<style scoped>
.builder-page {
  padding: 16px;
  height: calc(100vh - var(--app-header-height));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.builder-page .page-header { flex: 0 0 auto; }
.builder-card { flex: 1; min-height: 0; display: flex; flex-direction: column; }
:deep(.builder-card .el-card__body) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.builder-tabs { flex: 1; min-height: 0; display: flex; flex-direction: column; }
:deep(.builder-tabs .el-tabs__header) { flex: 0 0 auto; margin-bottom: 8px; }
:deep(.builder-tabs .el-tabs__content) { flex: 1; min-height: 0; display: flex; }
:deep(.builder-tabs .el-tab-pane) { flex: 1; min-height: 0; display: flex; }
.builder-page__content { flex: 1; min-height: 0; display: flex; }
</style>
```

> Height calc matches `el-main` height (`100vh - var(--app-header-height)` = app-main inner height). Flex cascade fills card → tabs → pane → tab root; each tab root is `height:100%` and scrolls internally.

- [ ] **Step 3: Build**

```bash
cd /Users/tony/Workspace/kanban/front-end
npm run build
# Expected: success
```

- [ ] **Step 4: Commit**

```bash
cd /Users/tony/Workspace/kanban
git add front-end/src/views/DataSourceBuilder.vue
git commit -m "feat(m3.6): DataSourceBuilder 100% viewport height + flex + padding"
```

---

### Task 8: Full regression + verification summary

**Files:** None (verification only)

- [ ] **Step 1: Backend test suite**

```bash
cd /Users/tony/Workspace/kanban/backend
npm test
# Expected: 133 pass / 0 fail
```

- [ ] **Step 2: Frontend build**

```bash
cd /Users/tony/Workspace/kanban/front-end
npm run build
# Expected: success
```

- [ ] **Step 3: CDP smoke (includes new drag case + screenshots)**

```bash
cd /Users/tony/Workspace/kanban
node test-m35-e2e.mjs
# Expected: ALL CDP CHECKS PASSED (10 cases)
# Screenshots in /tmp/opencode/cdp-m3.5/ (sql-dark/sql-light/etl-light)
```

- [ ] **Step 4: Verify schema scoping live**

```bash
cd /Users/tony/Workspace/kanban/backend
node scripts/datasource-live/verify-schema-scope.mjs
# Expected: ALL SCHEMA-SCOPE CHECKS PASSED (6 drivers)
```

- [ ] **Step 5: Manual spot checks (user acceptance)**

| Area | What to verify |
| --- | --- |
| SQL tab | tree shows testdb → sales (fields visible); search filters rows; 「插入」works |
| Drag tab | tree shows testdb → sales (no fields); 「上架」mounts; drag to mid creates field-card; dropzone gone; highlight on dragover |
| Detail page | single schema root; search filters loaded nodes |
| ETL tab | left palette only (no tree); source node config loads table options |
| Builder layout | page fits viewport 100% height, no page scroll; deep/light both correct |
| Dark mode | tree, palette, layout all follow theme vars |

- [ ] **Step 6: Clean status**

```bash
cd /Users/tony/Workspace/kanban
git status   # should be clean
```

---

## Self-Review

| Check | Result |
| --- | --- |
| Spec §3 listSchemas | Covered by Task 1 (4 providers + verify script + npm test) |
| Spec §4 SchemaTree rewrite | Covered by Task 2 (ElTreeV2 + ResizeObserver + filterMethod + showFields) |
| Spec §5 drag tab interaction | Covered by Task 4 (mid drop + showFields=false + e2e case) |
| Spec §6 ETL palette only | Covered by Task 5 (remove tree + noop + import) |
| Spec §7 DataSourceDetail search | Covered by Task 6 (filter-node-method + search input) |
| Spec §8 layout height | Covered by Task 7 (calc + flex cascade) |
| Placeholder scan | None found |
| Type/property consistency | `showFields` boolean; `data.n`/`children` (toTree output) consistent; `treeRef.filter()` exposed; all CSS vars use `--app-*` |
