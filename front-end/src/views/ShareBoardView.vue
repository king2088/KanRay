<template>
  <div class="share-page">
    <div v-loading="loading" class="share-center" v-if="loading" style="min-height: 60vh"></div>

    <div v-else-if="!meta || !meta.found" class="share-center">
      <el-result icon="error" title="分享不存在" sub-title="该分享链接不存在或已被删除" />
    </div>

    <div v-else-if="meta.expired || meta.inactive" class="share-center">
      <el-result icon="warning" :title="meta.expired ? '分享已过期' : '分享已关闭'"
        sub-title="请联系看板创建者处理" />
    </div>

    <div v-else-if="!boardReady" class="share-center">
      <div class="share-gate-card">
        <h3 class="share-gate-card__title">{{ meta.dashboardName }}</h3>
        <p class="share-gate-card__desc">
          {{ meta.requiresPassword ? '该看板已通过分享链接公开，请输入访问密码进行只读查看' : '该看板已通过分享链接公开，点击下方按钮进行只读查看' }}
        </p>
        <el-input v-if="meta.requiresPassword" v-model="password" type="password" show-password
          placeholder="访问密码" @keyup.enter="verify" />
        <div class="share-gate-card__actions">
          <el-button type="primary" :loading="verifying" @click="verify">
            {{ meta.requiresPassword ? '查看看板' : '进入查看' }}
          </el-button>
          <el-button v-if="auth.isLoggedIn" link @click="$router.push('/')">返回系统</el-button>
        </div>
      </div>
    </div>

    <div v-else class="share-board">
      <div class="share-bar">
        <div class="share-bar__title">
          {{ dashName }}
          <el-tag size="small" type="info" effect="plain">只读分享</el-tag>
        </div>
        <div class="share-bar__actions">
          <el-button size="small" @click="refresh">刷新数据</el-button>
          <el-button v-if="auth.isLoggedIn" size="small" link @click="$router.push('/')">返回系统</el-button>
        </div>
      </div>
      <div class="share-board__body">
        <DashboardCanvas
          :key="refreshKey"
          :items="items"
          :charts="charts"
          :gap="gap"
          :card-style="cardStyle"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { shareApi, SHARE_TOKEN_KEY } from '@/api/share'
import { useAuthStore } from '@/stores/auth'
import { alignTree, normalizeLayout, normCardStyle, normGap } from '@/utils/grid-layout'
import DashboardCanvas from '@/components/dashboard/DashboardCanvas.vue'

const route = useRoute()
const auth = useAuthStore()
const token = String(route.params.token || '')

const loading = ref(true)
const meta = ref(null)
const password = ref('')
const verifying = ref(false)
const boardReady = ref(false)
const dashName = ref('')
const items = ref([])
const charts = ref([])
const gap = ref({ x: 12, y: 12 })
const cardStyle = ref(normCardStyle(null))
const refreshKey = ref(0)
const chartCache = ref({})

provide('shareApiOverride', {
  chartApi: {
    get: async (id) => chartCache.value[Number(id)]
      || Promise.reject(new Error('图表不存在')),
    data: (id, filters) => shareApi.chartData(token, id, filters).then((r) => r),
  },
  datasetApi: {
    get: async () => ({ fields: [] }),
  },
})

async function loadMeta() {
  loading.value = true
  try {
    const m = await shareApi.meta(token)
    meta.value = m
    if (m.found && !m.expired && !m.inactive && !m.requiresPassword) enter()
  } catch (e) {
    meta.value = { found: false }
  } finally {
    loading.value = false
  }
}

async function verify() {
  if (meta.value?.requiresPassword && !password.value) return ElMessage.warning('请输入访问密码')
  await enter()
}

async function enter() {
  verifying.value = true
  try {
    const res = await shareApi.verify(token, meta.value?.requiresPassword ? password.value : '')
    sessionStorage.setItem(SHARE_TOKEN_KEY, res.accessToken)
    await buildBoard()
    boardReady.value = true
  } catch (e) {
    ElMessage.error(e.message || '验证失败')
  } finally {
    verifying.value = false
  }
}

async function buildBoard() {
  const dash = await shareApi.dashboard(token)
  dashName.value = dash.name
  gap.value = normGap(dash.gap)
  cardStyle.value = normCardStyle(dash.cardStyle)
  items.value = normalizeLayout(dash.layout || [], 12, gap.value)
  alignTree(items.value, 12, gap.value)
  charts.value = dash.charts || []
  const map = {}
  charts.value.forEach((c) => { map[c.id] = c })
  chartCache.value = map
}

function refresh() {
  refreshKey.value += 1
  ElMessage.success('已刷新')
}

onMounted(loadMeta)
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.share-center {
  flex: 1;
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-gate-card {
  width: 360px;
  padding: 32px;
  background: var(--app-glass-strong);
  border: 1px solid var(--app-border-light);
  border-radius: 12px;
  box-shadow: var(--app-glass-edge), var(--app-shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  backdrop-filter: blur(20px) saturate(150%);
}

.share-gate-card__title {
  margin: 0;
  font-size: 18px;
  color: var(--app-text-primary);
}

.share-gate-card__desc {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary);
  line-height: 1.6;
}

.share-gate-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.share-bar {
  height: 56px;
  background: var(--app-glass);
  border-bottom: 1px solid var(--app-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.share-bar__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.share-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-board__body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.share-board__body :deep(.dash-canvas) {
  height: 100%;
}
</style>