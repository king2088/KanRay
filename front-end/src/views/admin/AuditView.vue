<template>
  <div class="admin-page">
    <template v-if="canView">
      <div class="page-header">
        <div class="page-header__main">
          <h2 class="page-title">操作审计</h2>
          <div class="page-desc">记录用户在平台上的关键操作，便于安全追踪与审计</div>
        </div>
      </div>

    <el-table :data="rows" border stripe v-loading="loading">
      <el-table-column prop="created_at" label="时间" width="180" />
      <el-table-column prop="action" label="操作" width="130" />
      <el-table-column prop="email" label="用户" min-width="150" />
      <el-table-column label="资源" width="130">
        <template #default="{ row }">
          <span v-if="row.resource_type">{{ row.resource_type }}<template v-if="row.resource_id"> · {{ row.resource_id }}</template></span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="130" />
      <el-table-column label="明细" min-width="260">
        <template #default="{ row }">
          <pre v-if="row.detail" class="audit-detail">{{ row.detail }}</pre>
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
    </template>
    <el-empty v-if="!canView" description="无权限访问该页面" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canView = computed(() => auth.hasPermission('audit', 'read'))

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

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
<style scoped>
.admin-page { padding: 16px; }
.audit-detail {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--app-text-regular);
  max-height: 72px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>