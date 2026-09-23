import { ref, watch } from 'vue'
import { useComponentsStore } from '../stores/components'
import { datasetApi } from '@/api'
import { rowsToChartData, queryRowsToChartData, buildQueryPayload } from '../utils/chartData'

interface FetchedData {
  [componentId: string]: any
}

const fetchedData = ref<FetchedData>({})
const timers: { [componentId: string]: ReturnType<typeof setInterval> } = {}

function parseJSON(str: string): any {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

function applyFieldMapping(data: any, mapping: string): any {
  if (!mapping) return data
  const map = parseJSON(mapping)
  if (!map || typeof map !== 'object') return data

  if (Array.isArray(data)) {
    return data.map(item => {
      const mapped: any = {}
      for (const [from, to] of Object.entries(map)) {
        mapped[to as string] = item[from]
      }
      return mapped
    })
  }

  const mapped: any = {}
  for (const [from, to] of Object.entries(map)) {
    mapped[to as string] = data[from]
  }
  return mapped
}

async function fetchDatasetData(comp: any): Promise<void> {
  const cfg = comp.data
  if (!cfg.datasetId) return
  try {
    let value: string
    if (cfg.query && cfg.query.metrics?.length) {
      const res = await datasetApi.query(cfg.datasetId, buildQueryPayload(cfg.query), { silent: true })
      value = queryRowsToChartData(res)
    } else {
      const page = await datasetApi.rows(cfg.datasetId, 1, 1000)
      const rows = page?.rows || []
      value = rowsToChartData(rows, cfg.categoryField, cfg.valueFields)
    }
    fetchedData.value[comp.id] = { value }
  } catch (err) {
    console.error(`[DataFetch] ${comp.name}:`, err)
    fetchedData.value[comp.id] = null
  }
}

async function fetchComponentData(comp: any): Promise<void> {
  if (!comp.data) return
  if (comp.data.type === 'dataset') {
    await fetchDatasetData(comp)
    return
  }
  if (comp.data.type !== 'api' || !comp.data.url) return

  try {
    const headers: Record<string, string> = {}
    if (comp.data.headers) {
      const parsed = parseJSON(comp.data.headers)
      if (parsed) Object.assign(headers, parsed)
    }

    const fetchOptions: RequestInit = {
      method: comp.data.method || 'GET',
      headers
    }

    if (comp.data.method && comp.data.method !== 'GET' && comp.data.body) {
      // 如果没有设置Content-Type且body是JSON字符串，自动添加
      if (!headers['Content-Type'] && !headers['content-type']) {
        try {
          JSON.parse(comp.data.body)
          headers['Content-Type'] = 'application/json'
        } catch {
          // body不是JSON，不自动设置Content-Type
        }
      }
      fetchOptions.body = comp.data.body
    }

    const response = await fetch(comp.data.url, fetchOptions)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    let result = await response.json()

    if (comp.data.responsePath) {
      result = getNestedValue(result, comp.data.responsePath)
    }

    if (comp.data.fieldMapping) {
      result = applyFieldMapping(result, comp.data.fieldMapping)
    }

    fetchedData.value[comp.id] = result
  } catch (err) {
    console.error(`[DataFetch] ${comp.name}:`, err)
    fetchedData.value[comp.id] = null
  }
}

export function useDataFetch() {
  const componentsStore = useComponentsStore()

  function startFetch(comp: any) {
    if (comp.data?.type !== 'api' && comp.data?.type !== 'dataset') return
    fetchComponentData(comp)

    if (comp.data.refreshInterval > 0) {
      stopFetch(comp.id)
      timers[comp.id] = setInterval(() => fetchComponentData(comp), comp.data.refreshInterval * 1000)
    }
  }

  function stopFetch(id: string) {
    if (timers[id]) {
      clearInterval(timers[id])
      delete timers[id]
    }
  }

  function startAllFetches() {
    componentsStore.components.forEach(comp => {
      if (comp.data?.type === 'api' || comp.data?.type === 'dataset') startFetch(comp)
    })
  }

  function stopAllFetches() {
    Object.keys(timers).forEach(stopFetch)
  }

  function getData(compId: string): any {
    return fetchedData.value[compId] ?? null
  }

  function refreshComponent(compId: string) {
    const comp = componentsStore.components.find(c => c.id === compId)
    if (comp && (comp.data?.type === 'api' || comp.data?.type === 'dataset')) {
      fetchComponentData(comp)
    }
  }

  watch(
    () => componentsStore.components.map(c => ({ id: c.id, url: c.data?.url, type: c.data?.type, method: c.data?.method, body: c.data?.body, refreshInterval: c.data?.refreshInterval, datasetId: c.data?.datasetId, categoryField: c.data?.categoryField, valueFields: c.data?.valueFields, query: c.data?.query })),
    (newList, oldList) => {
      const oldMap = new Map((oldList || []).map((c: any) => [c.id, c]))
      newList.forEach(comp => {
        const old = oldMap.get(comp.id)
        if (comp.type === 'api' || comp.type === 'dataset') {
          if (!old || JSON.stringify(old) !== JSON.stringify(comp)) {
            startFetch(componentsStore.components.find(c => c.id === comp.id)!)
          }
        } else {
          stopFetch(comp.id)
        }
      })
      ;(oldList || []).forEach((old: any) => {
        if (!newList.find(n => n.id === old.id)) {
          stopFetch(old.id)
        }
      })
    },
    { deep: true }
  )

  return {
    fetchedData,
    getData,
    startFetch,
    stopFetch,
    startAllFetches,
    stopAllFetches,
    refreshComponent
  }
}
