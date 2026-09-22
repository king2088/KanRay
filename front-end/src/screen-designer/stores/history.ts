import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HistoryState {
  components: any[]
  timestamp: number
}

export const useHistoryStore = defineStore('history', () => {
  const history = ref<HistoryState[]>([])
  const currentIndex = ref(-1)
  const maxHistory = 100

  const canUndo = computed(() => currentIndex.value > 0)
  const canRedo = computed(() => currentIndex.value < history.value.length - 1)

  const pushState = (components: any[]) => {
    // Remove any redo states
    if (currentIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, currentIndex.value + 1)
    }

    // Add new state
    history.value.push({
      components: JSON.parse(JSON.stringify(components)),
      timestamp: Date.now()
    })

    // Limit history size
    if (history.value.length > maxHistory) {
      history.value.shift()
    } else {
      currentIndex.value++
    }
  }

  const undo = () => {
    if (!canUndo.value) return null

    currentIndex.value--
    return JSON.parse(JSON.stringify(history.value[currentIndex.value].components))
  }

  const redo = () => {
    if (!canRedo.value) return null

    currentIndex.value++
    return JSON.parse(JSON.stringify(history.value[currentIndex.value].components))
  }

  const clearHistory = () => {
    history.value = []
    currentIndex.value = -1
  }

  return {
    history,
    currentIndex,
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    clearHistory
  }
})