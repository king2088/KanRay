<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const settings = ref({
  theme: 'dark',
  defaultResolution: '1920x1080',
  autoSave: true,
  autoSaveInterval: 30
})

const saveSettings = () => {
  localStorage.setItem('sd_settings', JSON.stringify(settings.value))
  ElMessage.success('设置保存成功')
}

const loadSettings = () => {
  const stored = localStorage.getItem('sd_settings')
  if (stored) {
    settings.value = JSON.parse(stored)
  }
}

// Load settings on component mount
loadSettings()
</script>

<template>
  <div class="settings">
    <h1>全局设置</h1>
    <el-form label-width="120px">
      <el-form-item label="主题">
        <el-select v-model="settings.theme" style="width: 200px;">
          <el-option label="深色主题" value="dark" />
          <el-option label="浅色主题" value="light" />
          <el-option label="科技蓝" value="tech-blue" />
          <el-option label="暗夜紫" value="night-purple" />
        </el-select>
      </el-form-item>
      <el-form-item label="默认分辨率">
        <el-select v-model="settings.defaultResolution" style="width: 200px;">
          <el-option label="1920×1080" value="1920x1080" />
          <el-option label="3840×2160" value="3840x2160" />
          <el-option label="1366×768" value="1366x768" />
          <el-option label="1536×864" value="1536x864" />
        </el-select>
      </el-form-item>
      <el-form-item label="自动保存">
        <el-switch v-model="settings.autoSave" />
      </el-form-item>
      <el-form-item label="保存间隔(秒)" v-if="settings.autoSave">
        <el-input-number v-model="settings.autoSaveInterval" :min="10" :max="300" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="saveSettings">保存设置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.settings {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 30px;
  color: #303133;
}
</style>