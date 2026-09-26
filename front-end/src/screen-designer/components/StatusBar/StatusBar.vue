<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCanvasStore } from '../../stores/canvas'
import { useComponentsStore } from '../../stores/components'

const { t } = useI18n()

const canvasStore = useCanvasStore()
const componentsStore = useComponentsStore()

const componentCount = computed(() => componentsStore.components.length)
const showShortcuts = ref(false)

const shortcuts = [
  { keys: ['Ctrl', 'Z'], descKey: 'bigscreen.shortcuts.undo', mac: '⌘ Z' },
  { keys: ['Ctrl', 'Shift', 'Z'], descKey: 'bigscreen.shortcuts.redo', mac: '⌘ ⇧ Z' },
  { keys: ['Ctrl', 'C'], descKey: 'bigscreen.shortcuts.copy', mac: '⌘ C' },
  { keys: ['Ctrl', 'X'], descKey: 'bigscreen.shortcuts.cut', mac: '⌘ X' },
  { keys: ['Ctrl', 'V'], descKey: 'bigscreen.shortcuts.paste', mac: '⌘ V' },
  { keys: ['Ctrl', 'D'], descKey: 'bigscreen.shortcuts.copyPaste', mac: '⌘ D' },
  { keys: ['Ctrl', 'A'], descKey: 'bigscreen.shortcuts.selectAll', mac: '⌘ A' },
  { keys: ['Delete'], descKey: 'bigscreen.shortcuts.deleteSelected', mac: '⌫' },
  { keys: ['Escape'], descKey: 'bigscreen.shortcuts.deselect', mac: 'ESC' },
  { keys: ['↑','↓','←','→'], descKey: 'bigscreen.shortcuts.nudge1', mac: 'Arrow keys' },
  { keys: ['Ctrl', '↑','↓','←','→'], descKey: 'bigscreen.shortcuts.nudge10', mac: '⌘ + Arrow keys' },
  { keys: ['Ctrl', 'L'], descKey: 'bigscreen.shortcuts.lockToggle', mac: '⌘ L' },
  { keys: ['Ctrl', 'H'], descKey: 'bigscreen.shortcuts.visibilityToggle', mac: '⌘ H' },
  { keys: ['Ctrl', 'S'], descKey: 'bigscreen.shortcuts.save', mac: '⌘ S' },
  { keys: ['Ctrl', '0'], descKey: 'bigscreen.shortcuts.resetCanvas', mac: '⌘ 0' },
  { keys: ['Ctrl', '+'], descKey: 'bigscreen.shortcuts.zoomIn', mac: '⌘ +' },
  { keys: ['Ctrl', '-'], descKey: 'bigscreen.shortcuts.zoomOut', mac: '⌘ -' },
  { keys: ['Tab'], descKey: 'bigscreen.shortcuts.cycleSelection', mac: 'Tab' }
]
</script>

<template>
  <div class="status-bar">
    <div class="left">
      <span>{{ t('bigscreen.statusBar.zoom', { value: canvasStore.actualZoom }) }}</span>
      <span>{{ t('bigscreen.statusBar.canvasSize', { width: canvasStore.config.width, height: canvasStore.config.height }) }}</span>
      <span>{{ t('bigscreen.statusBar.componentCount', { count: componentCount }) }}</span>
    </div>
    <div class="right">
      <el-button size="default" text @click="showShortcuts = true" style="font-size: 12px; height: 24px; padding: 0 8px;">{{ t('bigscreen.statusBar.shortcuts') }}</el-button>
      <span>{{ t('bigscreen.statusBar.selected', { count: componentsStore.selectedIds.length }) }}</span>
    </div>
  </div>

  <el-dialog v-model="showShortcuts" :title="t('bigscreen.statusBar.shortcutsTitle')" width="520px" :append-to-body="true" class="shortcuts-dialog">
    <div style="max-height: 400px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #eee;">
            <th style="text-align: left; padding: 8px 12px; color: #999;">{{ t('bigscreen.statusBar.colFunction') }}</th>
            <th style="text-align: left; padding: 8px 12px; color: #999;">{{ t('bigscreen.statusBar.colWindows') }}</th>
            <th style="text-align: left; padding: 8px 12px; color: #999;">{{ t('bigscreen.statusBar.colMac') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in shortcuts" :key="i" style="border-bottom: 1px solid #f5f5f5;">
            <td style="padding: 6px 12px;">{{ t(s.descKey) }}</td>
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
