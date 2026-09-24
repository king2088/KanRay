<template>
  <div class="page-container form-fill">
    <div class="page-header">
      <div class="d-header">
        <el-button circle class="back-btn" @click="$router.push('/forms')"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">{{ form?.name || '' }}</h2>
      </div>
    </div>

    <div class="page-card">
      <div v-if="form" class="form-fill__card">
        <div class="form-fill__header">
          <el-tag :type="statusType" effect="plain">{{ statusLabel }}</el-tag>
        </div>

        <FormRenderer ref="renderer" :fields="form.schema.fields" :description="form.description" />

        <div v-if="form.status === 'published' && canSubmit" class="form-fill__actions">
          <el-button type="primary" :loading="submitting" @click="submit">
            <el-icon style="margin-right: 4px"><Check /></el-icon>提交
          </el-button>
          <el-button @click="$router.push(`/forms/${form.id}/design`)">返回设计</el-button>
        </div>
        <div v-else-if="form.status === 'closed'" class="form-fill__closed">
          该表单已停止收集，无法继续提交。
        </div>
        <div v-else-if="form.status === 'draft'" class="form-fill__closed">
          该表单尚未发布，无法提交。
        </div>
      </div>
      <div v-else v-loading="loading" class="form-fill__loading" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, ArrowLeft } from '@element-plus/icons-vue'
import { formApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import FormRenderer from '@/components/form/FormRenderer.vue'

const route = useRoute()
const auth = useAuthStore()
const id = Number(route.params.id)
const form = ref(null)
const renderer = ref(null)
const loading = ref(true)
const submitting = ref(false)

const statusLabel = computed(() => ({ draft: '草稿', published: '已发布', closed: '已关闭' })[form.value?.status] || form.value?.status)
const statusType = computed(() => ({ draft: 'info', published: 'success', closed: 'warning' })[form.value?.status] || 'info')
const canSubmit = computed(() => auth.hasPermission('form', 'submit'))

async function submit() {
  const ok = await renderer.value.validate().catch(() => false)
  if (!ok) return ElMessage.warning('请完善必填项')
  submitting.value = true
  try {
    const res = await formApi.submit(id, renderer.value.model)
    ElMessage.success(`${form.value.submitConfig?.successText || '提交成功'}${res?.id ? `（序号 ${res.id}）` : ''}`)
    renderer.value.resetFields()
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    form.value = await formApi.get(id)
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.form-fill__card {
  max-width: 760px;
  margin: 0 auto;
  padding: 10px 0 20px;
}
.form-fill__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.d-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-btn {
  flex-shrink: 0;
}
.form-fill__actions {
  display: flex;
  gap: 8px;
  margin-top: 22px;
}
.form-fill__closed {
  color: var(--el-text-color-secondary);
  padding: 20px 0;
  text-align: center;
}
.form-fill__loading {
  min-height: 200px;
}
</style>