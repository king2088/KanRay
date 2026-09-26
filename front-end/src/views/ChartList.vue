<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('chart.list.title') }}</h2>
        <div class="page-desc">{{ t('chart.list.desc') }}</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="$router.push('/charts/new')">
          <el-icon style="margin-right: 6px"><Plus /></el-icon>{{ t('chart.list.create') }}
        </el-button>
      </div>
    </div>

    <div class="stat-strip">
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><PieChart /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ total }}</div>
          <div class="stat-item__label">{{ t('chart.list.statTotal') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><DataAnalysis /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ typeCount }}</div>
          <div class="stat-item__label">{{ t('chart.list.statTypeCount') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><Odometer /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ usedCount }}</div>
          <div class="stat-item__label">{{ t('chart.list.statReferenced') }}</div>
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('chart.list.listTitle') }}</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            :placeholder="t('chart.list.searchPlaceholder')"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">{{ t('chart.list.totalTag', { n: total }) }}</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" :empty-text="t('chart.list.empty')">
        <el-table-column prop="name" :label="t('chart.list.colName')" min-width="200">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon" :class="`cell-name__icon--${typeTone(row.chartType)}`">
                <ChartTypeIcon :type="row.chartType" :size="16" />
              </div>
              <el-link type="primary" @click="$router.push(`/charts/${row.id}/edit`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('chart.list.colType')" width="130" align="center">
          <template #default="{ row }">
            <el-tag  :type="typeTag(row.chartType)" effect="light">{{ typeLabel(row.chartType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="datasetName" :label="t('chart.list.colDatasource')" min-width="160">
          <template #default="{ row }">
            <el-link v-if="row.datasetName" type="info" @click="$router.push(`/datasets/${row.datasetId}`)">
              {{ row.datasetName }}
            </el-link>
            <span v-else class="cell-muted">{{ t('chart.list.invalid') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" :label="t('chart.list.colUpdatedAt')" width="180">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDateTime(row.updatedAt, appStore.timezone) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('chart.list.colActions')" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="$router.push(`/charts/${row.id}/edit`)"
            >{{ t('chart.list.edit') }}</el-button>
            <el-button link type="primary"  @click="previewChart(row)">{{ t('chart.list.preview') }}</el-button>
            <el-button link type="danger"  @click="remove(row)">{{ t('chart.list.remove') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="page-card__footer">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[10, 20, 50]"
          background
          @size-change="onSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <el-dialog v-model="previewVisible" :title="previewChartRef?.name || t('chart.list.previewTitle')" width="680px">
      <div class="preview-dialog-body">
        <EChartRenderer v-if="previewData" :chart-type="previewChartRef.chartType" :data="previewData" :options="previewChartRef.config?.options" />
        <el-empty v-else :description="t('common.empty.noData')" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { t } from '@/i18n'
import { Search, Plus } from '@element-plus/icons-vue'
import { chartApi, dashboardApi } from '@/api'
import { getChartType } from '@/config/chart-types'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'
import EChartRenderer from '@/components/charts/EChartRenderer.vue'
import ChartTypeIcon from '@/components/ChartTypeIcon.vue'

const appStore = useAppStore()
const charts = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const previewVisible = ref(false)
const previewChartRef = ref(null)
const previewData = ref(null)

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return charts.value
  return charts.value.filter((c) => c.name.toLowerCase().includes(kw))
})

const typeCount = computed(() => new Set(charts.value.map((c) => c.chartType)).size)
const usedIds = new Set()
const usedCount = computed(() => charts.value.filter((c) => usedIds.has(c.id)).length)

const typeLabel = (v) => {
  const def = getChartType(v)
  return def?.labelKey ? t(def.labelKey) : v
}
const typeTag = (v) => {
  const def = getChartType(v)
  if (!def) return 'info'
  const cat = def.category
  return { bar: '', line: 'success', pie: 'warning', horizontalBar: '', table: 'info', stat: 'danger', indicator: 'danger', scatter: 'success', map: 'info', other: 'info' }[cat] || 'info'
}
const typeTone = (v) => {
  const def = getChartType(v)
  if (!def) return 'blue'
  const cat = def.category
  return { bar: 'blue', line: 'green', pie: 'orange', horizontalBar: 'purple', table: 'gray', stat: 'red', indicator: 'red', scatter: 'green', map: 'blue', other: 'blue' }[cat] || 'blue'
}

async function load() {
  loading.value = true
  try {
    const res = await chartApi.listPaged(page.value, pageSize.value)
    charts.value = res.list
    total.value = res.total
    const dashes = await dashboardApi.list()
    usedIds.clear()
    dashes.forEach((d) => (d.layout || []).forEach((it) => {
      if (it.type === 'chart' && it.chartId) usedIds.add(it.chartId)
    }))
  } finally {
    loading.value = false
  }
}

function onPageChange(p) {
  page.value = p
  load()
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
  load()
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
  await ElMessageBox.confirm(t('chart.list.deleteConfirm', { name: row.name }), t('chart.list.deleteConfirmTitle'), {
    type: 'warning',
    confirmButtonText: t('common.actions.delete'),
    cancelButtonText: t('common.actions.cancel'),
  })
  await chartApi.remove(row.id)
  ElMessage.success(t('chart.list.deleteSuccess'))
  load()
}

onMounted(load)
</script>

<style scoped>
.cell-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-name__icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cell-name__icon--blue { background: var(--app-primary-light); color: var(--app-primary); }
.cell-name__icon--green { background: #f0f9eb; color: var(--app-success); }
.cell-name__icon--orange { background: #fdf6ec; color: var(--app-warning); }
.cell-name__icon--purple { background: #f5f0ff; color: #8a5cf6; }
.cell-name__icon--red { background: #fef0f0; color: var(--app-danger); }
.cell-name__icon--gray { background: #f2f6fc; color: var(--app-text-secondary); }

.cell-muted {
  color: var(--app-text-secondary);
  font-size: 14px;
}

.preview-dialog-body {
  min-height: 160px;
}
</style>