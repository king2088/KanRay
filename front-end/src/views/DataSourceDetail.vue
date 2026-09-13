<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ ds?.name || '数据源详情' }}</h2>
        <div class="page-desc">{{ ds?.type }} · {{ ds?.is_active ? '启用' : '停用' }}</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">返回</el-button>
        <el-button type="primary" :loading="testing" @click="doTest">测试连接</el-button>
      </div>
    </div>

    <el-card v-if="ds" shadow="never" style="margin-bottom: 16px">
      <div style="display: flex; gap: 40px; font-size: 13px; color: var(--app-text-secondary)">
        <div><strong>类型：</strong>{{ ds.type }}</div>
        <div><strong>最近测试：</strong>
          <el-tag v-if="ds.last_test_ok === true" type="success" size="small">成功</el-tag>
          <el-tag v-else-if="ds.last_test_ok === false" type="danger" size="small">失败</el-tag>
          <span v-else>未测试</span>
          <span v-if="ds.last_test_msg"> — {{ ds.last_test_msg }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>Schema 浏览</span>
          <el-button size="small" type="primary" @click="openBuilder()">新建构建</el-button>
        </div>
      </template>
      <el-input
        v-if="schemas.length"
        v-model="treeQuery"
        size="small"
        placeholder="搜索已加载的表 / 字段"
        clearable
        class="schema-search"
      />
      <el-tree
        v-if="schemas.length"
        ref="treeRef"
        :data="schemaTree"
        lazy
        :load="loadNode"
        node-key="id"
        :filter-node-method="filterNode"
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
      <el-empty v-else description="暂无 Schema 数据" />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Folder, Grid, Rank } from '@element-plus/icons-vue'
import { datasourceApi } from '@/api'

const route = useRoute()
const router = useRouter()
const ds = ref(null)
const loading = ref(false)
const testing = ref(false)
const schemas = ref([])
const treeQuery = ref('')
const treeRef = ref(null)

function filterNode(value, data) {
  if (!value) return true
  return String(data.label || '').toLowerCase().includes(String(value).toLowerCase())
}

watch(treeQuery, (val) => {
  treeRef.value?.filter(String(val || ''))
})

const schemaTree = computed(() =>
  schemas.value.map((s) => ({
    id: `schema-${s.name}`, label: s.name, type: 'schema', children: [],
  }))
)

async function load() {
  if (!route.params.id) return
  loading.value = true
  try {
    ds.value = await datasourceApi.get(route.params.id)
    schemas.value = await datasourceApi.schemas(route.params.id)
  } finally { loading.value = false }
}

async function loadNode(node, resolve) {
  try {
    const id = route.params.id
    const data = node.data || {}
    if (!data.type) {
      resolve(schemaTree.value)
    } else if (data.type === 'schema') {
      const tables = await datasourceApi.tables(id, data.label)
      resolve(tables.map((t) => ({
        id: `${data.label}-${t.name}`, label: t.name, type: 'table', schema: data.label, children: [],
      })))
    } else if (data.type === 'table') {
      const cols = await datasourceApi.columns(id, data.schema, data.label)
      resolve(cols.map((c) => ({
        id: `${data.schema}-${data.label}-${c.name}`, label: c.name, type: 'column', rawType: c.type, isLeaf: true,
      })))
    } else {
      resolve([])
    }
  } catch (e) { /* 拦截器已提示，避免节点卡在加载中 */ resolve([]) }
}

function iconOf(type) {
  return type === 'schema' ? Folder : type === 'table' ? Grid : Rank
}

function typeBadge(data) {
  const raw = (data.rawType || '').toLowerCase()
  return /int|float|double|decimal|numeric/.test(raw) ? { type: 'primary', text: '数值' } : /date|time/.test(raw) ? { type: 'warning', text: '时间' } : { type: 'success', text: '文本' }
}

async function doTest() {
  testing.value = true
  try {
    const res = await datasourceApi.testSaved(route.params.id)
    ElMessage[res.ok ? 'success' : 'error'](`测试${res.ok ? '成功' : '失败'}: ${res.message}`)
    ds.value = await datasourceApi.get(route.params.id)
  } finally { testing.value = false }
}

function openBuilder(preTable) {
  const q = preTable ? { table: preTable } : {}
  router.push({ path: `/datasources/${route.params.id}/builder`, query: q })
}

function createDataset(data) {
  openBuilder(`${data.schema}:${data.label}`)
}

onMounted(load)
</script>

<style scoped>
.schema-search { margin-bottom: 8px; }
.tree-node { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.tree-node__icon { color: var(--app-text-secondary); }
.tree-node__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree-node__actions { display: none; gap: 2px; flex: 0 0 auto; white-space: nowrap; }
.el-tree-node__content:hover .tree-node__actions,
.el-tree-node__content:focus-within .tree-node__actions { display: flex; }
:deep(.el-tree-node__content:hover) { background: var(--app-hover); border-radius: 4px; }
</style>
