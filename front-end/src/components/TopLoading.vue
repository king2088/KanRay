<template>
  <transition name="top-loading-fade">
    <div v-if="visible" class="top-loading-bar" :class="{ done }" />
  </transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { topLoading } from '@/utils/top-loading'

const visible = ref(false)
const done = ref(false)
let hideTimer = null
let unsubscribe = null

onMounted(() => {
  unsubscribe = topLoading.subscribe((v) => {
    if (v) {
      clearTimeout(hideTimer)
      hideTimer = null
      done.value = false
      visible.value = true
    } else {
      done.value = true
      hideTimer = setTimeout(() => {
        visible.value = false
        done.value = false
      }, 400)
    }
  })
})

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  if (unsubscribe) unsubscribe()
})
</script>

<style scoped>
.top-loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--el-color-primary);
  border-radius: 0 2px 2px 0;
  z-index: 3000;
  animation: top-loading-sweep 1.6s ease-out forwards;
}

.top-loading-bar.done {
  animation: none;
  width: 100%;
  opacity: 0;
  transition: opacity 0.4s ease;
}

@keyframes top-loading-sweep {
  0% { width: 15% }
  55% { width: 55% }
  100% { width: 78% }
}

.top-loading-fade-enter-active,
.top-loading-fade-leave-active {
  transition: opacity 0.4s ease;
}

.top-loading-fade-enter-from,
.top-loading-fade-leave-to {
  opacity: 0;
}
</style>