<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">图表中心</h2>
      <el-button type="primary" @click="$router.push('/charts/new')">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>新建图表
      </el-button>
    </div>

    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <el-input
            v-model="search"
            placeholder="搜索图表名称"
            clearable
            style="width: 260px"
            :prefix-icon="Search"
          />
          <span>共 {{ charts.length }} 个图表</span>
        </div>
      </template>

      <el-table :data="filtered" v-loading="loading" empty-text="还没有图表，点击右上角「新建图表」开始">
        <el-table-column prop="name" label="名称" min-width="180">
          <template #default="{ row }">
            <el-icon style="margin-right: 6px; vertical-align: -2px">
              <component :is="typeIcon(row.chartType)" />
            </el-icon>
            <el-link type="primary" @click="$router.push(`/charts/${row.id}/edit`)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="图表类型" width="140">
          <template #default="{ row }">
            <el-tag size="small">{{ typeLabel(row.chartType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="datasetName" label="数据源" min-width="140">
          <template #default="{ row }">
            <el-link v-if="row.datasetName" type="info" @click="$router.push(`/datasets/${row.datasetId}`)">
              {{ row.datasetName }}
            </el-link>
            <span v-else style="color: #909399">已失效</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/charts/${row.id}/edit`)">编辑</el-button>
            <el-button link type="primary" size="small" @click="previewChart(row)">预览</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="previewVisible" :title="previewChartRef?.name || '图表预览'" width="680px">
      <div style="height: 420px">
        <EChartRenderer v-if="previewData" :chart-type="previewChartRef.chartType" :data="previewData" :options="previewChartRef.config?.options" />
        <el-empty v-else description="暂无数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import { chartApi } from '@/api'
import { CHART_TYPES } from '@/utils/chart-utils'
import EChartRenderer from '@/components/charts/EChartRenderer.vue'

const charts = ref([])
const loading = ref(false)
const search = ref('')
const previewVisible = ref(false)
const previewChartRef = ref(null)
const previewData = ref(null)

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return charts.value
  return charts.value.filter((c) => c.name.toLowerCase().includes(kw))
})

const typeLabel = (v) => CHART_TYPES.find((t) => t.value === v)?.label || v
const typeIcon = (v) => CHART_TYPES.find((t) => t.value === v)?.icon || 'PieChart'

function formatDate(s) {
  return s ? String(s).replace('T', ' ').slice(0, 19) : '-'
}

async function load() {
  loading.value = true
  try {
    charts.value = await chartApi.list()
  } finally {
    loading.value = false
  }
}

async function previewChart(row) {
  previewChartRef.value = row
  previewVisible.value = true
  try {
    const res = await chartApi.data(row.id, [])
    previewData.value = res.data
  } catch (e) {
    previewData.value = null
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除图表「${row.name}」？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await chartApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>