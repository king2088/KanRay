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
      <el-tabs v-model="activeMode" @tab-change="onModeChange">
        <el-tab-pane label="纯 SQL" name="sql" />
        <el-tab-pane label="拖拉拽" name="drag" />
        <el-tab-pane label="ETL" name="etl" />
      </el-tabs>
      <div style="min-height: 520px">
        <keep-alive>
          <SqlBuilderTab v-if="activeMode === 'sql'" ref="sqlRef" :datasource-id="dsId" :initial-definition="editDefinition" @change="onChange" />
          <DragBuilderTab v-else-if="activeMode === 'drag'" ref="dragRef" :datasource-id="dsId" :initial-definition="editDefinition" @change="onChange" />
          <EtlBuilderTab v-else ref="etlRef" :datasource-id="dsId" :initial-definition="editDefinition" @change="onChange" />
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

const sqlRef = ref(null)
const dragRef = ref(null)
const etlRef = ref(null)

function onChange(payload) {
  liveDefinition.value = payload.definition
}

function currentDefinition() {
  const tabs = liveDefinition.value && liveDefinition.value.type === activeMode.value ? liveDefinition.value : null
  return tabs || liveDefinition.value || (activeMode.value === 'sql' ? sqlRef.value?.getDefinition?.() : activeMode.value === 'drag' ? dragRef.value?.getDefinition?.() : etlRef.value?.getDefinition?.())
}

function onModeChange() {
  const d = activeMode.value === 'sql' ? sqlRef.value?.getDefinition?.() : activeMode.value === 'drag' ? dragRef.value?.getDefinition?.() : etlRef.value?.getDefinition?.()
  if (d) liveDefinition.value = d
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
    const editId = route.query.editDatasetId
    if (editId) {
      editDatasetId.value = Number(editId)
      const dataset = await datasetApi.get(editDatasetId.value)
      name.value = dataset.name
      if (dataset.build_definition) {
        editDefinition.value = typeof dataset.build_definition === 'string' ? JSON.parse(dataset.build_definition) : dataset.build_definition
        activeMode.value = editDefinition.value.type || 'sql'
      }
    }
  } finally { loading.value = false }
})
</script>

<style scoped>
.builder-page { display: flex; flex-direction: column; gap: 16px; }
</style>