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
      <template #header>Schema 浏览</template>
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
import { ElMessage, ElMessageBox } from 'element-plus'
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
}

async function doTest() {
  testing.value = true
  try {
    const res = await datasourceApi.testSaved(route.params.id)
    ElMessage[res.ok ? 'success' : 'error'](`测试${res.ok ? '成功' : '失败'}: ${res.message}`)
    ds.value = await datasourceApi.get(route.params.id)
  } finally { testing.value = false }
}

async function createDataset(data) {
  const { value: dsName } = await ElMessageBox.prompt('请输入数据集名称', '创建数据集', {
    inputValue: data.label, confirmButtonText: '创建', cancelButtonText: '取消', inputValidator: (v) => !!v?.trim() || '名称不能为空',
  })
  const created = await datasourceApi.registerTable(route.params.id, { schema: data.schema, table: data.label, name: dsName.trim() })
  ElMessage.success('数据集创建成功')
  if (created?.id) router.push(`/datasets/${created.id}`)
}

onMounted(load)
</script>