<template>
  <div class="page-container">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">操作审计</h2>
          <div class="page-desc">记录用户在平台上的关键操作，便于安全追踪与审计</div>
        </div>
      </div>

      <div class="page-card">
        <div class="page-card__header">
          <div class="page-card__header-title">审计记录</div>
          <div class="page-card__header-right">
            <el-tag type="info" effect="plain">共 {{ total }} 条</el-tag>
          </div>
        </div>

        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column label="时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.created_at, appStore.timezone) }}</template>
          </el-table-column>
          <el-table-column prop="action" label="操作" width="150" />
          <el-table-column prop="email" label="用户" min-width="150" />
          <el-table-column label="资源" width="130">
            <template #default="{ row }">
              <span v-if="row.resource_type">{{ row.resource_type }}<template v-if="row.resource_id"> · {{ row.resource_id }}</template></span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="IP" width="130" />
          <el-table-column label="明细" width="130">
            <template #default="{ row }">
              <el-button v-if="row.detail" link type="primary" @click="openDetail(row.detail)">查看详情</el-button>
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

      <el-dialog v-model="detailVisible" title="操作明细" width="680px">
        <JsonCodeMirror v-if="currentDetail !== null" :model-value="currentDetail" />
      </el-dialog>
    </template>
    <el-empty v-if="!canView" description="无权限访问该页面" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import JsonCodeMirror from '@/components/JsonCodeMirror.vue'
import { formatDateTime } from '@/utils/datetime'
import { useAppStore } from '@/stores/app'

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