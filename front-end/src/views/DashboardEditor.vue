<template>
  <div class="dashboard-editor">
    <div class="editor-body">
      <div class="editor-canvas-col">
        <div class="editor-toolbar">
          <div class="et-left">
            <el-button circle @click="$router.push('/dashboards')"><el-icon><ArrowLeft /></el-icon></el-button>
            <el-input v-model="dashName" :placeholder="t('dashboard.editor.namePlaceholder')" style="width: 220px" maxlength="100" @change="onNameChange" />
            <el-tag v-if="dashId" type="warning" effect="light">{{ t('dashboard.editor.editing') }}</el-tag>
          </div>
          <div class="et-right">
            <el-button @click="settingsDrawer = true">
              <el-icon style="margin-right: 4px"><Setting /></el-icon>{{ t('dashboard.editor.settings') }}
            </el-button>
            <el-dropdown trigger="click" @command="onAddComponent">
              <el-button>
                <el-icon style="margin-right: 4px"><Plus /></el-icon>{{ t('dashboard.editor.components') }}
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="text">{{ t('dashboard.editor.addText') }}</el-dropdown-item>
                  <el-dropdown-item command="filter">{{ t('dashboard.editor.addFilter') }}</el-dropdown-item>
                  <el-dropdown-item command="container">{{ t('dashboard.editor.addContainer') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button @click="$router.push(`/dashboards/${dashId}`)">
              <el-icon style="margin-right: 4px"><View /></el-icon>{{ t('dashboard.editor.preview') }}
            </el-button>
            <el-button type="primary" :loading="saving" @click="save">
              <el-icon style="margin-right: 4px"><Check /></el-icon>{{ t('dashboard.editor.save') }}
            </el-button>
          </div>
        </div>

        <DashboardCanvas
          ref="canvasRef"
          :items="items"
          :charts="charts"
          editable
          :gap="gap"
          :card-style="cardStyle"
          @update:items="items = $event"
        />
      </div>
      <ChartLibraryPanel :datasets="datasets" :items="items" @add-chart="onAddChart" />
    </div>

    <!-- 看板设置（卡片间距 / 卡片样式） -->
    <el-drawer v-model="settingsDrawer" :title="t('dashboard.editor.settingsTitle')" direction="rtl" size="320px">
      <DashboardStylePanel :gap="gap" :card-style="cardStyle" />
    </el-drawer>

    <!-- 添加文本 -->
    <el-dialog v-model="addTextDialog" :title="t('dashboard.editor.addTextTitle')" width="520px">
      <el-input
        v-model="textContent"
        type="textarea"
        :rows="4"
        :placeholder="t('dashboard.editor.addTextPlaceholder')"
      />
      <template #footer>
        <el-button @click="addTextDialog = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" @click="confirmAddText">{{ t('common.actions.add') }}</el-button>
      </template>
    </el-dialog>

    <!-- 添加筛选 -->
    <el-dialog v-model="filterDialogVisible" :title="t('dashboard.editor.addFilterTitle')" width="520px">
      <el-form label-width="80px">
        <el-form-item :label="t('dashboard.editor.dataset')">
          <el-select-v2 v-model="filterCfg.datasetId" filterable :placeholder="t('dashboard.editor.selectDataset')" style="width: 100%" :options="datasetOptions" @change="onFilterDatasetChange">
            <template #default="{ item }">
              <DatasetOption :item="item" />
            </template>
          </el-select-v2>
        </el-form-item>
        <el-form-item :label="t('dashboard.editor.filterField')">
          <el-select v-model="filterCfg.field" :placeholder="t('dashboard.editor.selectFilterField')" style="width: 100%">
            <el-option v-for="f in filterFields" :key="f.name" :label="f.label || f.name" :value="f.name" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dashboard.editor.displayName')">
          <el-input v-model="filterCfg.label" :placeholder="t('dashboard.editor.displayNamePlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="filterDialogVisible = false">{{ t('common.actions.cancel') }}</el-button>
        <el-button type="primary" @click="confirmAddFilter">{{ t('common.actions.add') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { ArrowLeft, View, Check, Plus, ArrowDown, Setting } from '@element-plus/icons-vue'
import { dashboardApi, datasetApi } from '@/api'
import { alignTree, DEFAULT_CARD_STYLE, normalizeLayout, normCardStyle, normGap } from '@/utils/grid-layout'
import { toDatasetOptions } from '@/utils/dataset-type'
import DatasetOption from '@/components/DatasetOption.vue'
import DashboardCanvas from '@/components/dashboard/DashboardCanvas.vue'
import ChartLibraryPanel from '@/components/dashboard/ChartLibraryPanel.vue'
import DashboardStylePanel from '@/components/dashboard/DashboardStylePanel.vue'

const route = useRoute()
const router = useRouter()
const dashId = String(route.params.id)
const canvasRef = ref(null)

const dashName = ref('')
const items = ref([])
const charts = ref([])
const datasets = ref([])
const datasetOptions = computed(() => toDatasetOptions(datasets.value))
const saving = ref(false)
const gap = ref({ x: 12, y: 12 })
const cardStyle = ref({ ...DEFAULT_CARD_STYLE })
const settingsDrawer = ref(false)

const addTextDialog = ref(false)
const textContent = ref('')
const filterDialogVisible = ref(false)
const filterCfg = ref({ datasetId: null, field: '', label: '' })
const filterFields = ref([])

async function load() {
  const dash = await dashboardApi.get(dashId)
  dashName.value = dash.name
  gap.value = normGap(dash.gap)
  cardStyle.value = normCardStyle(dash.cardStyle)
  items.value = normalizeLayout(dash.layout || [], 12, gap.value)
  alignTree(items.value, 12, gap.value)
  datasets.value = await datasetApi.list()
}

async function onNameChange() {
  if (!dashName.value.trim()) return ElMessage.warning(t('dashboard.editor.errNameRequired'))
  await dashboardApi.update(dashId, { name: dashName.value.trim() })
  ElMessage.success(t('dashboard.editor.errNameUpdated'))
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
  if (!filterCfg.value.datasetId || !filterCfg.value.field) return ElMessage.warning(t('dashboard.editor.errFilterIncomplete'))
  const field = filterFields.value.find((f) => f.name === filterCfg.value.field)
  canvasRef.value.addFilter({
    datasetId: filterCfg.value.datasetId,
    field: filterCfg.value.field,
    label: filterCfg.value.label || field?.label || filterCfg.value.field,
  })
  filterDialogVisible.value = false
}

async function save() {
  if (!dashName.value.trim()) return ElMessage.warning(t('dashboard.editor.errNameRequired'))
  saving.value = true
  try {
    await dashboardApi.update(dashId, { name: dashName.value.trim(), layout: items.value, gap: gap.value, cardStyle: cardStyle.value })
    ElMessage.success(t('dashboard.editor.saved'))
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
  background: var(--app-header-bg);
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius);
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

.editor-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  display: flex;
  gap: 12px;
  overflow: hidden;
}

.editor-canvas-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-body :deep(.dash-canvas) {
  flex: 1;
  min-height: 0;
}
</style>