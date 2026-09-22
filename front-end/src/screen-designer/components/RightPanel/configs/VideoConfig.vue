<script setup lang="ts">
import { ref, watch } from 'vue'
import './config-common.css'

const props = defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()

const videoSrc = ref('')

watch(() => props.component?.id, () => {
  videoSrc.value = props.component?.props?.src || ''
}, { immediate: true })
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">视频配置</div>
    <el-form label-width="70px" size="small">
      <el-form-item label="视频地址">
        <el-input v-model="videoSrc" @blur="emit('updateProps', 'src', videoSrc)" placeholder="输入URL后按回车确认" />
      </el-form-item>
      <el-form-item label="自动播放">
        <el-switch :model-value="component.props.autoplay === true" @update:model-value="emit('updateProps', 'autoplay', $event)" />
      </el-form-item>
      <el-form-item label="循环播放">
        <el-switch :model-value="component.props.loop === true" @update:model-value="emit('updateProps', 'loop', $event)" />
      </el-form-item>
      <el-form-item label="静音">
        <el-switch :model-value="component.props.muted === true" @update:model-value="emit('updateProps', 'muted', $event)" />
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