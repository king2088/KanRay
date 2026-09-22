import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId } from '../utils/id'

export interface MobileConfig {
  hideOnMobile: boolean
  mobileOrder: number
  mobileX: number | null
  mobileY: number | null
  mobileWidth: number | null
  mobileHeight: number | null
}

export interface DataConfig {
  type: 'static' | 'api' | 'dataset'
  value: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: string
  body: string
  refreshInterval: number
  responsePath: string
  fieldMapping: string
  datasetId: number | null
  categoryField: string
  valueFields: string[]
}

export interface Component {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  opacity: number
  props: any
  style: any
  data: any
  animation: any
  interaction: any
  mobile: MobileConfig
  mobileLayout: { x: number; y: number; width: number; height: number } | null
}

export const useComponentsStore = defineStore('components', () => {
  const components = ref<Component[]>([])
  const selectedIds = ref<string[]>([])
  const clipboard = ref<Component[]>([])

  const selectedComponents = computed(() => {
    return components.value.filter(c => selectedIds.value.includes(c.id))
  })

  const addComponent = (component: Component) => {
    if (!component.mobileLayout) component.mobileLayout = null
    components.value.push(component)
  }

  const resetComponents = (newComponents: Component[]) => {
    components.value = newComponents.map(c => {
      if (!c.mobileLayout) c.mobileLayout = null
      return c
    })
    selectedIds.value = []
  }

  const removeComponent = (id: string) => {
    components.value = components.value.filter(c => c.id !== id)
    selectedIds.value = selectedIds.value.filter(sid => sid !== id)
  }

  const updateComponent = (id: string, updates: Partial<Component>) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      components.value[index] = { ...components.value[index], ...updates }
    }
  }

  const selectComponent = (id: string, multi = false) => {
    if (multi) {
      if (selectedIds.value.includes(id)) {
        selectedIds.value = selectedIds.value.filter(sid => sid !== id)
      } else {
        selectedIds.value.push(id)
      }
    } else {
      selectedIds.value = [id]
    }
  }

  const clearSelection = () => {
    selectedIds.value = []
  }

  const selectAll = () => {
    selectedIds.value = components.value.map(c => c.id)
  }

  const moveComponent = (id: string, x: number, y: number) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      components.value[index].x = x
      components.value[index].y = y
    }
  }

  const resizeComponent = (id: string, width: number, height: number) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      components.value[index].width = width
      components.value[index].height = height
    }
  }

  const bringToFront = (id: string) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const maxZ = Math.max(...components.value.map(c => c.zIndex))
      components.value[index].zIndex = maxZ + 1
    }
  }

  const sendToBack = (id: string) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const minZ = Math.min(...components.value.map(c => c.zIndex))
      components.value[index].zIndex = minZ - 1
    }
  }

  const moveUp = (id: string) => {
    const sorted = [...components.value].sort((a, b) => a.zIndex - b.zIndex)
    const idx = sorted.findIndex(c => c.id === id)
    if (idx < sorted.length - 1) {
      const above = sorted[idx + 1]
      const cur = sorted[idx]
      const tempZ = cur.zIndex
      cur.zIndex = above.zIndex
      above.zIndex = tempZ
    }
  }

  const moveDown = (id: string) => {
    const sorted = [...components.value].sort((a, b) => a.zIndex - b.zIndex)
    const idx = sorted.findIndex(c => c.id === id)
    if (idx > 0) {
      const below = sorted[idx - 1]
      const cur = sorted[idx]
      const tempZ = cur.zIndex
      cur.zIndex = below.zIndex
      below.zIndex = tempZ
    }
  }

  const lockComponent = (id: string) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      components.value[index].locked = !components.value[index].locked
    }
  }

  const hideComponent = (id: string) => {
    const index = components.value.findIndex(c => c.id === id)
    if (index !== -1) {
      components.value[index].visible = !components.value[index].visible
    }
  }

  const copyComponents = () => {
    clipboard.value = selectedIds.value.map(id => {
      const c = components.value.find(comp => comp.id === id)
      return c ? JSON.parse(JSON.stringify(c)) : null
    }).filter(Boolean) as Component[]
  }

  const cutComponents = () => {
    copyComponents()
    const toRemove = [...selectedIds.value]
    toRemove.forEach(id => removeComponent(id))
  }

  const pasteComponents = () => {
    if (clipboard.value.length === 0) return
    const newIds: string[] = []
    clipboard.value.forEach(c => {
      const newComp = JSON.parse(JSON.stringify(c))
      newComp.id = generateId()
      newComp.x += 20
      newComp.y += 20
      addComponent(newComp)
      newIds.push(newComp.id)
    })
    selectedIds.value = newIds
  }

  const deleteSelected = () => {
    const toRemove = [...selectedIds.value]
    toRemove.forEach(id => removeComponent(id))
  }

  return {
    components,
    selectedIds,
    selectedComponents,
    clipboard,
    addComponent,
    resetComponents,
    removeComponent,
    updateComponent,
    selectComponent,
    clearSelection,
    selectAll,
    moveComponent,
    resizeComponent,
    bringToFront,
    sendToBack,
    moveUp,
    moveDown,
    lockComponent,
    hideComponent,
    copyComponents,
    cutComponents,
    pasteComponents,
    deleteSelected
  }
})