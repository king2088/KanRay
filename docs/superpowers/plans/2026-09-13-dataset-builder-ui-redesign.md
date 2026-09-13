# 数据集构建器 UI 重做（M3.5）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把数据集构建器的三种形态（纯SQL / 拖拉拽 / ETL）重做为带真实代码编辑、字段管理、算子画布的高质量交互 UI，并精修数据源详情库表树；深浅色全部跟随既有 `--app-*` / `--el-*` 变量。

**Architecture:** 前端在 `front-end/` 下新增共享组件（SchemaTree 目录树、CodeMirror 封装、ETL 节点卡），改造三个 builder tab 与 DataSourceBuilder 外壳（目录只拉一次、编辑态按定义 type 自动选中 tab）。后端仅一处最小扩展：ETL JOIN 节点支持 `joinType: 'right'`（`build-sql.js`），其余 `build_definition` 契约完全不变。ETL 画布用 Vue Flow，保持「单输入、单条固定链」编译语义不变。

**Tech Stack:** Vue 3.5 + Element Plus 2.10、CodeMirror 6（含 @codemirror/lang-sql 自动补全）、@vue-flow/core（画布）、sortablejs（字段行排序）、后端 Node.js + better-sqlite3（编译/预览/保存接口均已存在）。

---

## 文件结构

**新增（前端组件，`front-end/src/components/builder/`）**
- `SchemaTree.vue` — 共享目录树（库/表/字段图标、字段角色徽标、hover 操作：上架/打开/插入；表节点可拖拽上架）
- `SqlCodeMirror.vue` — CodeMirror 6 封装（sql 方言 + 目录驱动自动补全 + 跟随 `html.dark` 的变量主题）
- `EtlNodeCard.vue` — ETL 画布自定义节点卡片（算子图标/标题/描述/错误态/选中态）

**新增（验证脚本）**
- `test-m35-e2e.mjs` — CDP 冒烟（三形态 tab 自动选中 + 深浅色截屏）

**修改**
- `backend/src/datasources/build-sql.js:210` — ETL join 分支支持 `joinType: 'right'`
- `backend/test/task19-builder.test.js` — 新增 right join 测试
- `front-end/package.json` + `front-end/package-lock.json` — 新增依赖
- `front-end/src/views/DataSourceBuilder.vue` — 外壳：目录只拉一次、tab 映射修复
- `front-end/src/components/builder/SqlBuilderTab.vue` — CodeMirror 替换 textarea
- `front-end/src/components/builder/DragBuilderTab.vue` — dataEase 式字段管理
- `front-end/src/components/builder/EtlBuilderTab.vue` — Vue Flow 画布
- `front-end/src/views/DataSourceDetail.vue` — 库表树精修（图标/徽标/hover）

---

### Task 1: 后端 ETL JOIN 支持 RIGHT

**Files:**
- Modify: `backend/src/datasources/build-sql.js:210`
- Test: `backend/test/task19-builder.test.js` (追加在 `compileEtl chain to aggregate node is cumulative` 之后)

- [ ] **Step 1: 写失败测试**

在 `backend/test/task19-builder.test.js` 第 134 行（`compileEtl chain...` 测试之后、`compileEtl unknown node throws` 之前）插入：

```js
test('compileEtl join honors right joinType', () => {
  const def = {
    type: 'etl',
    nodes: [
      { nodeId: 'n1', nodeType: 'source', alias: 's', schema: 'testdb', table: 'sales' },
      { nodeId: 'n2', nodeType: 'join', joinType: 'right', sourceNode: 'n1', to: { alias: 'c', schema: 'testdb', table: 'sales' }, on: [{ from: { alias: 's', field: 'id' }, to: { alias: 'c', field: 'id' } }] },
    ],
  };
  const { nodeSql } = buildSql.compileEtl(def, mysql, catalog());
  const sql = nodeSql('n2').sql;
  assert.ok(sql.includes('RIGHT JOIN'), '期望 RIGHT JOIN，实际: ' + sql);
  assert.ok(sql.includes('ON `__s__id` = `c`.`id`'), '右表列应直接引用别名: ' + sql);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/task19-builder.test.js`（在 `backend/` 目录）
Expected: FAIL，断言 `期望 RIGHT JOIN`（当前 join 分支只输出 `JOIN`）。

- [ ] **Step 3: 实现**

将 `backend/src/datasources/build-sql.js` 第 210 行：

```js
        const jt = (node.on && node.on[0] && node.on[0].joinType === 'left') ? 'LEFT JOIN' : 'JOIN';
```

替换为：

```js
        const jtOverride = node.joinType || (node.on && node.on[0] && node.on[0].joinType);
        const jt = jtOverride === 'right' ? 'RIGHT JOIN' : (jtOverride === 'left' ? 'LEFT JOIN' : 'JOIN');
```

（向后兼容：老定义靠 `node.on[0].joinType`，新画布定义用 `node.joinType`。）

- [ ] **Step 4: 跑通测试 + 全量回归**

Run: `node --test test/task19-builder.test.js`
Expected: PASS（含新 right 测试）

Run: `npm test`（在 `backend/`）
Expected: ALL PASS（130）

- [ ] **Step 5: Commit**

```bash
git add backend/src/datasources/build-sql.js backend/test/task19-builder.test.js
git commit -m "feat(m3.5): ETL join supports RIGHT joinType"
```

---

### Task 2: 安装前端依赖

**Files:**
- Modify: `front-end/package.json`, `front-end/package-lock.json`

- [ ] **Step 1: 安装**

Run: `npm i codemirror @codemirror/lang-sql @vue-flow/core @vue-flow/background @vue-flow/controls sortablejs`（在 `front-end/`）
Expected: 成功，`package.json` dependencies 增加这 6 个包。

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功，无 peer 冲突报错。

- [ ] **Step 3: Commit**

```bash
git add front-end/package.json front-end/package-lock.json
git commit -m "chore(m3.5): add codemirror, vue-flow, sortablejs deps"
```

---

### Task 3: 新建 SchemaTree.vue

**Files:**
- Create: `front-end/src/components/builder/SchemaTree.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <el-tree :data="treeData" node-key="id" default-expand-all :props="{ label: 'n', children: 'children' }">
    <template #default="{ data }">
      <span class="schema-tree__node">
        <el-icon :size="14" class="schema-tree__icon"><component :is="iconMap[data.kind]" /></el-icon>
        <span class="schema-tree__label">{{ data.n }}</span>
        <el-tag v-if="data.kind === 'field' && roleMeta(data.raw)?.metric" size="small" effect="plain" type="primary">指标</el-tag>
        <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.dimension" size="small" effect="plain" type="success">维度</el-tag>
        <el-tag v-else-if="data.kind === 'field' && roleMeta(data.raw)?.time" size="small" effect="plain" type="warning">时间</el-tag>
        <span class="schema-tree__actions">
          <el-button v-if="data.kind === 'table'" link size="small" type="primary" draggable @dragstart="onDragStart($event, data.id)" @click.stop="emit('mount-table', data.id)">上架</el-button>
          <el-button v-if="data.kind === 'table'" link size="small" @click.stop="emit('open-table', data.id)">打开</el-button>
          <el-button v-if="data.kind === 'field'" link size="small" @click.stop="emit('pick-field', data.raw, $event)">插入</el-button>
        </span>
      </span>
    </template>
  </el-tree>
</template>

<script setup>
import { computed } from 'vue'
import { Folder, Grid, Element } from '@element-plus/icons-vue'
import { toTree } from '@/utils/catalog'

const props = defineProps({ catalog: { type: Array, default: () => [] } })
const emit = defineEmits(['mount-table', 'open-table', 'pick-field'])

const iconMap = { schema: Folder, table: Grid, field: Element }
const treeData = computed(() => toTree(props.catalog))

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
.schema-tree__node { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.schema-tree__icon { color: var(--app-text-secondary); flex: 0 0 auto; }
.schema-tree__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.schema-tree__actions { display: none; gap: 2px; flex: 0 0 auto; }
.el-tree-node__content:hover .schema-tree__actions { display: flex; }
.el-tree-node__content { height: 30px; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); border-radius: 4px; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/SchemaTree.vue
git commit -m "feat(m3.5): shared SchemaTree component with icons, role badges, drag-to-mount"
```

---

### Task 4: 新建 SqlCodeMirror.vue

**Files:**
- Create: `front-end/src/components/builder/SqlCodeMirror.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <div ref="container" class="sql-codemirror" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { sql, MySQL } from '@codemirror/lang-sql'
import { defaultKeymap } from '@codemirror/commands'

const props = defineProps({
  modelValue: { type: String, default: '' },
  catalog: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const container = ref(null)
const sqlComp = new Compartment()
let view

function buildSqlConfig(catalog) {
  const tables = (catalog || []).flatMap((s) =>
    (s.tables || []).map((t) => ({
      schema: s.schema,
      name: t.table,
      columns: (t.columns || []).map((c) => ({ name: c.name, type: c.type })),
    }))
  )
  const schemas = [...new Set((catalog || []).map((s) => s.schema))]
  return sql({ dialect: MySQL, schema: schemas, tables, upperCaseKeywords: true })
}

const cmTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', backgroundColor: 'transparent' },
  '.cm-scroller': { fontFamily: "'SFMono-Regular', Consolas, monospace", lineHeight: '1.6' },
  '.cm-content': { color: 'var(--app-text-primary)', padding: '4px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--app-text-secondary)', borderRight: '1px solid var(--app-border)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--el-color-primary-light-7) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--app-text-primary)' },
  '.cm-activeLine': { backgroundColor: 'var(--app-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--app-hover)' },
  '.cm-tooltip': { backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text-primary)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--el-color-primary-light-8)', color: 'var(--app-text-primary)' },
  '.cm-tooltip-autocomplete > ul > li': { display: 'flex', alignItems: 'center', gap: '8px' },
})

onMounted(() => {
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      sqlComp.of(buildSqlConfig(props.catalog)),
      cmTheme,
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap]),
      props.placeholder ? placeholder(props.placeholder) : [],
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      }),
    ],
  })
  view = new EditorView({ state, parent: container.value })
})

watch(() => props.catalog, (v) => {
  if (view) view.dispatch({ effects: sqlComp.reconfigure(buildSqlConfig(v)) })
}, { deep: true })

watch(() => props.modelValue, (v) => {
  if (!view) return
  if (v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})

onBeforeUnmount(() => { view?.destroy() })
</script>

<style scoped>
.sql-codemirror { height: 220px; border: 1px solid var(--el-border-color); border-radius: 6px; overflow: hidden; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/SqlCodeMirror.vue
git commit -m "feat(m3.5): CodeMirror SQL editor wrapper with catalog autocomplete"
```

---

### Task 5: 新建 EtlNodeCard.vue

**Files:**
- Create: `front-end/src/components/builder/EtlNodeCard.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <div class="etl-node-card" :class="{ 'etl-node-card--selected': selected, 'etl-node-card--error': error }">
    <div class="etl-node-card__icon">{{ NODE_ICON[node.nodeType] }}</div>
    <div class="etl-node-card__body">
      <div class="etl-node-card__title">{{ NODE_TITLE[node.nodeType] }}</div>
      <div class="etl-node-card__desc">{{ desc }}</div>
      <div v-if="error" class="etl-node-card__error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ node: { type: Object, required: true }, error: { type: String, default: null }, selected: { type: Boolean, default: false } })

const NODE_ICON = { source: '源', join: '联', filter: '筛', aggregate: '聚', output: '出' }
const NODE_TITLE = { source: '数据源', join: '关联', filter: '筛选', aggregate: '聚合', output: '输出' }
const NODE_COLOR = { source: '#67c23a', join: '#909399', filter: '#e6a23c', aggregate: '#409eff', output: '#f56c6c' }

const desc = computed(() => {
  const n = props.node
  if (n.nodeType === 'source') return `${n.schema || '-'}.${n.table || '-'}`
  if (n.nodeType === 'join') return `${n.joinType || 'inner'} JOIN ${n.to?.schema || '-'}.${n.to?.table || '-'}`
  if (n.nodeType === 'filter') return `${(n.conditions || []).length} 个条件`
  if (n.nodeType === 'aggregate') return `${(n.metrics || []).length} 指标`
  return `LIMIT ${n.limit}`
})
</script>

<style scoped>
.etl-node-card { display: flex; gap: 8px; align-items: center; background: var(--app-card); border: 1px solid var(--app-border); border-radius: 8px; padding: 8px 10px; width: 180px; cursor: grab; transition: box-shadow .15s, border-color .15s; }
.etl-node-card--selected, .etl-node-card:hover { border-color: var(--app-primary); box-shadow: 0 2px 8px rgba(0, 0, 0, .08); }
.etl-node-card--error { border-color: var(--el-color-danger); }
.etl-node-card__icon { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 600; }
.etl-node-card__body { min-width: 0; }
.etl-node-card__title { font-size: 13px; font-weight: 600; color: var(--app-text-primary); }
.etl-node-card__desc { font-size: 11px; color: var(--app-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.etl-node-card__error { font-size: 11px; color: var(--el-color-danger); margin-top: 2px; }
</style>
```

`__icon` 背景色应由宿主（EtlBuilderTab）通过 `:style` 传入，这里补上：在 `EtlBuilderTab` 引用处用 `:style="{ background: nodeColor(node) }"`，见 Task 9。为保持内聚，把颜色函数也放到 `EtlNodeCard` 内 exported 有难度，因此改为：`EtlNodeCard` 接收 prop `nodeColor`（String），并在 `__icon` 上用 `:style="{ background: nodeColor || '#409eff' }"`。**采用此方案**，修改 Step 1 的模板：

```vue
    <div class="etl-node-card__icon" :style="{ background: nodeColor }">{{ NODE_ICON[node.nodeType] }}</div>
```

`script setup` 中新增 `nodeColor: { type: String, default: '#409eff' }` prop，并删除 `NODE_COLOR`。

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/EtlNodeCard.vue
git commit -m "feat(m3.5): ETL canvas node card component"
```

---

### Task 6: 改造 DataSourceBuilder.vue（外壳 + tab 映射）

**Files:**
- Modify: `front-end/src/views/DataSourceBuilder.vue`（全文件重写）

- [ ] **Step 1: 重写**

```vue
<template>
  <div class="builder-page" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">数据集构建器</h2>
        <div class="page-desc">数据源：{{ dsName }}（{{ dsType }}）· 三种形态自由切换</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">返回</el-button>
        <el-input v-model="name" placeholder="数据集名称" style="width: 220px" clearable />
        <el-button type="primary" :loading="saving" @click="save">保存数据集</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeMode" @tab-change="onModeChange">
        <el-tab-pane label="纯 SQL" name="sql" />
        <el-tab-pane label="拖拉拽" name="drag" />
        <el-tab-pane label="ETL" name="etl" />
      </el-tabs>
      <div style="min-height: 520px">
        <keep-alive>
          <SqlBuilderTab v-if="activeMode === 'sql'" ref="sqlRef" :datasource-id="dsId" :catalog="catalog" :initial-definition="editDefinition" @change="onChange" />
          <DragBuilderTab v-else-if="activeMode === 'drag'" ref="dragRef" :datasource-id="dsId" :catalog="catalog" :initial-definition="editDefinition" @change="onChange" />
          <EtlBuilderTab v-else ref="etlRef" :datasource-id="dsId" :catalog="catalog" :initial-definition="editDefinition" @change="onChange" />
        </keep-alive>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { datasourceApi, buildApi, datasetApi } from '@/api'
import SqlBuilderTab from '@/components/builder/SqlBuilderTab.vue'
import DragBuilderTab from '@/components/builder/DragBuilderTab.vue'
import EtlBuilderTab from '@/components/builder/EtlBuilderTab.vue'

const route = useRoute()
const router = useRouter()
const dsId = Number(route.params.id)
const activeMode = ref('sql')
const name = ref('')
const loading = ref(false)
const saving = ref(false)
const dsName = ref('')
const dsType = ref('')
const editDatasetId = ref(null)
const editDefinition = ref(null)
const liveDefinition = ref(null)
const catalog = ref([])

const sqlRef = ref(null)
const dragRef = ref(null)
const etlRef = ref(null)

const MODE_MAP = { sql: 'sql', builder: 'drag', etl: 'etl' }

function onChange(payload) {
  liveDefinition.value = payload.definition
}

function currentDefinition() {
  const tabs = liveDefinition.value && liveDefinition.value.type === activeMode.value ? liveDefinition.value : null
  return tabs || liveDefinition.value || (activeMode.value === 'sql' ? sqlRef.value?.getDefinition?.() : activeMode.value === 'drag' ? dragRef.value?.getDefinition?.() : etlRef.value?.getDefinition?.())
}

function onModeChange() {
  const d = activeMode.value === 'sql' ? sqlRef.value?.getDefinition?.() : activeMode.value === 'drag' ? dragRef.value?.getDefinition?.() : etlRef.value?.getDefinition?.()
  if (d) liveDefinition.value = d
}

async function save() {
  if (!name.value.trim()) return ElMessage.warning('请填写数据集名称')
  const definition = currentDefinition()
  if (!definition) return ElMessage.warning('构建定义为空')
  saving.value = true
  try {
    const created = await buildApi.save(dsId, name.value.trim(), definition, editDatasetId.value)
    ElMessage.success(editDatasetId.value ? '数据集已更新' : '数据集创建成功')
    router.push(`/datasets/${created.id}`)
  } finally { saving.value = false }
}

onMounted(async () => {
  loading.value = true
  try {
    const ds = await datasourceApi.get(dsId)
    dsName.value = ds.name
    dsType.value = ds.type
    catalog.value = await buildApi.sqlAssist(dsId)
    const editId = route.query.editDatasetId
    if (editId) {
      editDatasetId.value = Number(editId)
      const dataset = await datasetApi.get(editDatasetId.value)
      name.value = dataset.name
      if (dataset.build_definition) {
        const def = typeof dataset.build_definition === 'string' ? JSON.parse(dataset.build_definition) : dataset.build_definition
        editDefinition.value = def
        activeMode.value = MODE_MAP[def.type] || 'sql'
      }
    }
  } finally { loading.value = false }
})
</script>

<style scoped>
.builder-page { display: flex; flex-direction: column; gap: 16px; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功（此时旧 tab 仍无 `catalog` prop，但 Vue 对多余 prop 无运行时错误，编译通过）。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/views/DataSourceBuilder.vue
git commit -m "feat(m3.5): shell loads catalog once, maps edit definition type to tab"
```

---

### Task 7: 重写 SqlBuilderTab.vue（CodeMirror + SchemaTree）

**Files:**
- Modify: `front-end/src/components/builder/SqlBuilderTab.vue`（全文件重写）

- [ ] **Step 1: 重写**

```vue
<template>
  <div class="sql-builder">
    <div class="sql-builder__left">
      <div class="sql-builder__panel-title">表 / 字段（点「插入」进编辑器）</div>
      <SchemaTree :catalog="schemas" @mount-table="insertTable" @pick-field="insertField" />
    </div>
    <div class="sql-builder__main">
      <SqlCodeMirror v-model="localSql" :catalog="schemas" placeholder="SELECT ... -- 仅支持只读 SQL；表/字段从左侧插入" />
      <div class="sql-builder__toolbar">
        <el-button size="small" type="primary" :loading="previewing" @click="runPreview">执行预览（前 {{ limit }} 行）</el-button>
        <el-button size="small" :loading="importing" :disabled="!previewRows.length" @click="importFields">从结果导入字段</el-button>
        <span v-if="lastError" class="sql-builder__error">{{ lastError }}</span>
      </div>
      <el-table :data="previewRows" size="small" max-height="260" empty-text="点击「执行预览」查看数据">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="120" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import SchemaTree from './SchemaTree.vue'
import SqlCodeMirror from './SqlCodeMirror.vue'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, catalog: { type: Array, default: () => [] } })
const emit = defineEmits(['change'])

const sql = ref('')
const schemas = ref([])
watch(() => props.catalog, (v) => { schemas.value = v || [] }, { immediate: true, deep: true })

const previewRows = ref([])
const previewCols = ref([])
const previewing = ref(false)
const importing = ref(false)
const lastError = ref('')
const limit = 200

const localSql = computed({ get: () => sql.value, set: (v) => { sql.value = v; emitChange() } })
const importedFields = ref([])

function emitChange() {
  emit('change', { definition: { type: 'sql', sql: sql.value, fields: importedFields.value } })
}

function insertTable(tableId) {
  const [schema, table] = tableId.split(':')
  sql.value += ` \`${schema}\`.\`${table}\` `
  emitChange()
  ElMessage({ message: `已插入 ${schema}.${table}`, type: 'success', duration: 900 })
}

function insertField(field, event) {
  const token = event?.shiftKey ? `\`${field.name}\`` : `\`${field.schema}\`.\`${field.table}\`.\`${field.name}\``
  sql.value += ` ${token} `
  emitChange()
  ElMessage({ message: `已插入 ${field.table}.${field.name}`, type: 'success', duration: 900 })
}

async function runPreview() {
  lastError.value = ''
  if (!sql.value.trim()) return ElMessage.warning('请输入 SQL')
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, { type: 'sql', sql: sql.value }, limit)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } catch (e) {
    lastError.value = e.message || '预览失败'
    previewRows.value = []
  } finally { previewing.value = false }
}

async function importFields() {
  if (!previewRows.value.length) return ElMessage.warning('先执行预览再导入字段')
  importing.value = true
  try {
    const cols = Object.keys(previewRows.value[0])
    importedFields.value = cols.map((c) => ({ name: c, label: c, type: 'string' }))
    emitChange()
    ElMessage.success(`已导入 ${cols.length} 个字段`)
  } finally { importing.value = false }
}

defineExpose({ preview: runPreview, getDefinition: () => ({ type: 'sql', sql: sql.value, fields: importedFields.value }) })
</script>

<style scoped>
.sql-builder { display: flex; gap: 12px; height: 100%; }
.sql-builder__left { flex: 0 0 260px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.sql-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.sql-builder__main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sql-builder__toolbar { display: flex; align-items: center; gap: 8px; }
.sql-builder__error { font-size: 12px; color: var(--el-color-danger); }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/SqlBuilderTab.vue
git commit -m "feat(m3.5): SQL tab uses CodeMirror editor + SchemaTree"
```

---

### Task 8: 重写 DragBuilderTab.vue（dataEase 式字段管理）

**Files:**
- Modify: `front-end/src/components/builder/DragBuilderTab.vue`（全文件重写）

关键模型：`rows` 是 `reactive({})`，key 为 `` `${schema}:${table}` ``，值为该表字段行数组（含 `name/type/role/checked/label`）；字段顺序 = 各表内行顺序 × 表在 `tables` 中的顺序。定义 `fields` 从 `rows` 派生。

- [ ] **Step 1: 重写**

```vue
<template>
  <div class="drag-builder">
    <div class="drag-builder__left">
      <div class="drag-builder__panel-title">目录 · 拖「上架」进画布</div>
      <SchemaTree
        :catalog="schemas"
        @mount-table="mountTable"
        @drop.prevent
      />
      <div class="dropzone" @dragover.prevent @drop="onDropTable">
        <el-icon><Plus /></el-icon> 把表拖到这里，或点上架
      </div>
    </div>

    <div class="drag-builder__mid">
      <el-tabs v-model="activeTab" type="card" size="small">
        <!-- 选字段 -->
        <el-tab-pane label="选字段" name="fields">
          <div v-for="t in tables" :key="t.alias" class="field-card">
            <div class="field-card__head">
              <span class="field-card__table">{{ t.schema }}.{{ t.table }}</span>
              <el-input v-model="t.alias" size="small" style="width: 110px" placeholder="别名" @change="emitChange" />
              <el-button link size="small" type="primary" @click="selectAll(t, true)">全选</el-button>
              <el-button link size="small" @click="selectAll(t, false)">清空</el-button>
              <el-button link size="small" type="danger" @click="removeTable(t)">移除</el-button>
            </div>
            <div :ref="(el) => bindSortable(el, tableKey(t))" class="field-card__rows">
              <div v-for="(row, i) in rowList(t)" :key="row.name" class="field-row drag-row">
                <el-checkbox v-model="row.checked" size="small" @change="emitChange" />
                <span class="field-row__name">{{ row.name }}</span>
                <el-input v-model="row.label" size="small" style="width: 120px" placeholder="别名" @change="emitChange" />
                <el-radio-group v-model="row.kind" size="small" @change="onKindChange(row)">
                  <el-radio-button label="dimension">维度</el-radio-button>
                  <el-radio-button label="metric">指标</el-radio-button>
                </el-radio-group>
                <el-tag v-if="row.role" size="small" :type="row.role === 'metric' ? 'primary' : row.role === 'time' ? 'warning' : 'success'" effect="plain">{{ { metric: '指标', dimension: '维度', time: '时间' }[row.role] }}</el-tag>
              </div>
              <el-empty v-if="!rowList(t).length" :image-size="48" description="该表没有可列字段" />
            </div>
          </div>
          <el-empty v-if="!tables.length" description="先上架数据表（左侧目录 → 上架 / 拖入）" />
        </el-tab-pane>

        <!-- 数据关联 -->
        <el-tab-pane label="数据关联" name="assoc">
          <div class="drag-builder__join-title">关联条件（{{ joins.length }}）</div>
          <div v-for="(j, i) in joins" :key="i" class="join-row">
            <el-select v-model="j.type" size="small" style="width: 90px">
              <el-option label="INNER" value="inner" />
              <el-option label="LEFT" value="left" />
              <el-option label="RIGHT" value="right" />
            </el-select>
            <el-select v-model="j.fromAlias" size="small" style="width: 90px" @change="emitChange">
              <el-option v-for="t in tables" :key="t.alias" :value="t.alias" :label="t.alias" />
            </el-select>
            <el-select v-model="j.fromField" size="small" filterable style="width: 140px" @change="emitChange">
              <el-option v-for="f in tableFields(j.fromAlias)" :key="f.name" :value="f.name" :label="f.name" />
            </el-select>
            <span class="join-eq">=</span>
            <el-select v-model="j.toAlias" size="small" style="width: 90px" @change="emitChange">
              <el-option v-for="t in tables" :key="t.alias" :value="t.alias" :label="t.alias" />
            </el-select>
            <el-select v-model="j.toField" size="small" filterable style="width: 140px" @change="emitChange">
              <el-option v-for="f in tableFields(j.toAlias)" :key="f.name" :value="f.name" :label="f.name" />
            </el-select>
            <el-button link size="small" type="danger" @click="joins.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" style="margin-top: 8px" :disabled="tables.length < 2" @click="addJoin">+ 关联条件</el-button>
          <div v-if="tables.length < 2" class="drag-builder__hint">至少上架 2 张表才能关联</div>
        </el-tab-pane>

        <!-- 聚合 -->
        <el-tab-pane label="聚合" name="agg">
          <el-switch v-model="useAgg" size="small" active-text="启用聚合" @change="emitChange" />
          <template v-if="useAgg">
            <div class="agg-block">
              <div class="agg-title">分组维度</div>
              <el-select v-model="aggGroupBy" multiple collapse-tags filterable size="small" style="width: 100%">
                <el-option v-for="o in fieldOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </div>
            <div class="agg-block">
              <div class="agg-title">聚合指标</div>
              <div v-for="(m, i) in aggMetrics" :key="i" class="agg-metric">
                <el-select v-model="m.agg" size="small" style="width: 130px" @change="emitChange">
                  <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
                </el-select>
                <el-select v-if="m.agg !== 'count'" v-model="m.field" size="small" filterable style="width: 160px" @change="emitChange">
                  <el-option v-for="o in fieldOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-button link size="small" type="danger" @click="aggMetrics.splice(i, 1); emitChange()">删</el-button>
              </div>
              <el-button size="small" style="margin-top: 6px" @click="aggMetrics.push({ agg: 'sum', field: '' }); emitChange()">+ 指标</el-button>
            </div>
          </template>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div class="drag-builder__preview">
      <div class="drag-builder__panel-title">{{ useAgg ? '聚合预览' : '明细预览' }}（前 {{ previewLimit }} 行）</div>
      <el-button size="small" :loading="previewing" class="drag-builder__preview-btn" @click="runPreview">执行预览</el-button>
      <el-table :data="previewRows" size="small" max-height="400" empty-text="执行预览查看数据">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS } from '@/utils/catalog'
import SchemaTree from './SchemaTree.vue'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, catalog: { type: Array, default: () => [] }, initialDefinition: Object })
const emit = defineEmits(['change'])

const schemas = ref([])
watch(() => props.catalog, (v) => { schemas.value = v || [] }, { immediate: true, deep: true })

const activeTab = ref('fields')
const tables = ref([])            // [{ alias, schema, table }]
const joins = ref([])             // [{ type, fromAlias, fromField, toAlias, toField }]
const rows = reactive({})         // `${schema}:${table}` -> [{ name, type, role, checked, label, kind }]
const useAgg = ref(false)
const aggGroupBy = ref([])
const aggMetrics = ref([])
const previewing = ref(false)
const previewRows = ref([])
const previewCols = ref([])
const previewLimit = 200
const sortables = {}

function tableKey(t) { return `${t.schema}:${t.table}` }

function catalogTableId(id) {
  const [schema, table] = id.split(':')
  for (const s of schemas.value) {
    const found = (s.tables || []).find((t) => t.table === table && s.schema === schema)
    if (found) return { schema, table, columns: found.columns || [] }
  }
  return null
}

function rowList(t) { return rows[tableKey(t)] || [] }

function bindSortable(el, key) {
  if (!el || sortables[key]) return
  sortables[key] = Sortable.create(el, {
    group: 'drag-fields',
    draggable: '.drag-row',
    animation: 150,
    onEnd: ({ oldIndex, newIndex }) => {
      const arr = rows[key]
      if (!arr || oldIndex === newIndex) return
      const [moved] = arr.splice(oldIndex, 1)
      arr.splice(newIndex, 0, moved)
      emitChange()
    },
  })
}

function initRowsForTable(key, columns) {
  if (!rows[key]) {
    rows[key] = (columns || []).map((c) => ({
      name: c.name, type: c.type || 'string', role: c.role || '',
      checked: false, label: c.name, kind: c.role === 'metric' ? 'metric' : 'dimension',
    }))
  }
  // 补齐 catalog 新增列
  for (const c of columns || []) {
    if (!rows[key].some((r) => r.name === c.name)) rows[key].push({ name: c.name, type: c.type || 'string', role: c.role || '', checked: false, label: c.name, kind: c.role === 'metric' ? 'metric' : 'dimension' })
  }
}

function mountTable(id, keepAlias = false) {
  const meta = catalogTableId(id)
  if (!meta) return ElMessage.warning('未在目录中找到该表')
  if (tables.value.some((t) => t.schema === meta.schema && t.table === meta.table)) return
  const key = `${meta.schema}:${meta.table}`
  initRowsForTable(key, meta.columns)
  tables.value.push({ alias: keepAlias ? keepAlias : `t${tables.value.length}`, schema: meta.schema, table: meta.table })
  tryPreJoin()
  emitChange()
}

function onDropTable(e) {
  const id = e.dataTransfer.getData('text/plain')
  if (id && id.includes(':')) mountTable(id)
}

function removeTable(t) {
  tables.value = tables.value.filter((x) => x.alias !== t.alias)
  joins.value = joins.value.filter((j) => j.fromAlias !== t.alias && j.toAlias !== t.alias)
  emitChange()
}

function selectAll(t, on) {
  const arr = rows[tableKey(t)]
  if (!arr) return
  arr.forEach((r) => { r.checked = on })
  emitChange()
}

function onKindChange(row) {
  row.type = row.kind === 'metric' ? 'number' : (row.kind === 'dimension' ? (row.role === 'time' ? 'date' : 'string') : 'string')
  emitChange()
}

function tableFields(alias) {
  const t = tables.value.find((x) => x.alias === alias)
  return t ? allFields(schemas.value, tableKey(t)).map((f) => ({ name: f.name, type: f.type })) : []
}

function tryPreJoin() {
  if (tables.value.length < 2) return
  const prev = tables.value[tables.value.length - 2]
  const cur = tables.value[tables.value.length - 1]
  const prevFields = tableFields(prev.alias).map((f) => f.name.toLowerCase())
  const curFields = tableFields(cur.alias).map((f) => f.name.toLowerCase())
  const common = prevFields.find((n) => curFields.includes(n))
  if (common) {
    joins.value.push({ type: 'inner', fromAlias: prev.alias, fromField: prevFields.find((n) => n === common), toAlias: cur.alias, toField: curFields.find((n) => n === common) })
    emitChange()
  }
}

function addJoin() {
  if (tables.value.length >= 2) {
    joins.value.push({ type: 'inner', fromAlias: tables.value[0].alias, fromField: '', toAlias: tables.value[1].alias, toField: '' })
    emitChange()
  }
}

const fieldOptions = computed(() => {
  const out = []
  for (const t of tables.value) {
    for (const r of rowList(t)) {
      if (r.checked) out.push({ value: `${t.alias}.${r.name}`, label: `${t.alias}.${r.name}`, source: t.alias, field: r.name })
    }
  }
  return out
})

const definition = computed(() => ({
  type: 'builder',
  tables: tables.value,
  joins: joins.value.map((j) => ({ type: j.type, from: { alias: j.fromAlias, field: j.fromField }, to: { alias: j.toAlias, field: j.toField } })),
  fields: tables.value.flatMap((t) => (rowList(t) || []).filter((r) => r.checked).map((r) => ({ source: t.alias, field: r.name, label: r.label, type: r.type }))),
  aggregation: useAgg.value ? { groupBy: aggGroupBy.value.map((g) => ({ alias: g.split('.')[0], field: g.split('.')[1] })), metrics: aggMetrics.value.filter((m) => m.field) } : null,
  limit: 1000,
}))

function emitChange() { emit('change', { definition: definition.value }) }

async function runPreview() {
  if (!tables.value.length) return ElMessage.warning('先上架数据表')
  if (!definition.value.fields.length) return ElMessage.warning('至少勾选一个字段')
  previewing.value = true
  try {
    if (useAgg.value) {
      const res = await buildApi.previewAggregate(props.datasourceId, definition.value, definition.value.aggregation, 1000)
      previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
      previewRows.value = res.rows
    } else {
      const res = await buildApi.previewDetail(props.datasourceId, definition.value, previewLimit)
      previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
      previewRows.value = res.rows
    }
  } finally { previewing.value = false }
}

function restore(def) {
  if (!def || def.type !== 'builder') return
  tables.value = (def.tables || []).map((t) => ({ alias: t.alias, schema: t.schema, table: t.table }))
  joins.value = (def.joins || []).map((j) => ({ type: j.type || 'inner', fromAlias: j.from?.alias, fromField: j.from?.field, toAlias: j.to?.alias, toField: j.to?.field }))
  for (const t of tables.value) {
    const key = tableKey(t)
    const meta = catalogTableId(key)
    initRowsForTable(key, meta ? meta.columns : [])
  }
  const order = []
  for (const f of def.fields || []) {
    const t = tables.value.find((x) => x.alias === f.source)
    if (!t) continue
    const arr = rows[tableKey(t)]
    const row = arr && arr.find((r) => r.name === f.field)
    if (row) {
      row.checked = true
      row.label = f.label || f.field
      row.type = f.type || row.type
      row.kind = row.type === 'number' ? 'metric' : 'dimension'
      order.push(row)
    }
  }
  // 保持定义中的字段顺序：将已勾选行前移到各自表内首部（顺序 = 定义顺序）
  for (const t of tables.value) {
    const key = tableKey(t)
    const arr = rows[key] || []
    const after = rows[key] || []
    const moved = after.filter((r) => r.checked)
    const rest = after.filter((r) => !r.checked)
    rows[key] = [...moved, ...rest]
  }
  if (def.aggregation) {
    useAgg.value = true
    aggGroupBy.value = (def.aggregation.groupBy || []).map((g) => `${g.alias}.${g.field}`)
    aggMetrics.value = (def.aggregation.metrics || []).map((m) => ({ agg: m.agg, field: `${m.source || ''}.${m.field}`.replace(/^\./, '') }))
  }
  emitChange()
}

watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })
defineExpose({ getDefinition: () => definition.value })
</script>

<style scoped>
.drag-builder { display: flex; gap: 12px; height: 100%; }
.drag-builder__left { flex: 0 0 260px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.drag-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.dropzone { margin-top: 12px; border: 1px dashed var(--el-border-color); border-radius: 6px; padding: 14px; text-align: center; font-size: 12px; color: var(--app-text-secondary); display: flex; align-items: center; justify-content: center; gap: 4px; }
.drag-builder__mid { flex: 1; min-width: 480px; overflow: auto; }
.drag-builder__preview { flex: 0 0 40%; min-width: 360px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.drag-builder__preview-btn { margin-bottom: 8px; }
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

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/DragBuilderTab.vue
git commit -m "feat(m3.5): drag tab becomes dataEase-style field management"
```

---

### Task 9: 重写 EtlBuilderTab.vue（Vue Flow 画布）

**Files:**
- Modify: `front-end/src/components/builder/EtlBuilderTab.vue`（全文件重写）

设计要点：Vue Flow 画布 + 左算子托盘 + 右配置/预览；节点/边由 `defNodes`（含 `x/y`）派生；单源单输出固定链约束；撤销/重做只记结构操作（≤30 步）。节点定义新增 `joinType`（join 节点），输出到后端。

- [ ] **Step 1: 重写**

```vue
<template>
  <div class="etl-builder">
    <div class="etl-builder__left">
      <div class="etl-builder__panel-title">算子</div>
      <div
        v-for="op in palette"
        :key="op.type"
        class="palette-item"
        :class="{ 'palette-item--disabled': !op.enabled() }"
        draggable="true"
        @dragstart="onPaletteDrag($event, op.type)"
        @click="op.enabled() && addNode(op.type)"
      >
        <span class="palette-item__icon" :style="{ background: op.color }">{{ op.short }}</span>
        <span class="palette-item__label">{{ op.label }}</span>
      </div>
      <el-divider />
      <div class="etl-builder__panel-title">表 / 字段</div>
      <SchemaTree :catalog="schemas" @pick-field="() => {}" />
    </div>

    <div class="etl-builder__canvas" @dragover.prevent @drop="onCanvasDrop">
      <VueFlow
        :nodes="flowNodes"
        :edges="flowEdges"
        :is-valid-connection="isValidConnection"
        :delete-key-code="null"
        :fit-view-on-init="false"
        :default-viewport="{ zoom: 0.9, x: 40, y: 40 }"
        @connect="onConnect"
        @node-click="onNodeClick"
        @node-drag-stop="onDragStop"
        @edge-click="onEdgeClick"
      >
        <Background :gap="16" pattern-color="var(--app-border)" />
        <Controls position="top-right" />
        <template #node-etlNode="{ data }">
          <EtlNodeCard :node="data.node" :node-color="nodeColor(data.node)" :error="data.error" :selected="data.selected" @click.stop="selectNode(data.node)" />
        </template>
      </VueFlow>
    </div>

    <div class="etl-builder__right">
      <div class="etl-builder__panel-title">画布工具栏</div>
      <div class="toolbar">
        <el-button size="small" @click="undo" :disabled="!past.length">撤销</el-button>
        <el-button size="small" @click="redo" :disabled="!future.length">重做</el-button>
        <el-button size="small" @click="autoLayout">自动布局</el-button>
      </div>

      <div class="etl-builder__panel-title">配置</div>
      <template v-if="activeNode">
        <div class="etl-builder__node-head">
          <span>{{ nodeTitle(activeNode) }}</span>
          <el-button v-if="canDelete(activeNode)" link size="small" type="danger" @click="deleteNode(activeNode.nodeId)">删除节点</el-button>
        </div>

        <template v-if="activeNode.nodeType === 'source'">
          <div class="etl-builder__field">表
            <el-select v-model="activeNode._tableValue" size="small" filterable @change="onSourceChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
        </template>

        <template v-if="activeNode.nodeType === 'join'">
          <div class="etl-builder__field">关联类型
            <el-select v-model="activeNode.joinType" size="small" style="width: 120px" @change="emitChange">
              <el-option label="INNER" value="inner" />
              <el-option label="LEFT" value="left" />
              <el-option label="RIGHT" value="right" />
            </el-select>
          </div>
          <div class="etl-builder__field">关联表
            <el-select v-model="activeNode._joinTableValue" size="small" filterable @change="onJoinTableChange">
              <el-option v-for="t in tableOptions" :key="t.id" :label="t.label" :value="t.id" />
            </el-select>
          </div>
          <div v-for="(c, i) in activeNode.on" :key="i" class="etl-builder__field">
            目标 {{ activeNode.to.alias }}:
            <el-select v-model="c.to.field" size="small" style="width: 130px" @change="emitChange">
              <el-option v-for="f in joinTargetFields" :key="f.name" :label="f.name" :value="f.name" />
            </el-select>
            = 源字段:
            <el-select v-model="c.from.field" size="small" style="width: 130px" @change="emitChange">
              <el-option v-for="f in sourceFields(activeNode, true)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-button link size="small" type="danger" @click="activeNode.on.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.on.push({ from: { alias: 't0', field: '' }, to: { alias: activeNode.to.alias, field: '' } }); emitChange()">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'filter'">
          <div v-for="(c, i) in activeNode.conditions" :key="i" class="etl-builder__field">
            <el-select v-model="c.field.alias" size="small" style="width: 70px" @change="emitChange">
              <el-option v-for="t in chainTables" :key="t.alias" :label="t.alias" :value="t.alias" />
            </el-select>
            <el-select v-model="c.field.field" size="small" style="width: 120px" @change="emitChange">
              <el-option v-for="f in filterFields" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-select v-model="c.op" size="small" style="width: 90px" @change="emitChange">
              <el-option v-for="o in STRING_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input v-model="c.value" size="small" style="width: 120px" @change="emitChange" />
            <el-button link size="small" type="danger" @click="activeNode.conditions.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.conditions.push({ field: { alias: 't0', field: '' }, op: 'eq', value: '' }); emitChange()">+ 条件</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'aggregate'">
          <div class="etl-builder__field">分组
            <el-select v-model="activeNode.groupBy" multiple collapse-tags filterable size="small" style="width: 100%" @change="emitChange">
              <el-option v-for="f in sourceFields(activeNode, false)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
          </div>
          <div v-for="(m, i) in activeNode.metrics" :key="i" class="etl-builder__field">
            <el-select v-model="m.agg" size="small" style="width: 120px" @change="emitChange">
              <el-option v-for="a in AGG_OPTIONS" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-select v-if="m.agg !== 'count'" v-model="m.field" size="small" style="width: 140px" filterable @change="emitChange">
              <el-option v-for="f in sourceFields(activeNode, false)" :key="f.pref" :label="f.pref" :value="f.pref" />
            </el-select>
            <el-button link size="small" type="danger" @click="activeNode.metrics.splice(i, 1); emitChange()">删</el-button>
          </div>
          <el-button size="small" @click="activeNode.metrics.push({ agg: 'sum', field: '' }); emitChange()">+ 指标</el-button>
        </template>

        <template v-if="activeNode.nodeType === 'output'">
          <div class="etl-builder__field">输出行数上限
            <el-input-number v-model="activeNode.limit" :min="1" :max="100000" size="small" @change="emitChange" />
          </div>
        </template>

        <div class="etl-builder__preview-actions">
          <el-button size="small" type="primary" :loading="previewingNode === activeNode.nodeId" @click="previewNode(activeNode)">预览此节点</el-button>
          <span v-if="nodeError[activeNode.nodeId]" class="etl-builder__error">{{ nodeError[activeNode.nodeId] }}</span>
        </div>
      </template>
      <el-empty v-else description="点击画布节点进行配置" />

      <div class="etl-builder__panel-title" style="margin-top: 16px">节点预览</div>
      <el-table v-if="nodePreview.length" :data="nodePreview" size="small" max-height="360">
        <el-table-column v-for="c in nodePreviewCols" :key="c" :prop="c" :label="c" min-width="110" show-overflow-tooltip />
      </el-table>
      <el-empty v-else :description="activeNode ? '点击「预览此节点」查看真实数据' : '选择节点后预览'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { allFields, AGG_OPTIONS, STRING_OPS } from '@/utils/catalog'
import SchemaTree from './SchemaTree.vue'
import EtlNodeCard from './EtlNodeCard.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/background/dist/style.css'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, catalog: { type: Array, default: () => [] }, initialDefinition: Object })
const emit = defineEmits(['change'])

const schemas = ref([])
watch(() => props.catalog, (v) => { schemas.value = v || [] }, { immediate: true, deep: true })

const NODE_META = {
  source: { label: '输入源', short: '源', color: '#67c23a' },
  join: { label: '关联', short: '联', color: '#909399' },
  filter: { label: '过滤', short: '筛', color: '#e6a23c' },
  aggregate: { label: '聚合', short: '聚', color: '#409eff' },
  output: { label: '输出', short: '出', color: '#f56c6c' },
}
const NODE_ORDER = ['source', 'join', 'filter', 'aggregate', 'output']

// eslint-disable-next-line no-unused-vars
const noop = () => {}

const nodes = ref([])      // [{ nodeId, nodeType, sourceNode, x, y, ...defProps, _tableValue?, _joinTableValue?, joinType? }]
const past = ref([])
const future = ref([])
const selectedNodeId = ref(null)
const previewingNode = ref(null)
const nodePreview = ref([])
const nodePreviewCols = ref([])
const nodeError = ref({})

const { screenToFlowCoordinate, fitView } = useVueFlow()

const palette = computed(() => [
  { type: 'source', ...NODE_META.source, enabled: () => !nodes.value.some((n) => n.nodeType === 'source') },
  { type: 'join', ...NODE_META.join, enabled: () => true },
  { type: 'filter', ...NODE_META.filter, enabled: () => true },
  { type: 'aggregate', ...NODE_META.aggregate, enabled: () => true },
  { type: 'output', ...NODE_META.output, enabled: () => !nodes.value.some((n) => n.nodeType === 'output') },
])

const activeNode = computed(() => nodes.value.find((n) => n.nodeId === selectedNodeId.value) || null)
const tableOptions = computed(() => {
  const out = []
  for (const s of schemas.value) for (const t of s.tables || []) out.push({ id: `${s.schema}:${t.table}`, label: `${s.schema}.${t.table}`, schema: s.schema, table: t.table })
  return out
})
const chainTables = computed(() => nodes.value.filter((n) => n.nodeType === 'source').map((n) => ({ alias: n.alias, schema: n.schema, table: n.table })))
const joinTargetFields = computed(() => (activeNode.value?.nodeType === 'join' ? allFields(schemas.value, `${activeNode.value.to.schema}:${activeNode.value.to.table}`) : []))
const filterFields = computed(() => (activeNode.value?.nodeType === 'filter' ? sourceFields(activeNode.value, true) : []))

const flowNodes = computed(() => nodes.value.map((n) => ({
  id: n.nodeId,
  type: 'etlNode',
  position: { x: n.x || 0, y: n.y || 0 },
  data: { node: n, error: nodeError.value[n.nodeId] || null, selected: selectedNodeId.value === n.nodeId },
})))
const flowEdges = computed(() => nodes.value.filter((n) => n.sourceNode && n.nodeType !== 'source').map((n) => ({
  id: `e_${n.sourceNode}_${n.nodeId}`,
  source: n.sourceNode,
  target: n.nodeId,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
})))

function nodeColor(n) { return NODE_META[n.nodeType]?.color || '#409eff' }
function nodeTitle(n) { return NODE_META[n.nodeType]?.label || n.nodeType }

function canDelete(n) { return ['join', 'filter', 'aggregate'].includes(n.nodeType) }

function stripInternal(nodesArr) {
  return JSON.parse(JSON.stringify(nodesArr)).map((n) => {
    const o = { ...n }
    for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]
    return o
  })
}

const definition = computed(() => ({ type: 'etl', nodes: stripInternal(nodes.value) }))
function emitChange() { emit('change', { definition: definition.value }) }

function defNode(nodeId) { return nodes.value.find((n) => n.nodeId === nodeId) }

/* ---- 固定链约束 ---- */
function isValidConnection(c) {
  const from = defNode(c.source)
  const to = defNode(c.target)
  if (!from || !to || from.nodeId === to.nodeId) return false
  if (from.nodeType === 'output' || to.nodeType === 'source') return false
  if (to.sourceNode && to.sourceNode !== from.nodeId) return false
  // 防御成环（单输入规则下理论不可达）
  let cur = from
  while (cur) {
    if (cur.nodeId === to.nodeId) return false
    cur = cur.sourceNode ? defNode(cur.sourceNode) : null
  }
  return true
}

function pushSnapshot() {
  past.value.push(JSON.stringify(stripInternal(nodes.value)))
  if (past.value.length > 30) past.value.shift()
  future.value = []
}
function restoreFromSnapshot(list) {
  const snap = list.pop()
  if (!snap) return
  future.value.push(JSON.stringify(stripInternal(nodes.value)))
  const arr = JSON.parse(snap)
  rehydrate(arr)
  nodes.value = arr
  autoLayout(false)
  emitChange()
}
function undo() { restoreFromSnapshot(past.value) }
function redo() { restoreFromSnapshot(future.value) }

function rehydrate(arr) {
  for (const n of arr) {
    if (n.nodeType === 'source') n._tableValue = n.schema && n.table ? `${n.schema}:${n.table}` : ''
    if (n.nodeType === 'join') {
      n._joinTableValue = n.to?.schema && n.to?.table ? `${n.to.schema}:${n.to.table}` : ''
      n.joinType = n.joinType || 'inner'
    }
  }
}

function autoLayout(push = true) {
  if (push) pushSnapshot()
  const ordered = [...nodes.value].sort((a, b) => NODE_ORDER.indexOf(a.nodeType) - NODE_ORDER.indexOf(b.nodeType) || (a.y || 0) - (b.y || 0))
  let xi = 0
  for (const n of ordered) { n.x = xi; xi += 230; n.y = 0 }
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
}

function ensureChain() {
  let prev = null
  for (const n of nodes.value) {
    if (n.nodeType === 'source') { prev = n; continue }
    if (prev) n.sourceNode = prev.nodeId
    prev = n
  }
  let out = nodes.value.find((n) => n.nodeType === 'output')
  if (!out) {
    const last = nodes.value[nodes.value.length - 1]
    nodes.value.push({ nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: last?.nodeId, limit: 1000 })
  }
  const outIdx = nodes.value.indexOf(out)
  if (outIdx !== nodes.value.length - 1 && out) {
    nodes.value.splice(outIdx, 1)
    nodes.value.push(out)
  }
  const lastReal = nodes.value.filter((n) => n.nodeType !== 'output').slice(-1)[0]
  out = nodes.value.find((n) => n.nodeType === 'output')
  if (out) out.sourceNode = lastReal?.nodeId
  emitChange()
}

let counter = 1
function makeNodeId(kind) { return `n_${kind}_${counter++}_${Date.now() % 100000}` }

function addNode(type, pos) {
  if (type === 'source' && nodes.value.some((n) => n.nodeType === 'source')) return ElMessage.warning('已存在输入源')
  if (type === 'output' && nodes.value.some((n) => n.nodeType === 'output')) return ElMessage.warning('已存在输出')
  pushSnapshot()
  const node = makeNode(type)
  node.x = pos?.x ?? null
  node.y = pos?.y ?? null
  // 插入到 output 之前
  const outIdx = nodes.value.findIndex((n) => n.nodeType === 'output')
  if (outIdx >= 0) nodes.value.splice(outIdx, 0, node)
  else nodes.value.push(node)
  ensureChain()
  if (node.x == null) autoLayout()
  else emitChange()
  selectedNodeId.value = node.nodeId
}
function makeNode(type) {
  if (type === 'source') return { nodeId: makeNodeId('source'), nodeType: 'source', alias: 't0', schema: null, table: null, _tableValue: '' }
  if (type === 'join') return {
    nodeId: makeNodeId('join'), nodeType: 'join', joinType: 'inner', sourceNode: null,
    to: { alias: `t${chainTables.value.length + 1}`, schema: null, table: null },
    on: [{ from: { alias: 't0', field: '' }, to: { alias: `t${chainTables.value.length + 1}`, field: '' } }],
    _joinTableValue: '',
  }
  if (type === 'filter') return { nodeId: makeNodeId('filter'), nodeType: 'filter', sourceNode: null, conditions: [{ field: { alias: 't0', field: '' }, op: 'eq', value: '' }] }
  if (type === 'aggregate') return { nodeId: makeNodeId('aggregate'), nodeType: 'aggregate', sourceNode: null, groupBy: [], metrics: [{ agg: 'sum', field: '' }] }
  if (type === 'output') return { nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: null, limit: 1000 }
  return null
}

function deleteNode(nodeId) {
  const idx = nodes.value.findIndex((n) => n.nodeId === nodeId)
  if (idx < 0) return
  if (['source', 'output'].includes(nodes.value[idx].nodeType)) return ElMessage.warning('输入源与输出节点不可删除')
  pushSnapshot()
  const removed = nodes.value[idx]
  const parentId = removed.sourceNode
  nodes.value.splice(idx, 1)
  // 后续节点指向被删节点的前驱
  for (const n of nodes.value) if (n.sourceNode === nodeId) n.sourceNode = parentId
  ensureChain()
  if (selectedNodeId.value === nodeId) selectedNodeId.value = null
}

function onConnect(c) {
  pushSnapshot()
  const to = defNode(c.target)
  if (!to) return
  to.sourceNode = c.source
  ensureChain()
}

function onEdgeClick(edge) {
  const to = defNode(edge.target)
  if (!to) return
  pushSnapshot()
  to.sourceNode = null
  ensureChain()
}

function onNodeClick({ node }) { selectNode(defNode(node.id)) }
function onDragStop({ node }) {
  const n = defNode(node.id)
  if (n) { n.x = node.position.x; n.y = node.position.y }
}
function selectNode(n) { if (n) selectedNodeId.value = n.nodeId }

function onPaletteDrag(e, type) { e.dataTransfer.setData('text/plain', type) }
function onCanvasDrop(e) {
  const type = e.dataTransfer.getData('text/plain')
  if (!type || !NODE_META[type]) return
  const pos = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
  addNode(type, pos)
}

/* ---- 节点配置联动 ---- */
function onSourceChange() {
  const n = activeNode.value
  if (!n) return
  const val = n._tableValue
  if (val && val.includes(':')) {
    const [schema, table] = val.split(':')
    n.schema = schema
    n.table = table
    if (!n.alias) n.alias = `t${nodes.value.filter((x) => x.nodeType === 'source').length}`
    ensureChain()
  }
}
function onJoinTableChange() {
  const n = activeNode.value
  if (!n || n.nodeType !== 'join') return
  const val = n._joinTableValue
  if (val && val.includes(':')) {
    const [schema, table] = val.split(':')
    n.to.schema = schema
    n.to.table = table
    if (!n.to.alias) n.to.alias = `t${chainTables.value.length + 1}`
    emitChange()
  }
}

function sourceFields(n, includePrefPrefix) {
  const out = []
  for (const src of nodes.value) {
    if (src.nodeType === 'source') for (const f of allFields(schemas.value, `${src.schema}:${src.table}`)) out.push({ ...f, pref: `${src.alias}.${f.name}` })
    if (src.nodeType === 'join') for (const f of allFields(schemas.value, `${src.to?.schema}:${src.to?.table}`)) out.push({ ...f, pref: `${src.to?.alias}.${f.name}` })
  }
  return out
}

/* ---- 预览 ---- */
async function previewNode(node) {
  previewingNode.value = node.nodeId
  nodeError.value[node.nodeId] = null
  try {
    const res = await buildApi.previewNode(props.datasourceId, definition.value, node.nodeId, 200)
    nodePreview.value = res.rows
    nodePreviewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
  } catch (e) {
    nodeError.value[node.nodeId] = e.message || '节点执行失败'
  } finally { previewingNode.value = null }
}

/* ---- 还原 & 挂载 ---- */
function restore(def) {
  if (!def || def.type !== 'etl') return
  const arr = JSON.parse(JSON.stringify(def.nodes || []))
  if (!arr.some((n) => n.nodeType === 'source')) {
    arr.unshift({ nodeId: makeNodeId('source'), nodeType: 'source', alias: 't0', schema: null, table: null })
  }
  if (!arr.some((n) => n.nodeType === 'output')) {
    const last = arr[arr.length - 1]
    arr.push({ nodeId: makeNodeId('output'), nodeType: 'output', sourceNode: last?.nodeId, limit: 1000 })
  }
  rehydrate(arr)
  const hasPos = arr.every((n) => typeof n.x === 'number')
  if (!hasPos) {
    // 简单行式布局
    let xi = 0
    for (const n of arr) { n.x = xi; xi += 230; n.y = 0 }
  }
  nodes.value = arr
  // 依据 sourceNode 重建顺序（把被指节点排到引用者之后）
  orderByChain()
  emitChange()
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
}

function orderByChain() {
  const ordered = []
  const seen = new Set()
  const head = nodes.value.find((n) => n.nodeType === 'source')
  const pool = [...nodes.value]
  let cur = head
  while (cur && !seen.has(cur.nodeId)) {
    seen.add(cur.nodeId)
    ordered.push(cur)
    cur = nodes.value.find((n) => n.sourceNode === cur.nodeId)
  }
  for (const n of pool) if (!seen.has(n.nodeId)) ordered.push(n)
  nodes.value = ordered
  ensureChain()
}

watch(() => props.initialDefinition, (d) => { if (d) restore(d) }, { immediate: true, deep: true })

defineExpose({ getDefinition: () => definition.value })

onMounted(() => {
  if (!nodes.value.length) {
    addNode('source')
    ensureChain()
  }
  void nextTick(() => fitView({ padding: 0.2, duration: 0 }))
})
</script>

<style scoped>
.etl-builder { display: flex; gap: 12px; height: 100%; }
.etl-builder__left { flex: 0 0 190px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__canvas { flex: 1; min-width: 480px; border: 1px solid var(--el-border-color); border-radius: 8px; position: relative; overflow: hidden; background: var(--app-bg); }
.etl-builder__right { flex: 0 0 340px; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; overflow: auto; }
.etl-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.palette-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 6px; border: 1px solid var(--el-border-color-light); border-radius: 6px; cursor: grab; font-size: 12px; }
.palette-item:hover { border-color: var(--app-primary); }
.palette-item--disabled { opacity: .45; cursor: not-allowed; }
.palette-item__icon { width: 22px; height: 22px; border-radius: 4px; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex: 0 0 auto; }
.palette-item__label { color: var(--app-text-primary); }
.etl-builder__node-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-weight: 600; }
.etl-builder__field { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; flex-wrap: wrap; }
.etl-builder__preview-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.etl-builder__error { font-size: 12px; color: var(--el-color-danger); }
.toolbar { display: flex; gap: 6px; margin-bottom: 12px; }
</style>
```

`import { onMounted, nextTick }` 在 `script setup` 中需要从 'vue' 导入；上方 `script setup` 第一行已是 `import { ref, computed, watch, nextTick, onMounted } from 'vue'`。请确认 NoStep 与 onMounted 均已导入。

又注意：Vue Flow 的 canvas 高度需要有明确值，`fitView` 需要容器已渲染。在 `.etl-builder__canvas` 外层已撑满 `min-height:520px` 容器，VueFlow 会自适应剩余高度；若异常可给 `.etl-builder` 加 `height: calc(100vh - 260px)`。保留当前结构即可。

- [ ] **Step 2: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add front-end/src/components/builder/EtlBuilderTab.vue front-end/src/components/builder/EtlNodeCard.vue
git commit -m "feat(m3.5): ETL tab becomes Vue Flow canvas with palette/undo/redo"
```

---

### Task 10: 精修 DataSourceDetail.vue 库表树

**Files:**
- Modify: `front-end/src/views/DataSourceDetail.vue`（仅模板与 `<script>` 的 `<template #default>` 部分 / 图标徽标；保留 lazyload、接口调用逻辑不变）

- [ ] **Step 1: 改造模板**

把 `DataSourceDetail.vue` 的 `<el-tree>` 默认插槽替换为带图标 + hover 操作：

```vue
      <el-tree
        v-if="schemas.length"
        :data="schemaTree"
        lazy
        :load="loadNode"
        node-key="id"
      >
        <template #default="{ data }">
          <span class="tree-node">
            <el-icon :size="14" class="tree-node__icon"><component :is="iconOf(data.type)" /></el-icon>
            <span class="tree-node__label">{{ data.label }}</span>
            <el-tag v-if="data.type === 'column' && typeBadge(data)" size="small" effect="plain" :type="typeBadge(data).type">{{ typeBadge(data).text }}</el-tag>
            <span class="tree-node__actions">
              <el-button v-if="data.type === 'table'" link size="small" type="primary" @click.stop="openBuilder(`${data.schema}:${data.label}`)">新建构建</el-button>
              <el-button v-if="data.type === 'table'" link size="small" @click.stop="createDataset(data)">创建数据集</el-button>
            </span>
          </span>
        </template>
      </el-tree>
```

- [ ] **Step 2: script 增加辅助函数**

在 `DataSourceDetail.vue` 的 `<script setup>` 中增加：

```js
import { Folder, Grid, Element } from '@element-plus/icons-vue'

function iconOf(type) {
  return type === 'schema' ? Folder : type === 'table' ? Grid : Element
}

function typeBadge(data) {
  const raw = data.rawType || ''
  const t = raw.startsWith('int') || /decimal|numeric|double|float/.test(raw) ? { type: 'primary', text: '数值' } : /date|time/.test(raw) ? { type: 'warning', text: '时间' } : { type: 'success', text: '文本' }
  return t
}
```

并把 `loadNode` 的 column 渲染改成记录 `rawType`：

```js
    } else if (data.type === 'table') {
      const cols = await datasourceApi.columns(id, data.schema, data.label)
      resolve(cols.map((c) => ({
        id: `${data.schema}-${data.label}-${c.name}`, label: c.name, type: 'column', rawType: c.type, isLeaf: true,
      })))
    }
```

- [ ] **Step 3: scoped 样式**

在 `DataSourceDetail.vue` 的 `<style scoped>` 追加：

```css
.tree-node { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.tree-node__icon { color: var(--app-text-secondary); }
.tree-node__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree-node__actions { display: none; gap: 2px; }
.el-tree-node__content:hover .tree-node__actions { display: flex; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); border-radius: 4px; }
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add front-end/src/views/DataSourceDetail.vue
git commit -m "feat(m3.5): polish datasource detail schema tree visuals"
```

---

### Task 11: 端到端验证

**Files:**
- Create: `test-m35-e2e.mjs`

- [ ] **Step 1: 后端回归 + 前端构建**

Run: `npm test`（在 `backend/`）
Expected: ALL PASS（130 → 131，Task 1 新增一条）

Run: `npm run build`（在 `front-end/`）
Expected: 构建成功。

- [ ] **Step 2: 准备 CDP 冒烟脚本**

```js
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:5173'
const API = 'http://localhost:3001/api'
const outDir = '/tmp/opencode/cdp-m3.5'

const results = []
function record(name, ok, extra = '') { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`) }

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[placeholder*="邮箱" i], input[type="email"], input[placeholder*="邮箱"]', 'admin@example.com')
  await page.fill('input[placeholder*="密码" i], input[type="password"]', 'admin123')
  await page.click('button:has-text("登录")')
  await page.waitForURL(/dashboard|datasets|/ , { timeout: 10000 })
}

async function makeBuilderDataset(page, name, definition) {
  const res = await (await fetch(`${API}/build/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, definition, datasourceId: 1 }),
  })).json()
  if (!res || !res.id) throw new Error('build save failed: ' + JSON.stringify(res))
  return res.id
}

const browser = await chromium.launch({ args: ['--remote-debugging-port=0'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await login(page)

// 1. 编辑态 tab 自动映射：三种定义的编辑进入
const cases = [
  { type: 'sql', tabName: '纯 SQL', def: { type: 'sql', sql: 'SELECT 1' } },
  { type: 'builder', tabName: '拖拉拽', def: { type: 'builder', tables: [{ alias: 't0', schema: 'testdb', table: 'sales' }], joins: [], fields: [{ source: 't0', field: 'amount', label: '金额', type: 'number' }], aggregation: null, limit: 100 } },
  { type: 'etl', tabName: 'ETL', def: { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'source', alias: 't0', schema: 'testdb', table: 'sales' }, { nodeId: 'n2', nodeType: 'output', sourceNode: 'n1', limit: 100 }] } },
]
for (const c of cases) {
  const dsId = await makeBuilderDataset(page, `m35-${c.type}-${Date.now()}`, c.def)
  await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${dsId}`)
  await page.waitForTimeout(1200)
  const active = await page.locator('.el-tabs__item.is-active').first().innerText()
  record(`tab-map ${c.type} → ${c.tabName}`, active.includes(c.tabName))
  // 抽查外层结构已渲染
  await page.waitForSelector('.el-card, .el-tabs', { timeout: 8000 })
}

// 2. 深浅色截图（SQL tab 走 CodeMirror）
await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${await makeBuilderDataset(page, 'm35-sql', { type: 'sql', sql: 'SELECT * FROM testdb.sales LIMIT 5' })}`)
await page.waitForTimeout(1200)
await page.evaluate(() => document.documentElement.classList.add('dark'))
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/sql-dark.png`, fullPage: false })
await page.evaluate(() => document.documentElement.classList.remove('dark'))
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/sql-light.png`, fullPage: false })

// 3. ETL 画布存在（含 Vue Flow 节点）
await page.goto(`${BASE}/datasources/1/builder?editDatasetId=${await makeBuilderDataset(page, 'm35-etl', { type: 'etl', nodes: [{ nodeId: 'n1', nodeType: 'source', alias: 't0', schema: 'testdb', table: 'sales' }, { nodeId: 'n2', nodeType: 'output', sourceNode: 'n1', limit: 100 }] })}`)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}/etl-light.png`, fullPage: false })
const etlNodes = await page.locator('.etl-node-card').count()
record('etl canvas renders custom nodes task10+', etlNodes >= 2, `nodes=${etlNodes}`)

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `\nFAILED: ${failed.length}` : '\nALL CDP CHECKS PASSED')
process.exit(failed.length ? 1 : 0)
```

（脚本依赖前端 dev 与后端均已运行、Docker testdb 健康。若无 admin 账号，改用项目种子账号；若 `build/save` 路由签名不同以 `src/api/build.js` 为准。）

- [ ] **Step 3: 运行冒烟**

确保两组服务运行后：`node test-m35-e2e.mjs`
Expected: 全部 PASS，`/tmp/opencode/cdp-m3.5/` 下出现浅/深色各 2 张截图。

- [ ] **Step 4: 人工抽查截图**

阅读 `sql-light.png` / `sql-dark.png` / `etl-light.png`：确认新增组件无写死底色、跟随主题（dark 截图背景为 `#121212` 系）。

- [ ] **Step 5: Commit**

```bash
git add test-m35-e2e.mjs
git commit -m "test(m3.5): CDP smoke for tab mapping, dark/light screenshots"
```

---

## Self-Review（逐项对照 spec）

| spec 要求 | 对应 Task |
| --- | --- |
| §3 新增依赖 | Task 2 |
| §4 外壳：目录只拉一次 + 编辑态 tab 映射 | Task 6（catalog 注入）+ 各 tab `catalog` prop）
| §4 深浅色（变量跟随） | Task 3/4/5/7/8/9/10 全部样式只用变量 |
| §5.1 纯 SQL CodeMirror + 补全 + 表/字段插入 + 导入字段 | Task 4 + Task 7 |
| §5.2 拖拉拽 dataEase 式字段管理（勾选/别名/维度指标/拖排序/关联/聚合） | Task 8 |
| §5.3 ETL 画布（托盘/画布/单源单输出约束/撤销重做≤30/逐节点预览/还原） | Task 5 + Task 9 |
| §5.5 tab 映射 bug 修复 | Task 6（MODE_MAP） |
| §5.6 后端 ETL JOIN right | Task 1 |
| §5.4 数据源详情树精修 | Task 10 |
| §7 错误处理（内联红字/拒连提示） | Task 7（lastError）、Task 9（nodeError + isValidConnection） |
| §8 验证（后端测试 + 前端构建 + CDP 冒烟 + 深浅截屏） | Task 11 |

Placeholder 扫描：所有改动均含完整代码与命令。类型一致性：`joinType` 在 Task 1（后端）、Task 8/9（前端 select）与 `EtlNodeCard` desc 中统一为 `'inner' | 'left' | 'right'`；`catalog` prop 统一为 `schemas` 数组形状（`{schema, tables:[{table, columns:[{name,type,role}]}]}`），由 `buildApi.sqlAssist` 返回（既有）。