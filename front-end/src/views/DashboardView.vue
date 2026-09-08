<template>
  <div class="dashboard-view" :class="{ fullscreen }">
    <div class="view-bar">
      <div class="vb-left">
        <el-button circle @click="$router.push('/dashboards')"><el-icon><ArrowLeft /></el-icon></el-button>
        <h3 class="vb-title">{{ dashName }}</h3>
        <el-tag size="small" type="warning" effect="light">预览模式</el-tag>
      </div>
      <div class="vb-right">
        <el-button size="small" @click="refresh">刷新数据</el-button>
        <el-button size="small" @click="fullscreen = !fullscreen">
          <el-icon style="margin-right: 4px">
            <component :is="fullscreen ? 'Close' : 'FullScreen'" />
          </el-icon>
          {{ fullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </div>

    <div class="view-body">
      <DashboardCanvas
        :items="items"
        :charts="charts"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { dashboardApi, chartApi } from '@/api'
import DashboardCanvas from '@/components/dashboard/DashboardCanvas.vue'

const route = useRoute()
const router = useRouter()
const dashId = Number(route.params.id)
const dashName = ref('')
const items = ref([])
const charts = ref([])
const fullscreen = ref(false)
const refreshKey = ref(0)

async function load() {
  const dash = await dashboardApi.get(dashId)
  dashName.value = dash.name
  items.value = dash.layout
  charts.value = await chartApi.list()
}

function refresh() {
  refreshKey.value += 1
  ElMessage.success('已刷新')
}

onMounted(load)
</script>

<style scoped>
.dashboard-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dashboard-view.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #f0f2f5;
}

.view-bar {
  height: var(--app-header-height);
  background: #fff;
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.vb-left,
.vb-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vb-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.view-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}
</style>