<script setup lang="ts">
import { ref } from 'vue'
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()

const imageUploadRef = ref<HTMLInputElement>()

function triggerImageUpload() { imageUploadRef.value?.click() }

function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => emit('updateProps', 'src', reader.result as string)
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.staticImage.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.staticImage.image')">
        <div class="rc-image-upload-area" @click="triggerImageUpload">
          <img v-if="component.props.src" :src="component.props.src" class="rc-preview-img" />
          <div v-else class="rc-upload-placeholder">
            <el-icon :size="24"><Upload /></el-icon>
            <span>{{ t('bigscreen.config.staticImage.clickUpload') }}</span>
          </div>
        </div>
        <input ref="imageUploadRef" type="file" accept="image/*" class="rc-hidden-input" @change="handleImageUpload" />
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