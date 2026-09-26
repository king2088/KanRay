<template>
  <div class="share-shell">
    <div class="share-shell__card">
      <div class="share-shell__brand">
        <div class="share-shell__logo">K</div>
        <span>{{ t('form.shareView.brand') }}</span>
      </div>

      <div v-if="!ready" class="share-shell__loading">
        <el-skeleton :rows="6" animated />
      </div>

      <div v-else-if="notFound" class="share-shell__empty">
        <el-empty :description="t('form.shareView.notFound')" />
      </div>

      <div v-else-if="!opened" class="share-shell__gate">
        <h1 class="share-shell__title">{{ meta.formName }}</h1>
        <p class="share-shell__desc">{{ gateMsg }}</p>
        <div v-if="meta.requiresPassword && meta.published" class="share-shell__pwd">
          <el-input
            v-model="password"
            type="password"
            show-password
            size="large"
            :placeholder="t('form.shareView.passwordPlaceholder')"
            @keyup.enter="verify"
          />
          <el-button type="primary" size="large" :loading="verifying" @click="verify">{{ t('form.shareView.enter') }}</el-button>
        </div>
        <el-button v-else-if="meta.published" type="primary" size="large" @click="verify">{{ t('form.shareView.startFill') }}</el-button>
      </div>

      <div v-else-if="form" class="share-shell__form">
        <div class="share-fill__header">
          <h1 class="share-shell__title">{{ form.name }}</h1>
          <el-tag type="success" effect="plain" size="small">{{ t('form.shareView.publishedBadge') }}</el-tag>
        </div>
        <FormRenderer ref="renderer" :fields="form.schema.fields" :description="form.description" />
        <div class="share-shell__actions">
          <el-button type="primary" size="large" :loading="submitting" @click="submit">{{ t('form.shareView.submit') }}</el-button>
          <el-button size="large" @click="$router.replace('/')">{{ t('form.shareView.cancel') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { formShareApi, FORM_SHARE_TOKEN_KEY } from '@/api/formShare'
import FormRenderer from '@/components/form/FormRenderer.vue'

const { t } = useI18n()
const route = useRoute()
const token = String(route.params.token || '')

const meta = ref({ found: false, formName: '', requiresPassword: false, published: false, expired: false, inactive: false })
const ready = ref(false)
const opened = ref(false)
const password = ref('')
const verifying = ref(false)
const form = ref(null)
const renderer = ref(null)
const submitting = ref(false)

const notFound = computed(() => !meta.value.found)
const gateMsg = computed(() => {
  if (meta.value.expired) return t('form.shareView.gateExpired')
  if (meta.value.inactive) return t('form.shareView.gateInactive')
  if (!meta.value.published) return t('form.shareView.gateNotPublished')
  if (meta.value.requiresPassword) return t('form.shareView.gateNeedsPassword')
  return ''
})

async function metaLoad() {
  ready.value = false
  try {
    meta.value = await formShareApi.meta(token)
    if (!meta.value.found) return
    opened.value = !verifyNeeded()
    if (opened.value) await verify()
  } finally {
    ready.value = true
  }
}

function verifyNeeded() {
  return meta.value.requiresPassword || !meta.value.published
}

async function verify() {
  if (meta.value.requiresPassword && !password.value.trim()) {
    return ElMessage.warning(t('form.shareView.errPasswordRequired'))
  }
  verifying.value = true
  try {
    const { accessToken } = await formShareApi.verify(token, password.value)
    sessionStorage.setItem(FORM_SHARE_TOKEN_KEY, accessToken)
    opened.value = true
    const { form: fillView } = await formShareApi.form(token)
    form.value = fillView
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    verifying.value = false
  }
}

async function submit() {
  const ok = await renderer.value.validate().catch(() => false)
  if (!ok) return ElMessage.warning(t('form.shareView.errRequiredMissing'))
  submitting.value = true
  try {
    const res = await formShareApi.submit(token, renderer.value.model)
    const text = form.value.submitConfig?.successText || t('form.fill.successFallback')
    ElMessage.success(res?.id ? t('form.fill.successWithId', { text, id: res.id }) : text)
    renderer.value.resetFields()
  } finally {
    submitting.value = false
  }
}

onMounted(metaLoad)
</script>

<style scoped>
.share-shell {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 48px 16px;
  background-color: var(--app-bg);
  background-image: var(--app-bg-image);
}
.share-shell__card {
  width: 100%;
  max-width: 720px;
  background: var(--app-surface);
  border: 1px solid var(--app-border-light);
  border-radius: 16px;
  box-shadow: var(--app-shadow-card);
  padding: 28px 36px 36px;
  align-self: flex-start;
}
.share-shell__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 22px;
}
.share-shell__logo {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: linear-gradient(135deg, #409eff, #7c4dff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}
.share-shell__loading {
  min-height: 220px;
}
.share-shell__empty {
  padding: 20px 0;
}
.share-shell__gate {
  text-align: center;
}
.share-shell__title {
  font-size: 22px;
  margin: 0 0 8px;
}
.share-shell__desc {
  color: var(--el-text-color-secondary);
  margin-bottom: 22px;
}
.share-shell__pwd {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.share-fill__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.share-shell__actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
</style>