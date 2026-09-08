<template>
  <div class="header-bar">
    <el-tooltip content="系统设置" placement="bottom">
      <el-icon :size="18" class="header-icon" @click="settingsOpen = true">
        <Setting />
      </el-icon>
    </el-tooltip>
    <div class="user-chip">
      <div class="user-chip__avatar">管</div>
      <span class="user-chip__name">管理员</span>
    </div>

    <AppSettingsDrawer v-model="settingsOpen" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppSettingsDrawer from './AppSettingsDrawer.vue'

const settingsOpen = ref(false)
</script>

<style scoped>
.header-bar {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  cursor: pointer;
  color: var(--app-text-regular);
  padding: 6px;
  border-radius: var(--app-radius);
  transition: color 0.15s, background 0.15s;
}
.header-icon:hover {
  background: var(--app-hover);
  color: var(--app-primary);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-chip__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--app-primary-light);
  color: var(--app-primary);
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-chip__name {
  font-size: 13px;
  color: var(--app-text-primary);
}
</style>