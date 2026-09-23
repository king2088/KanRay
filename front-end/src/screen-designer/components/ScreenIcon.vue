<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: 'save' | 'save-as' | 'eye' | 'canvas' | 'data' | 'props' | 'style' | 'code' | 'mobile'
  size?: number
}>(), { size: 16 })

const paths = computed<{ d: string; fill?: 'none' | 'currentColor' }[]>(() => {
  switch (props.name) {
    case 'save':
      return [
        { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' },
        { d: 'M7 4v4h5V4' },
        { d: 'M17 21v-7H7v7' }
      ]
    case 'save-as':
      return [
        { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' },
        { d: 'M7 4v4h5V4' },
        { d: 'M17 21v-7H7v7' },
        { d: 'M11 9.5a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z' },
        { d: 'M6.5 12.5a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z' },
        { d: 'M6.5 17a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z' }
      ]
    case 'eye':
      return [
        { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z' },
        { d: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z' }
      ]
    case 'canvas':
      return [
        { d: 'M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-13z' },
        { d: 'M3 8.4h18M15.6 21V8.4' }
      ]
    case 'data':
      return [
        { d: 'M4 20.5h16' },
        { d: 'M7.5 20.5v-7' },
        { d: 'M12 20.5V5' },
        { d: 'M16.5 20.5v-9.5' }
      ]
    case 'props':
      return [
        { d: 'M4 7h5M13 7h7' },
        { d: 'M10.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z' },
        { d: 'M4 17h7M15 17h5' },
        { d: 'M14 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z' }
      ]
    case 'style':
      return [
        { d: 'M12 3.2A8.8 8.8 0 1 0 20.8 12c0-1.4-1-2.3-2.5-2.3H16a2 2 0 0 1-1.6-3.3A5 5 0 0 0 12 3.2z' },
        { d: 'M7.8 11.5a1 1 0 1 0 0-.01' },
        { d: 'M11.7 7.8a1 1 0 1 0 0-.01' },
        { d: 'M16 11.8a1 1 0 1 0 0-.01' }
      ]
    case 'code':
      return [
        { d: 'M8 7.5l-5 4.5 5 4.5' },
        { d: 'M16 7.5l5 4.5-5 4.5' }
      ]
    case 'mobile':
      return [
        { d: 'M6.5 3.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-17z' },
        { d: 'M10.8 18.8h2.4' }
      ]
    default:
      return []
  }
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="screen-icon"
  >
    <path v-for="(p, i) in paths" :key="i" :d="p.d" />
  </svg>
</template>

<style scoped>
.screen-icon {
  display: inline-block;
  vertical-align: -0.22em;
  flex-shrink: 0;
}
</style>