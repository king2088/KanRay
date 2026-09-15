<template>
  <div class="app-logo" @click="$router.push('/datasets')">
    <el-icon class="app-logo__icon"><DataAnalysis /></el-icon>
    <span v-show="!collapsed" class="app-logo__text">看板低代码平台</span>
  </div>
</template>

<script setup>
defineProps({ collapsed: { type: Boolean, default: false } })
</script>

<style scoped>
.app-logo {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--app-border-light);
  flex-shrink: 0;
}

.app-logo__icon {
  color: var(--app-primary);
  flex-shrink: 0;
  font-size: var(--header-icon-size, 20px);
}

.app-logo__text {
  font-size: var(--logo-font-size, 16px);
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
}
</style>