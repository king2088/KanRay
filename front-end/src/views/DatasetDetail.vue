<template>
  <div class="page-container">
    <div v-if="ds" style="max-width: 1200px; margin: 0 auto">
      <div class="page-header">
        <div style="display: flex; align-items: center; gap: 12px">
          <el-button circle @click="$router.push('/datasets')"><el-icon><ArrowLeft /></el-icon></el-button>
          <h2 class="page-title">{{ ds.name }}</h2>
          <el-tag size="small" type="info">{{ ds.row_count }} 行 / {{ ds.column_count }} 列</el-tag>
        </div>
        <div>
          <el-button type="primary" @click="$router.push(`/charts/new?dataset=${ds.id}`)">基于此数据建图</el-button>
        </div>
      </div>

      <el-tabs v-model="tab">
        <el-tab-pane label="字段定义" name="fields">
          <el-card shadow="never">
            <el-table :data="ds.fields" border>
              <el-table-column prop="name" label="内部字段名" min-width="160" />
              <el-table-column prop="label" label="展示名称" min-width="160">
                <template #default="{ row }">
                  <el-input v-model="row.label" size="small" @change="() => updateFieldLabel(row)" />
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="120">
                <template #default="{ row }">{{ typeLabel(row.type) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="数据预览" name="data">
          <el-card shadow="never">
            <div v-loading="loading" style="min-height: 200px">
              <el-table :data="rows" border max-height="560">
                <el-table-column
                  v-for="f in fields"
                  :key="f.name"
                  :prop="f.name"
                  :label="f.label"
                  min-width="120"
                  show-overflow-tooltip
                />
              </el-table>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 12px">
              <el-pagination
                background
                layout="total, prev, pager, next"
                :total="total"
                :page-size="pageSize"
                :current-page="page"
                @current-change="onPageChange"
              />
            </div>
          </el-card>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'

const route = useRoute()
const id = Number(route.params.id)
const ds = ref(null)
const tab = ref('data')
const fields = ref([])
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const loading = ref(false)

function typeLabel(t) {
  return { string: '文本', integer: '整数', number: '小数', date: '日期', boolean: '布尔' }[t] || t
}

async function loadRows() {
  loading.value = true
  try {
    const data = await datasetApi.rows(id, page.value, pageSize)
    fields.value = data.fields
    rows.value = data.rows
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function onPageChange(p) {
  page.value = p
  loadRows()
}

async function updateFieldLabel(row) {
  try {
    await datasetApi.updateFieldLabel(id, row.id, row.label.trim())
    ElMessage.success('字段别名已更新')
  } catch (e) {
    await load()
  }
}

async function load() {
  ds.value = await datasetApi.get(id)
  await loadRows()
}

onMounted(load)
</script>