<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">数据源</h2>
        <div class="page-desc">管理外部数据库连接，作为图表与看板的数据基础</div>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="showForm = true">
          <el-icon style="margin-right: 6px"><Plus /></el-icon>新建数据源
        </el-button>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">数据源列表</div>
        <div class="page-card__header-right">
          <el-tag type="info" effect="plain">共 {{ list.length }} 条</el-tag>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" empty-text="还没有数据源，点击右上角「新建数据源」开始">
        <el-table-column prop="name" label="名称" min-width="180">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><el-icon><Coin /></el-icon></div>
              <el-link type="primary" @click="$router.push(`/datasources/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.type)">{{ typeName(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近测试" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.last_test_ok === true" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="row.last_test_ok === false" type="danger" size="small">失败</el-tag>
            <span v-else class="cell-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/datasources/${row.id}`)">详情</el-button>
            <el-button link type="primary" size="small" @click="editRow = row; showForm = true">编辑</el-button>
            <el-button link type="primary" size="small" @click="testOne(row)" :loading="testingId === row.id">测试</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <DataSourceFormDialog
      v-model="showForm"
      :edit-row="editRow"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { datasourceApi } from '@/api'
import DataSourceFormDialog from './DataSourceFormDialog.vue'

const list = ref([])
const loading = ref(false)
const showForm = ref(false)
const editRow = ref(null)
const testingId = ref(null)

function typeName(type) {
  const map = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlserver: 'SQL Server', mariadb: 'MariaDB', tidb: 'TiDB', clickhouse: 'ClickHouse', elasticsearch: 'Elasticsearch', api: 'API/Web Service', oracle: 'Oracle', db2: 'DB2', dameng: '达梦', gbase: 'GBASE', hive: 'Hive', impala: 'Impala', presto: 'Presto', maxcompute: 'MaxCompute', doris: 'Doris', starrocks: 'StarRocks', greenplum: 'Greenplum', kingbase: 'KingbaseES', gaussdb: 'GaussDB', redshift: 'Redshift' }
  return map[type] || type
}

function statusType(type) {
  const map = { mysql: '', postgres: '', sqlserver: '', mariadb: '', tidb: '', clickhouse: 'warning', elasticsearch: 'info', api: 'info' }
  return map[type] || 'info'
}

async function load() {
  loading.value = true
  try { list.value = await datasourceApi.list() } finally { loading.value = false }
}

async function testOne(row) {
  testingId.value = row.id
  try {
    const res = await datasourceApi.testSaved(row.id)
    ElMessage[res.ok ? 'success' : 'error'](`测试${res.ok ? '成功' : '失败'}: ${res.message}`)
    load()
  } catch (e) { /* 拦截器已提示 */ }
  finally { testingId.value = null }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除数据源「${row.name}」？`, '删除确认', { type: 'warning' })
  await datasourceApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

function onSaved() { showForm.value = false; editRow.value = null; load() }

onMounted(load)
</script>

<style scoped>
.cell-name { display: flex; align-items: center; gap: 8px; }
.cell-name__icon { width: 26px; height: 26px; border-radius: 6px; background: var(--app-primary-light); color: var(--app-primary); display: flex; align-items: center; justify-content: center; }
.cell-muted { color: var(--app-text-secondary); font-size: 13px; }
</style>