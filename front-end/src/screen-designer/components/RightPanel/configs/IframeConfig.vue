<script setup lang="ts">
import { ref, watch } from 'vue'
import './config-common.css'

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
    <div class="rc-section-title">iframe配置</div>
    <el-form label-width="70px" size="default">
      <el-form-item label="网址URL">
        <el-input v-model="iframeSrc" @blur="emit('updateProps', 'src', iframeSrc)" placeholder="输入URL后按回车确认" />
      </el-form-item>
      <el-form-item label="透明背景">
        <el-switch :model-value="component.props.transparent === true" @update:model-value="emit('updateProps', 'transparent', $event)" />
      </el-form-item>
      <el-form-item label="安全沙箱">
        <el-input v-model="iframeSandbox" @blur="emit('updateProps', 'sandbox', iframeSandbox)" placeholder="默认已开启全部权限，一般无需修改" />
      </el-form-item>
      <div class="rc-section-tip">
        提示：部分网站（如百度、知乎等）通过X-Frame-Options头禁止被iframe嵌入，无法通过沙箱配置绕过。可尝试允许嵌入的网站（如 Wikipedia、示例页面等）。
      </div>
    </el-form>
  </div>
</template>