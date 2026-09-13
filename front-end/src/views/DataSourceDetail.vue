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
      <el-tree
        v-if="schemas.length"
        :data="schemaTree"
        lazy
        :load="loadNode"
        node-key="id"
      >
        <template #default="{ node, data }">
          <span>{{ data.label }}</span>
          <el-button v-if="data.type === 'table'" link type="primary" size="small" style="margin-left: 8px" @click.stop="createDataset(data)">创建数据集</el-button>
        </template>
      </el-tree>
      <el-empty v-else description="暂无 Schema 数据" />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { datasourceApi } from '@/api'

const route = useRoute()
const router = useRouter()
const ds = ref(null)
const loading = ref(false)
const testing = ref(false)
const schemas = ref([])

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
        id: `${data.schema}-${data.label}-${c.name}`, label: `${c.name} (${c.type})`, type: 'column', isLeaf: true,
      })))
    } else {
      resolve([])
    }
  } catch (e) { /* 拦截器已提示，避免节点卡在加载中 */ resolve([]) }
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
