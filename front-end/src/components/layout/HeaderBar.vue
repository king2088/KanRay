<template>
  <div class="header-bar">
    <el-tooltip content="系统设置" placement="bottom">
      <el-icon :size="18" class="header-icon" @click="emit('update:settingsOpen', true)">
        <Setting />
      </el-icon>
    </el-tooltip>
    <UserMenu />
  </div>
</template>

<script setup>
import UserMenu from './UserMenu.vue'

defineProps({ settingsOpen: { type: Boolean, default: false } })
const emit = defineEmits(['update:settingsOpen'])
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
  border-radius: var(--app-radius);
  transition: color 0.15s, background 0.15s;
}
.header-icon:hover {
  background: var(--app-hover);
  color: var(--app-primary);
}
</style>