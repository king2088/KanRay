<template>
  <div class="sql-builder">
    <div class="sql-builder__left">
      <div class="sql-builder__panel-title">表 / 字段</div>
      <el-tree :data="computedTree" node-key="id" default-expand-all :props="{ label: 'n', children: 'children' }" @node-click="onNodeClick">
        <template #default="{ data }">
          <span style="font-size: 12px">{{ data.n }}</span>
          <el-button v-if="data.kind === 'table'" link type="primary" size="small" style="margin-left:6px" @click.stop="insertTable(sql, data)">插入</el-button>
        </template>
      </el-tree>
    </div>
    <div class="sql-builder__main">
      <el-input
        v-model="localSql"
        type="textarea"
        :rows="14"
        resize="vertical"
        placeholder="SELECT ... -- 可用上方表/字段辅助插入；仅支持只读 SQL"
        class="sql-builder__editor"
      />
      <div class="sql-builder__preview-head">
        <span>明细预览（前 {{ limit }} 行）</span>
        <el-button size="small" type="primary" :loading="previewing" @click="runPreview">执行预览</el-button>
        <el-button size="small" :loading="importing" @click="importFields">从结果导入字段</el-button>
      </div>
      <el-table :data="previewRows" size="small" max-height="260" empty-text="点击「执行预览」查看数据">
        <el-table-column v-for="c in previewCols" :key="c" :prop="c" :label="c" min-width="120" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApi } from '@/api'
import { toTree } from '@/utils/catalog'

const props = defineProps({ datasourceId: { type: [Number, String], required: true } })
const emit = defineEmits(['change'])

const sql = ref('')
const schemas = ref([])
const previewRows = ref([])
const previewCols = ref([])
const previewing = ref(false)
const importing = ref(false)
const limit = 200

const computedTree = computed(() => toTree(schemas.value))
const localSql = computed({ get: () => sql.value, set: (v) => { sql.value = v; emitChange() } })
const importedFields = ref([])

function emitChange() {
  emit('change', { definition: { type: 'sql', sql: sql.value, fields: importedFields.value } })
}

function insertTable(sqlStr, data) {
  const parts = data.id.split(':')
  const schema = parts[0]
  const table = parts[1]
  sql.value += ` ${schema}.${table} `
  emitChange()
  ElMessage({ message: `已插入 ${schema}.${table}`, type: 'success', duration: 900 })
}

function onNodeClick(data) {
  if (data.kind !== 'field') return
  const f = data.raw
  sql.value += ` ${f.schema}.${f.table}.${f.name} `
  emitChange()
  ElMessage({ message: `已插入 ${f.table}.${f.name}`, type: 'success', duration: 900 })
}

async function runPreview() {
  if (!sql.value.trim()) return ElMessage.warning('请输入 SQL')
  previewing.value = true
  try {
    const res = await buildApi.previewDetail(props.datasourceId, { type: 'sql', sql: sql.value }, limit)
    previewCols.value = res.rows.length ? Object.keys(res.rows[0]) : (res.fields || []).map((f) => f.name)
    previewRows.value = res.rows
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

onMounted(async () => {
  schemas.value = await buildApi.sqlAssist(props.datasourceId)
})
</script>

<style scoped>
.sql-builder { display: flex; gap: 12px; height: 100%; }
.sql-builder__left { flex: 0 0 260px; border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; padding: 8px; }
.sql-builder__panel-title { font-size: 13px; font-weight: 600; color: var(--app-text-secondary); margin-bottom: 8px; }
.sql-builder__main { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.sql-builder__editor :deep(.el-textarea__inner) { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.sql-builder__preview-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--app-text-secondary); }
</style>
