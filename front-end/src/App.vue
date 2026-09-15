<template>
  <el-config-provider :size="store.size">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { useAppStore } from '@/stores/app'

const store = useAppStore()
</script>