<template>
  <div class="admin-page">
    <template v-if="canView">
      <div class="admin-head">
        <h3>操作审计</h3>
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

    <el-pagination
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="load"
      style="margin-top: 12px; justify-content: flex-end"
    />
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
const pageSize = ref(20)
const loading = ref(false)

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
.admin-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.admin-head h3 { margin: 0; font-size: 16px; }
.audit-detail {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--app-text-regular);
  max-height: 72px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>