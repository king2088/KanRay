<script setup lang="ts">
import { ref } from 'vue'
import './config-common.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ component: any }>()
const emit = defineEmits<{ (e: 'updateProps', key: string, value: any): void }>()

const carouselUploadRef = ref<HTMLInputElement>()

function triggerCarouselUpload() { carouselUploadRef.value?.click() }

function handleCarouselUpload(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  if (!files.length) return
  const existing = props.component.props.images || []
  const readers = files.map(f => new Promise<string>(resolve => {
    const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(f)
  }))
  Promise.all(readers).then(results => { emit('updateProps', 'images', [...existing, ...results]) })
  ;(e.target as HTMLInputElement).value = ''
}

function removeCarouselImage(idx: number) {
  const images = [...(props.component.props.images || [])]
  images.splice(idx, 1)
  emit('updateProps', 'images', images)
}
</script>

<template>
  <div class="rc-section">
    <div class="rc-section-title">{{ t('bigscreen.config.carousel.title') }}</div>
    <el-form label-width="70px" size="default">
      <el-form-item :label="t('bigscreen.config.carousel.imageList')">
        <div class="rc-carousel-images">
          <div v-for="(img, idx) in (component.props.images || [])" :key="idx" class="rc-carousel-img-item">
            <img :src="img" />
            <el-icon class="rc-delete-img" @click="removeCarouselImage(idx as number)"><Delete /></el-icon>
          </div>
          <div class="rc-add-img-btn" @click="triggerCarouselUpload">
            <el-icon :size="20"><Plus /></el-icon>
            <span>{{ t('bigscreen.config.action.add') }}</span>
          </div>
        </div>
        <input ref="carouselUploadRef" type="file" accept="image/*" multiple class="rc-hidden-input" @change="handleCarouselUpload" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.carousel.interval')">
        <el-input-number :model-value="component.props.interval ?? 3000" @update:model-value="emit('updateProps', 'interval', $event)" :min="1000" :max="10000" :step="500" controls-position="right" class="rc-w100" />
      </el-form-item>
      <el-form-item :label="t('bigscreen.config.common.fillMode')">
        <el-select :model-value="component.props.objectFit || 'cover'" @update:model-value="emit('updateProps', 'objectFit', $event)" class="rc-w100">
          <el-option :label="t('bigscreen.config.common.cover')" value="cover" />
          <el-option :label="t('bigscreen.config.common.contain')" value="contain" />
          <el-option :label="t('bigscreen.config.common.stretch')" value="fill" />
          <el-option :label="t('bigscreen.config.common.none')" value="none" />
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>