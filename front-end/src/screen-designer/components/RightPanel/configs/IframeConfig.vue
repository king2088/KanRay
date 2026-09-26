<script setup lang="ts">
import { ref, watch } from 'vue'
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()

const iframeSrc = ref('')
const iframeSandbox = ref('')

watch(() => props.component?.id, () => {
  iframeSrc.value = props.component?.props?.src || ''
  iframeSandbox.value = props.component?.props?.sandbox || ''
}, { immediate: true })
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.iframe.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.iframe.url')">
        <el-input v-model="iframeSrc" @blur="emit('updateProps', 'src', iframeSrc)" :placeholder="t('bigscreen.config.iframe.urlHint')" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.iframe.transparent')">
        <el-switch :model-value="component.props.transparent === true" @update:model-value="emit('updateProps', 'transparent', $event)" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.iframe.sandbox')">
        <el-input v-model="iframeSandbox" @blur="emit('updateProps', 'sandbox', iframeSandbox)" :placeholder="t('bigscreen.config.iframe.sandboxHint')" />
      </el-form-item>
      <div class="rc-section-tip">
        {{ t('bigscreen.config.iframe.warn') }}
      </div>
    </el-form>
  </div>
</template>