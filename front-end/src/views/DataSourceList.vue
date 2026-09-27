<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">{{ t('dataset.dataSource.title') }}</h2>
        <div class="page-desc">{{ t('dataset.dataSource.pageDesc') }}</div>
      </div>
      <div class="page-header__actions">
        <el-dropdown split-button type="primary" @click="showForm = true" @command="onCreateCommand">
          <el-icon style="margin-right: 6px"><Plus /></el-icon>{{ t('dataset.dataSource.create') }}
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="upload"><el-icon><Upload /></el-icon>{{ t('dataset.dataSource.uploadExcelCsv') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="stat-strip">
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><Coin /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ total }}</div>
          <div class="stat-item__label">{{ t('dataset.dataSource.stats.total') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><Grid /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ dbCount }}</div>
          <div class="stat-item__label">{{ t('dataset.dataSource.stats.dbKinds') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><Upload /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ fileCount }}</div>
          <div class="stat-item__label">{{ t('dataset.dataSource.stats.fileSources') }}</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-item__icon"><el-icon><CircleCheck /></el-icon></div>
        <div>
          <div class="stat-item__value">{{ activeCount }}</div>
          <div class="stat-item__label">{{ t('dataset.dataSource.stats.active') }}</div>
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div class="page-card__header-title">{{ t('dataset.dataSource.list') }}</div>
        <div class="page-card__header-right">
          <el-input
            v-model="search"
            :placeholder="t('dataset.dataSource.searchPlaceholder')"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
          <el-tag type="info" effect="plain">{{ t('dataset.dataSource.totalCount', { count: total }) }}</el-tag>
        </div>
      </div>

      <el-table :data="filtered" v-loading="loading" :empty-text="t('dataset.dataSource.emptyHint')">
        <el-table-column prop="name" :label="t('dataset.dataSource.name')" min-width="180">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name__icon"><DbIcon :type="row.type" :size="16" /></div>
              <el-link type="primary" @click="$router.push(`/datasources/${row.id}`)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" :label="t('dataset.dataSource.type')" width="160">
          <template #default="{ row }">
            <el-tag  :type="statusType(row.type)">{{ typeName(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" :label="t('dataset.dataSource.status')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" >
              {{ row.is_active ? t('common.state.enabled') : t('common.state.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('dataset.dataSource.lastTest')" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.last_test_ok === true" type="success" >{{ t('common.state.success') }}</el-tag>
            <el-tag v-else-if="row.last_test_ok === false" type="danger" >{{ t('common.state.failed') }}</el-tag>
            <span v-else class="cell-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('dataset.dataSource.actions')" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary"  @click="$router.push(`/datasources/${row.id}`)">{{ t('dataset.dataSource.detail') }}</el-button>
            <el-button link type="primary"  @click="editRow = { ...row }; showForm = true">{{ t('common.actions.edit') }}</el-button>
            <el-button link type="primary"  @click="testOne(row)" :loading="testingId === row.id">{{ t('common.actions.test') }}</el-button>
            <el-button link type="danger"  @click="remove(row)">{{ t('common.actions.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="page-card__footer">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[10, 20, 50]"
          background
          @size-change="onSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <DataSourceFormDialog
      v-model="showForm"
      :edit-row="editRow"
      @saved="onSaved"
    />

    <DataSourceUploadDialog v-model="showUpload" @created="load" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { datasourceApi } from '@/api'
import { localizeApiMessage, t } from '@/i18n'
import { datasourceTestMessage } from '@/i18n/datasource-test-message'
import DbIcon from '@/components/DbIcon.vue'
import DataSourceFormDialog from './DataSourceFormDialog.vue'
import DataSourceUploadDialog from './DataSourceUploadDialog.vue'

const list = ref([])
const loading = ref(false)
const showForm = ref(false)
const showUpload = ref(false)
const editRow = ref(null)
const testingId = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dbCount = computed(() => new Set(list.value.map((x) => x.type).filter((t) => t !== 'excel')).size)
const fileCount = computed(() => list.value.filter((x) => x.type === 'excel').length)
const activeCount = computed(() => list.value.filter((x) => x.is_active).length)

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((d) => d.name.toLowerCase().includes(kw))
})

function onCreateCommand(cmd) {
  if (cmd === 'upload') showUpload.value = true
}

function typeName(type) {
  const map = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlserver: 'SQL Server', mariadb: 'MariaDB', tidb: 'TiDB', clickhouse: 'ClickHouse', elasticsearch: 'Elasticsearch', api: 'API/Web Service', oracle: 'Oracle', db2: 'DB2', dameng: 'DM', gbase: 'GBASE', hive: 'Hive', impala: 'Impala', presto: 'Presto', maxcompute: 'MaxCompute', doris: 'Doris', starrocks: 'StarRocks', greenplum: 'Greenplum', kingbase: 'KingbaseES', gaussdb: 'GaussDB', redshift: 'Redshift', excel: 'Excel/CSV' }
  return map[type] || type
}

function statusType(type) {
  const map = { mysql: '', postgres: '', sqlserver: '', mariadb: '', tidb: '', clickhouse: 'warning', elasticsearch: 'info', api: 'info', excel: 'success' }
  return map[type] || 'info'
}

async function load() {
  loading.value = true
  try {
    const res = await datasourceApi.listPaged(page.value, pageSize.value)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onPageChange(p) {
  page.value = p
  load()
}

function onSizeChange(size) {
  pageSize.value = size
  page.value = 1
  load()
}

async function testOne(row) {
  testingId.value = row.id
  try {
    const res = await datasourceApi.testSaved(row.id)
    // provider 的结果文案在 data.message 里、后端另给 messageEn，不取英文侧就会出现
    // 「Connection succeeded: 连接成功」这种中英并排。详情是否值得附加由助手判定。
    const detail = localizeApiMessage(res.message, res.messageEn)
    ElMessage[res.ok ? 'success' : 'error'](datasourceTestMessage(t, res.ok, detail))
    load()
  } catch (e) { /* 拦截器已提示 */ }
  finally { testingId.value = null }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      t('dataset.dataSource.deleteConfirm', { name: row.name }),
      t('dataset.dataSource.deleteConfirmTitle'),
      { type: 'warning' }
    )
    await datasourceApi.remove(row.id)
    ElMessage.success(t('dataset.dataSource.deleteSuccess'))
    load()
  } catch (e) { /* 用户取消或出错，忽略 */ }
}

function onSaved() { showForm.value = false; editRow.value = null; load() }

onMounted(load)
</script>

<style scoped>
.cell-name { display: flex; align-items: center; gap: 8px; }
.cell-name__icon { width: 26px; height: 26px; border-radius: 6px; background: var(--app-primary-light); color: var(--app-primary); display: flex; align-items: center; justify-content: center; }
.cell-muted { color: var(--app-text-secondary); font-size: 14px; }
</style>
