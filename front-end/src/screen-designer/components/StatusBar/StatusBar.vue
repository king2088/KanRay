<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useComponentsStore } from '../../stores/components'

const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()

const componentCount = computed(() => componentsStore.components.length)
const showShortcuts = ref(false)

const shortcuts = [
  { keys: ['Ctrl', 'Z'], desc: '撤销', mac: '⌘ Z' },
  { keys: ['Ctrl', 'Shift', 'Z'], desc: '重做', mac: '⌘ ⇧ Z' },
  { keys: ['Ctrl', 'C'], desc: '复制', mac: '⌘ C' },
  { keys: ['Ctrl', 'X'], desc: '剪切', mac: '⌘ X' },
  { keys: ['Ctrl', 'V'], desc: '粘贴', mac: '⌘ V' },
  { keys: ['Ctrl', 'D'], desc: '复制并粘贴', mac: '⌘ D' },
  { keys: ['Ctrl', 'A'], desc: '全选', mac: '⌘ A' },
  { keys: ['Delete'], desc: '删除选中', mac: '⌫' },
  { keys: ['Escape'], desc: '取消选中', mac: 'ESC' },
  { keys: ['↑','↓','←','→'], desc: '微调位置 (1px)', mac: '方向键' },
  { keys: ['Ctrl', '↑','↓','←','→'], desc: '微调位置 (10px)', mac: '⌘ + 方向键' },
  { keys: ['Ctrl', 'L'], desc: '锁定/解锁', mac: '⌘ L' },
  { keys: ['Ctrl', 'H'], desc: '显示/隐藏', mac: '⌘ H' },
  { keys: ['Ctrl', 'S'], desc: '保存', mac: '⌘ S' },
  { keys: ['Ctrl', '0'], desc: '重置画布大小', mac: '⌘ 0' },
  { keys: ['Ctrl', '+'], desc: '放大', mac: '⌘ +' },
  { keys: ['Ctrl', '-'], desc: '缩小', mac: '⌘ -' },
  { keys: ['Tab'], desc: '切换选中组件', mac: 'Tab' }
]
</script>

<template>
  <div class="status-bar">
    <div class="left">
      <span>缩放: {{ canvasStore.actualZoom }}%</span>
      <span>画布: {{ canvasStore.config.width }} × {{ canvasStore.config.height }}</span>
      <span>组件数: {{ componentCount }}</span>
    </div>
    <div class="right">
      <el-button size="default" text @click="showShortcuts = true" style="font-size: 12px; height: 24px; padding: 0 8px;">快捷键</el-button>
      <span>已选择: {{ componentsStore.selectedIds.length }} 个组件</span>
    </div>
  </div>

  <el-dialog v-model="showShortcuts" title="快捷键列表" width="520px" :append-to-body="true" class="shortcuts-dialog">
    <div style="max-height: 400px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #eee;">
            <th style="text-align: left; padding: 8px 12px; color: #999;">功能</th>
            <th style="text-align: left; padding: 8px 12px; color: #999;">Windows</th>
            <th style="text-align: left; padding: 8px 12px; color: #999;">Mac</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in shortcuts" :key="i" style="border-bottom: 1px solid #f5f5f5;">
            <td style="padding: 6px 12px;">{{ s.desc }}</td>
            <td style="padding: 6px 12px;">
              <el-tag v-for="(k, ki) in s.keys" :key="ki" size="small" style="margin-right: 4px;" type="info">{{ k }}</el-tag>
            </td>
            <td style="padding: 6px 12px; color: #666;">{{ s.mac }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </el-dialog>
</template>

<style scoped>
.status-bar {
  height: 30px;
  background: var(--scr-surface);
  border-top: 1px solid var(--scr-border-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  font-size: 12px;
  color: var(--scr-text-2);
}

.left, .right {
  display: flex;
  gap: 20px;
  align-items: center;
}
</style>
