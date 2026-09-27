<template>
  <div class="share-page">
    <div v-loading="loading" class="share-center" v-if="loading" style="min-height: 60vh"></div>

    <div v-else-if="!meta || !meta.found" class="share-center">
      <el-result icon="error" :title="t('dashboard.shareView.notFoundTitle')" :sub-title="t('dashboard.shareView.notFoundSubtitle')" />
    </div>

    <div v-else-if="meta.expired || meta.inactive" class="share-center">
      <el-result icon="warning" :title="meta.expired ? t('dashboard.shareView.expiredTitle') : t('dashboard.shareView.closedTitle')"
        :sub-title="t('dashboard.shareView.contactOwner')" />
    </div>

    <div v-else-if="!boardReady" class="share-center">
      <div class="share-gate-card">
        <h3 class="share-gate-card__title">{{ meta.dashboardName }}</h3>
        <p class="share-gate-card__desc">
          {{ meta.requiresPassword ? t('dashboard.shareView.passwordRequiredHint') : t('dashboard.shareView.openHint') }}
        </p>
        <el-input v-if="meta.requiresPassword" v-model="password" type="password" show-password
          :placeholder="t('dashboard.shareView.passwordPlaceholder')" @keyup.enter="verify" />
        <div class="share-gate-card__actions">
          <el-button type="primary" :loading="verifying" @click="verify">
            {{ meta.requiresPassword ? t('dashboard.shareView.ctaWithPassword') : t('dashboard.shareView.ctaDirect') }}
          </el-button>
          <el-button v-if="auth.isLoggedIn" link @click="$router.push('/')">{{ t('dashboard.shareView.backToSystem') }}</el-button>
        </div>
      </div>
    </div>

    <div v-else class="share-board">
      <div class="share-bar">
        <div class="share-bar__title">
          {{ dashName }}
          <el-tag size="small" type="info" effect="plain">{{ t('dashboard.shareView.readOnlyBadge') }}</el-tag>
        </div>
        <div class="share-bar__actions">
          <el-button size="small" @click="refresh">{{ t('dashboard.shareView.refresh') }}</el-button>
          <el-button v-if="auth.isLoggedIn" size="small" link @click="$router.push('/')">{{ t('dashboard.shareView.backToSystem') }}</el-button>
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
import { t } from '@/i18n'
import { shareApi, SHARE_TOKEN_KEY } from '@/api/share'
import { toastApiError } from '@/api/error-toast'
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
    get: async (id) => chartCache.value[id]
      || Promise.reject(new Error(t('dashboard.shareView.errChartMissing'))),
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
  if (meta.value?.requiresPassword && !password.value) return ElMessage.warning(t('dashboard.shareView.errPasswordRequired'))
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
    toastApiError(t, e, 'dashboard.shareView.verifyFailed')
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
  ElMessage.success(t('dashboard.shareView.refreshed'))
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
  background: var(--app-surface);
  border: 1px solid var(--app-border-light);
  border-radius: 12px;
  box-shadow: var(--app-shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  background: var(--app-header-bg);
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