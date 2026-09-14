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
      <el-tabs v-model="activeMode" @tab-change="onTabChange">
        <el-tab-pane label="纯 SQL" name="sql" />
        <el-tab-pane label="拖拉拽" name="drag" />
        <el-tab-pane label="ETL" name="etl" />
      </el-tabs>
      <div class="builder-page__content">
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
const lastMode = ref(activeMode.value)

function onChange(payload) {
  liveDefinition.value = payload.definition
}

function currentDefinition() {
  if (liveDefinition.value && MODE_MAP[liveDefinition.value.type] === activeMode.value) return liveDefinition.value
  const ref = activeMode.value === 'sql' ? sqlRef.value : activeMode.value === 'drag' ? dragRef.value : etlRef.value
  return ref?.getDefinition?.() ?? null
}

function onTabChange() {
  const prev = lastMode.value
  const ref = prev === 'sql' ? sqlRef.value : prev === 'drag' ? dragRef.value : etlRef.value
  const d = ref?.getDefinition?.()
  if (d) liveDefinition.value = d
  lastMode.value = activeMode.value
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
        try {
          const def = typeof dataset.build_definition === 'string' ? JSON.parse(dataset.build_definition) : dataset.build_definition
          editDefinition.value = def
          activeMode.value = MODE_MAP[def.type] || 'sql'
        } catch (e) {
          ElMessage.error('数据集定义解析失败')
        }
      }
    }
  } finally { loading.value = false }
})
</script>

<style scoped>
.builder-page { display: flex; flex-direction: column; gap: 16px; height: calc(100vh - var(--app-header-height)); padding: 16px; }
.builder-page :deep(.el-card) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.builder-page :deep(.el-card__body) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.builder-page__content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
