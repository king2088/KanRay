<script setup lang="ts">
const { t } = useI18n()
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const settings = ref({
  theme: 'dark',
  defaultResolution: '1920x1080',
  autoSave: true,
  autoSaveInterval: 30
})

const saveSettings = () => {
  localStorage.setItem('sd_settings', JSON.stringify(settings.value))
  ElMessage.success(t('bigscreen.settings.saveSuccess'))
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
    <h1>{{ t('bigscreen.settings.title') }}</h1>
    <el-form label-width="120px">
      <el-form-item :label="t('bigscreen.settings.themeLabel')">
        <el-select v-model="settings.theme" style="width: 200px;">
          <el-option :label="t('bigscreen.settings.themeDark')" value="dark" />
          <el-option :label="t('bigscreen.settings.themeLight')" value="light" />
          <el-option :label="t('bigscreen.settings.themeTechBlue')" value="tech-blue" />
          <el-option :label="t('bigscreen.settings.themeNightPurple')" value="night-purple" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('bigscreen.settings.defaultResolution')">
        <el-select v-model="settings.defaultResolution" style="width: 200px;">
          <el-option label="1920×1080" value="1920x1080" />
          <el-option label="3840×2160" value="3840x2160" />
          <el-option label="1366×768" value="1366x768" />
          <el-option label="1536×864" value="1536x864" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('bigscreen.settings.autoSave')">
        <el-switch v-model="settings.autoSave" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.settings.saveInterval')" v-if="settings.autoSave">
        <el-input-number v-model="settings.autoSaveInterval" :min="10" :max="300" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="saveSettings">{{ t('bigscreen.settings.saveSettings') }}</el-button>
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