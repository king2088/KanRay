<script setup lang="ts">
import { ref } from 'vue'
import './config-common.css'

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
    <div class="rc-section-title">图片配置</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="图片">
        <div class="rc-image-upload-area" @click="triggerImageUpload">
          <img v-if="component.props.src" :src="component.props.src" class="rc-preview-img" />
          <div v-else class="rc-upload-placeholder">
            <el-icon :size="24"><Upload /></el-icon>
            <span>点击上传图片</span>
          </div>
        </div>
        <input ref="imageUploadRef" type="file" accept="image/*" class="rc-hidden-input" @change="handleImageUpload" />
      </el-form-item>
      <el-form-item label="填充模式">
        <el-select :model-value="component.props.objectFit || 'cover'" @update:model-value="emit('updateProps', 'objectFit', $event)" class="rc-w100">
          <el-option label="覆盖" value="cover" />
          <el-option label="包含" value="contain" />
          <el-option label="拉伸" value="fill" />
          <el-option label="原始" value="none" />
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>