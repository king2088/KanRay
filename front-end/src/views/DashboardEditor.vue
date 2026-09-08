<template>
  <div class="dashboard-editor">
    <div class="editor-toolbar">
      <div class="et-left">
        <el-button circle @click="$router.push('/dashboards')"><el-icon><ArrowLeft /></el-icon></el-button>
        <el-input v-model="dashName" placeholder="看板名称" style="width: 220px" maxlength="100" @change="onNameChange" />
        <el-tag v-if="dashId" type="warning" effect="light">编辑中</el-tag>
      </div>
      <div class="et-right">
        <span class="et-gap-label">左右</span>
        <el-input-number v-model="gap.x" :min="4" :max="96" size="small" controls-position="right" style="width: 86px" />
        <span class="et-gap-label">上下</span>
        <el-input-number v-model="gap.y" :min="4" :max="96" size="small" controls-position="right" style="width: 86px" />
        <el-dropdown trigger="click" @command="onAddComponent">
          <el-button>
            <el-icon style="margin-right: 4px"><Plus /></el-icon>组件
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="text">添加文本</el-dropdown-item>
              <el-dropdown-item command="filter">添加筛选</el-dropdown-item>
              <el-dropdown-item command="container">添加容器</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="$router.push(`/dashboards/${dashId}`)">
          <el-icon style="margin-right: 4px"><View /></el-icon>预览
        </el-button>
        <el-button type="primary" :loading="saving" @click="save">
          <el-icon style="margin-right: 4px"><Check /></el-icon>保存
        </el-button>
      </div>
    </div>

    <div class="editor-body">
      <DashboardCanvas
        ref="canvasRef"
        :items="items"
        :charts="charts"
        editable
        :gap="gap"
        @update:items="items = $event"
      />
      <ChartLibraryPanel :charts="charts" :items="items" @add-chart="onAddChart" />
    </div>

    <!-- 添加文本 -->
    <el-dialog v-model="addTextDialog" title="添加文本组件" width="520px">
      <el-input
        v-model="textContent"
        type="textarea"
        :rows="4"
        placeholder="支持 Markdown 段落、HTML 标签（如 <h3>标题</h3>）"
      />
      <template #footer>
        <el-button @click="addTextDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmAddText">添加</el-button>
      </template>
    </el-dialog>

    <!-- 添加筛选 -->
    <el-dialog v-model="filterDialogVisible" title="添加筛选组件" width="520px">
      <el-form label-width="80px">
        <el-form-item label="数据源">
          <el-select v-model="filterCfg.datasetId" placeholder="选择数据源" style="width: 100%" @change="onFilterDatasetChange">
            <el-option v-for="d in datasets" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="筛选字段">
          <el-select v-model="filterCfg.field" placeholder="选择要筛选的字段" style="width: 100%">
            <el-option v-for="f in filterFields" :key="f.name" :label="f.label || f.name" :value="f.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="filterCfg.label" placeholder="例如：区域" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="filterDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddFilter">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, View, Check, Plus, ArrowDown } from '@element-plus/icons-vue'
import { dashboardApi, chartApi, datasetApi } from '@/api'
import { normalizeLayout, normGap } from '@/utils/grid-layout'
import DashboardCanvas from '@/components/dashboard/DashboardCanvas.vue'
import ChartLibraryPanel from '@/components/dashboard/ChartLibraryPanel.vue'

const route = useRoute()
const router = useRouter()
const dashId = Number(route.params.id)
const canvasRef = ref(null)

const dashName = ref('')
const items = ref([])
const charts = ref([])
const datasets = ref([])
const saving = ref(false)
const gap = ref({ x: 12, y: 12 })

const addTextDialog = ref(false)
const textContent = ref('')
const filterDialogVisible = ref(false)
const filterCfg = ref({ datasetId: null, field: '', label: '' })
const filterFields = ref([])

async function load() {
  const dash = await dashboardApi.get(dashId)
  dashName.value = dash.name
  gap.value = normGap(dash.gap)
  items.value = normalizeLayout(dash.layout || [], 12, gap.value)
  charts.value = await chartApi.list()
  datasets.value = await datasetApi.list()
}

async function onNameChange() {
  if (!dashName.value.trim()) return ElMessage.warning('看板名称不能为空')
  await dashboardApi.update(dashId, { name: dashName.value.trim() })
  ElMessage.success('名称已更新')
}

function onAddChart(chart) {
  canvasRef.value.addChart(chart)
}

function onAddComponent(cmd) {
  if (cmd === 'text') addTextDialog.value = true
  else if (cmd === 'filter') openFilterDialog()
  else if (cmd === 'container') canvasRef.value.addContainer()
}

async function confirmAddText() {
  canvasRef.value.addText(textContent.value)
  textContent.value = ''
  addTextDialog.value = false
}

function openFilterDialog() {
  filterCfg.value = { datasetId: null, field: '', label: '' }
  filterFields.value = []
  filterDialogVisible.value = true
}

async function onFilterDatasetChange(dsId) {
  if (!dsId) return
  const ds = await datasetApi.get(dsId)
  filterFields.value = ds.fields || []
}

function confirmAddFilter() {
  if (!filterCfg.value.datasetId || !filterCfg.value.field) return ElMessage.warning('请选择数据源和筛选字段')
  const field = filterFields.value.find((f) => f.name === filterCfg.value.field)
  canvasRef.value.addFilter({
    datasetId: filterCfg.value.datasetId,
    field: filterCfg.value.field,
    label: filterCfg.value.label || field?.label || filterCfg.value.field,
  })
  filterDialogVisible.value = false
}

async function save() {
  if (!dashName.value.trim()) return ElMessage.warning('看板名称不能为空')
  saving.value = true
  try {
    await dashboardApi.update(dashId, { name: dashName.value.trim(), layout: items.value, gap: gap.value })
    ElMessage.success('看板已保存')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  height: var(--app-header-height);
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.et-left,
.et-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.et-gap-label {
  font-size: 12px;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.editor-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  display: flex;
  gap: 12px;
  overflow: hidden;
}

.editor-body :deep(.dash-canvas) {
  flex: 1;
  min-width: 0;
}
</style>