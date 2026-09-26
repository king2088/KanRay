<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">{{ t('admin.audit.title') }}</h2>
          <div class="page-desc">{{ t('admin.audit.pageDesc') }}</div>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">{{ t('admin.audit.listTitle') }}</div>
          <div class="page-card__header-right">
            <el-tag type="info" effect="plain">{{ t('admin.audit.totalCount', { count: total }) }}</el-tag>
          </div>
        </div>

        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column :label="t('admin.audit.time')" width="180">
            <template #default="{ row }">{{ formatDateTime(row.created_at, appStore.timezone) }}</template>
          </el-table-column>
          <el-table-column :label="t('admin.audit.action')" width="150">
          <template #default="{ row }">{{ actionLabel(row.action) }}</template>
        </el-table-column>
          <el-table-column prop="email" :label="t('admin.audit.user')" min-width="150" />
          <el-table-column :label="t('admin.audit.resource')" width="130">
            <template #default="{ row }">
              <span v-if="row.resource_type">{{ resourceTypeLabel(row.resource_type) }}<template v-if="row.resource_id"> · {{ row.resource_id }}</template></span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="IP" width="130" />
          <el-table-column :label="t('admin.audit.detail')" width="130">
            <template #default="{ row }">
              <el-button v-if="row.detail" link type="primary" @click="openDetail(row.detail)">{{ t('admin.audit.viewDetail') }}</el-button>
              <span v-else>-</span>
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

      <el-dialog v-model="detailVisible" :title="t('admin.audit.detailDialog')" width="680px">
        <JsonCodeMirror v-if="currentDetail !== null" :model-value="currentDetail" />
      </el-dialog>
    </template>
    <el-empty v-if="!canView" :description="t('admin.audit.noPermission')" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import JsonCodeMirror from '@/components/JsonCodeMirror.vue'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'
// 码 → 词典标签。取回的标签若与键名相同，说明词典里没有该码，原样回退为码本身
// （与迁移前展示裸码的行为一致），因此无需在 JS 里重复维护一份码表。
function actionLabel(code) {
  const key = `admin.audit.actions.${code}`
  const label = t(key)
  return label === key ? code : label
}

function resourceTypeLabel(type) {
  const key = `admin.audit.resourceTypes.${type}`
  const label = t(key)
  return label === key ? type : label
}

const { t } = useI18n()
const auth = useAuthStore()
const appStore = useAppStore()
const canView = computed(() => auth.hasPermission('audit', 'read'))

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const detailVisible = ref(false)
const currentDetail = ref(null)

function openDetail(detail) {
  currentDetail.value = detail
  detailVisible.value = true
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

async function load() {
  loading.value = true
  try {
    const r = await adminApi.audit({ page: page.value, pageSize: pageSize.value })
    rows.value = r.list.map((x) => {
      let detail = null
      if (x.detail) {
        try { detail = JSON.stringify(JSON.parse(x.detail), null, 2) } catch (e) { detail = x.detail }
      }
      return { ...x, detail }
    })
    total.value = r.total
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>