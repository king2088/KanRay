<template>
  <div class="sql-builder">
    <div class="sql-builder__left">
      <div class="sql-builder__panel-title">{{ t('dataset.sql.leftPanelTitle') }}</div>
      <SchemaTree :catalog="schemas" @mount-table="insertTable" @pick-field="insertField" />
    </div>
    <div class="sql-builder__main">
      <SqlCodeMirror v-model="localSql" :catalog="schemas" :placeholder="t('dataset.sql.editorPlaceholder')" />
      <div class="sql-builder__toolbar">
        <el-button type="primary" :loading="previewing" @click="runPreview">{{ t('dataset.sql.runPreview', { count: limit }) }}</el-button>
        <el-button :loading="importing" :disabled="!previewRows.length" @click="importFields">{{ t('dataset.sql.importFields') }}</el-button>
        <span v-if="lastError" class="sql-builder__error">{{ lastError }}</span>
      </div>
      <div class="sql-builder__preview">
        <el-table :data="previewRows" height="100%" :empty-text="t('dataset.sql.previewEmpty')">
          <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="120" show-overflow-tooltip />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { t } from '@/i18n'
import SchemaTree from './SchemaTree.vue'
import SqlCodeMirror from './SqlCodeMirror.vue'

const props = defineProps({ datasourceId: { type: [Number, String], required: true }, catalog: { type: Array, default: () => [] }, initialDefinition: { type: Object, default: null } })
const emit = defineEmits(['change'])

const sql = ref('')
const schemas = ref([])
watch(() => props.catalog, (v) => { schemas.value = v || [] }, { immediate: true, deep: true })

const importedFields = ref([])
watch(() => props.initialDefinition, (v) => {
  if (!v || v.type !== 'sql') return
  sql.value = v.sql || ''
  importedFields.value = v.fields || []
  emitChange()
}, { immediate: true })

const previewRows = ref([])
const previewCols = ref([])
const previewing = ref(false)
const importing = ref(false)
const lastError = ref('')
const limit = 200

const localSql = computed({ get: () => sql.value, set: (v) => { sql.value = v; emitChange() } })

function emitChange() {
  emit('change', { definition: { type: 'sql', sql: sql.value, fields: importedFields.value } })
}

function insertTable(tableId) {
  const [schema, table] = tableId.split(':')
  sql.value += ` \`${schema}\`.\`${table}\` `
  emitChange()
  ElMessage({ message: t('dataset.sql.insertTableSuccess', { schema, table }), type: 'success', duration: 900 })
}

function insertField(field, event) {
  const token = event?.shiftKey ? `\`${field.name}\`` : `\`${field.schema}\`.\`${field.table}\`.\`${field.name}\``
  sql.value += ` ${token} `
  emitChange()
  ElMessage({ message: t('dataset.sql.insertFieldSuccess', { table: field.table, name: field.name }), type: 'success', duration: 900 })
}

async function runPreview() {
  lastError.value = ''
  if (!sql.value.trim()) return ElMessage.warning(t('dataset.sql.sqlEmpty'))
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, { type: 'sql', sql: sql.value }, limit)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } catch (e) {
    lastError.value = e.message || t('dataset.sql.previewFailed')
    previewRows.value = []
  } finally { previewing.value = false }
}

async function importFields() {
  if (!previewRows.value.length) return ElMessage.warning(t('dataset.sql.previewFirst'))
  importing.value = true
  try {
    const cols = Object.keys(previewRows.value[0])
    importedFields.value = cols.map((c) => ({ name: c, label: c, type: 'string' }))
    emitChange()
    ElMessage.success(t('dataset.sql.importFieldsSuccess', { count: cols.length }))
  } finally { importing.value = false }
}

defineExpose({ preview: runPreview, getDefinition: () => ({ type: 'sql', sql: sql.value, fields: importedFields.value }) })
</script>

<style scoped>
.sql-builder { display: flex; gap: 12px; height: 100%; }
.sql-builder__left { flex: 0 0 260px; display: flex; flex-direction: column; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: hidden; padding: 8px; }
.sql-builder__panel-title { font-size: 14px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; flex-shrink: 0; }
.sql-builder__main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.sql-builder__main :deep(.sql-editor-wrap) { flex: 1 1 auto; height: auto; min-height: 140px; }
.sql-builder__toolbar { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.sql-builder__error { font-size: 12px; color: var(--el-color-danger); }
.sql-builder__preview { flex: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--el-border-color); border-radius: 6px; overflow: hidden; }
</style>