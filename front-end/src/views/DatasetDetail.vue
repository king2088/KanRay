<template>
  <div class="page-container">
    <div v-if="ds" class="dataset-detail">
      <div class="page-header">
        <div class="page-header__main d-header">
          <el-button circle class="back-btn" @click="$router.push('/datasets')"><el-icon><ArrowLeft /></el-icon></el-button>
          <div>
            <h2 class="page-title">{{ ds.name }}</h2>
            <div class="page-desc">来源：{{ ds.original_file || '-' }} · 创建于 {{ formatDateTime(ds.created_at, appStore.timezone) }}</div>
          </div>
        </div>
        <div class="page-header__actions">
          <el-button type="primary" @click="$router.push(`/charts/new?dataset=${ds.id}`)">
            <el-icon style="margin-right: 6px"><DataAnalysis /></el-icon>基于此数据建图
          </el-button>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><DataLine /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ (ds.row_count || 0).toLocaleString('zh-CN') }}</div>
            <div class="stat-item__label">数据行数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><Grid /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ ds.column_count }}</div>
            <div class="stat-item__label">字段列数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-item__icon"><el-icon><Files /></el-icon></div>
          <div>
            <div class="stat-item__value">{{ ds.fields.length }}</div>
            <div class="stat-item__label">字段定义数</div>
          </div>
        </div>
      </div>

      <el-tabs v-model="tab" class="detail-tabs">
        <el-tab-pane label="数据预览" name="data">
          <div class="page-card">
            <div class="page-card__body">
              <div v-loading="loading" style="min-height: 220px">
                <el-table :data="rows" max-height="460" empty-text="暂无数据">
                  <el-table-column
                    v-for="f in fields"
                    :key="f.name"
                    :prop="f.name"
                    :label="f.label"
                    min-width="130"
                    show-overflow-tooltip
                  />
                </el-table>
              </div>
              <div style="display: flex; justify-content: flex-end; margin-top: 14px">
                <el-pagination
                  background
                  layout="total, prev, pager, next"
                  :total="total"
                  :page-size="pageSize"
                  :current-page="page"
                  @current-change="onPageChange"
                />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="字段定义" name="fields">
          <div class="page-card">
            <div class="page-card__header">
              <div class="page-card__header-title">字段别名与类型</div>
              <div class="page-card__header-right">
                <el-tag  type="info" effect="plain">修改展示名称后回车保存</el-tag>
              </div>
            </div>
            <el-table :data="ds.fields">
              <el-table-column prop="name" label="内部字段名" min-width="160">
                <template #default="{ row }">
                  <span class="cell-key">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="label" label="展示名称" min-width="200">
                <template #default="{ row }">
                  <el-input v-model="row.label"  placeholder="输入展示名称" @change="() => updateFieldLabel(row)" />
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="130">
                <template #default="{ row }">
                  <el-tag  :type="typeTag(row.type)">{{ typeLabel(row.type) }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, DataAnalysis } from '@element-plus/icons-vue'
import { datasetApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/datetime'

const route = useRoute()
const id = Number(route.params.id)
const appStore = useAppStore()
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

function typeTag(t) {
  return { string: 'info', integer: 'success', number: 'success', date: 'warning', boolean: 'danger' }[t] || 'info'
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
    await loadRows()
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

<style scoped>
.d-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  flex-shrink: 0;
}

.cell-key {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 14px;
  color: var(--app-text-regular);
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
</style>