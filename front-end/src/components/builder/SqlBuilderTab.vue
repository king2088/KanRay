<template>
  <div class="sql-builder">
    <div class="sql-builder__left">
      <div class="sql-builder__panel-title">表 / 字段（点「插入」进编辑器）</div>
      <SchemaTree :catalog="schemas" @mount-table="insertTable" @pick-field="insertField" />
    </div>
    <div class="sql-builder__main">
      <SqlCodeMirror v-model="localSql" :catalog="schemas" placeholder="SELECT ... -- 仅支持只读 SQL；表/字段从左侧插入" />
      <div class="sql-builder__toolbar">
        <el-button size="small" type="primary" :loading="previewing" @click="runPreview">执行预览（前 {{ limit }} 行）</el-button>
        <el-button size="small" :loading="importing" :disabled="!previewRows.length" @click="importFields">从结果导入字段</el-button>
        <span v-if="lastError" class="sql-builder__error">{{ lastError }}</span>
      </div>
      <el-table :data="previewRows" size="small" max-height="260" empty-text="点击「执行预览」查看数据">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="120" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
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
  ElMessage({ message: `已插入 ${schema}.${table}`, type: 'success', duration: 900 })
}

function insertField(field, event) {
  const token = event?.shiftKey ? `\`${field.name}\`` : `\`${field.schema}\`.\`${field.table}\`.\`${field.name}\``
  sql.value += ` ${token} `
  emitChange()
  ElMessage({ message: `已插入 ${field.table}.${field.name}`, type: 'success', duration: 900 })
}

async function runPreview() {
  lastError.value = ''
  if (!sql.value.trim()) return ElMessage.warning('请输入 SQL')
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, { type: 'sql', sql: sql.value }, limit)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
  } catch (e) {
    lastError.value = e.message || '预览失败'
    previewRows.value = []
  } finally { previewing.value = false }
}

async function importFields() {
  if (!previewRows.value.length) return ElMessage.warning('先执行预览再导入字段')
  importing.value = true
  try {
    const cols = Object.keys(previewRows.value[0])
    importedFields.value = cols.map((c) => ({ name: c, label: c, type: 'string' }))
    emitChange()
    ElMessage.success(`已导入 ${cols.length} 个字段`)
  } finally { importing.value = false }
}

defineExpose({ preview: runPreview, getDefinition: () => ({ type: 'sql', sql: sql.value, fields: importedFields.value }) })
</script>

<style scoped>
.sql-builder { display: flex; gap: 12px; height: 100%; }
.sql-builder__left { flex: 0 0 260px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.sql-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.sql-builder__main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sql-builder__toolbar { display: flex; align-items: center; gap: 8px; }
.sql-builder__error { font-size: 12px; color: var(--el-color-danger); }
</style>