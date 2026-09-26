<script setup lang="ts">
import { ref, watch } from 'vue'
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()

const videoSrc = ref('')

watch(() => props.component?.id, () => {
  videoSrc.value = props.component?.props?.src || ''
}, { immediate: true })
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.video.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.video.url')">
        <el-input v-model="videoSrc" @blur="emit('updateProps', 'src', videoSrc)" :placeholder="t('bigscreen.config.video.urlHint')" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.video.autoplay')">
        <el-switch :model-value="component.props.autoplay === true" @update:model-value="emit('updateProps', 'autoplay', $event)" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.video.loop')">
        <el-switch :model-value="component.props.loop === true" @update:model-value="emit('updateProps', 'loop', $event)" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.video.muted')">
        <el-switch :model-value="component.props.muted === true" @update:model-value="emit('updateProps', 'muted', $event)" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.common.fillMode')">
        <el-select :model-value="component.props.objectFit || 'cover'" @update:model-value="emit('updateProps', 'objectFit', $event)" class="rc-w100">
          <el-option :label="t('bigscreen.config.common.cover')" value="cover" />
          <el-option :label="t('bigscreen.config.common.contain')" value="contain" />
          <el-option :label="t('bigscreen.config.common.stretch')" value="fill" />
          <el-option :label="t('bigscreen.config.common.none')" value="none" />
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>