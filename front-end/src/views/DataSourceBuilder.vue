<template>
  <div class="builder-page" v-loading="loading">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('dataset.builderPage.title') }}</h2>
        <div class="page-desc">{{ t('dataset.builderPage.desc', { name: dsName, type: dsType }) }}</div>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.back()">{{ t('common.actions.back') }}</el-button>
        <el-input v-model="name" :placeholder="t('dataset.builderPage.namePlaceholder')" style="width: 220px" clearable />
        <el-button type="primary" :loading="saving" @click="save">{{ t('dataset.builderPage.save') }}</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeMode" @tab-change="onTabChange">
        <el-tab-pane :label="t('dataset.builderPage.tabSql')" name="sql" />
        <el-tab-pane :label="t('dataset.builderPage.tabVisual')" name="drag" />
        <el-tab-pane :label="t('dataset.etl.title')" name="etl" />
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
import { t } from '@/i18n'
import SqlBuilderTab from '@/components/builder/SqlBuilderTab.vue'
import DragBuilderTab from '@/components/builder/DragBuilderTab.vue'
import EtlBuilderTab from '@/components/builder/EtlBuilderTab.vue'

const route = useRoute()
const router = useRouter()
const dsId = String(route.params.id)
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
  const tabRef = activeMode.value === 'sql' ? sqlRef.value : activeMode.value === 'drag' ? dragRef.value : etlRef.value
  return tabRef?.getDefinition?.() ?? null
}

function onTabChange() {
  const prev = lastMode.value
  const tabRef = prev === 'sql' ? sqlRef.value : prev === 'drag' ? dragRef.value : etlRef.value
  const d = tabRef?.getDefinition?.()
  if (d) liveDefinition.value = d
  lastMode.value = activeMode.value
}

async function save() {
  if (!name.value.trim()) return ElMessage.warning(t('dataset.builderPage.nameRequired'))
  const definition = currentDefinition()
  if (!definition) return ElMessage.warning(t('dataset.builderPage.definitionEmpty'))
  saving.value = true
  try {
    const created = await buildApi.save(dsId, name.value.trim(), definition, editDatasetId.value)
    ElMessage.success(t(editDatasetId.value ? 'dataset.builderPage.updated' : 'dataset.builderPage.created'))
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
      editDatasetId.value = String(editId)
      const dataset = await datasetApi.get(editDatasetId.value)
      name.value = dataset.name
      if (dataset.build_definition) {
        try {
          const def = typeof dataset.build_definition === 'string' ? JSON.parse(dataset.build_definition) : dataset.build_definition
          editDefinition.value = def
          activeMode.value = MODE_MAP[def.type] || 'sql'
        } catch (e) {
          ElMessage.error(t('dataset.builderPage.parseFailed'))
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
