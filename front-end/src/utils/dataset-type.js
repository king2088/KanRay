// 纯模块：走 tr 并用相对路径引入，保证 node 测试脚本可直接 import。
import { tr } from '../i18n/translate.js'

const DB_TYPE_LABELS = { sqlserver: 'MSSQL' }

export function datasetTypeLabel(dataset) {
  if (!dataset || !dataset.source_type) return ''
  if (dataset.source_type === 'form') return tr('dataset.type.form')
  if (dataset.source_type === 'sql') {
    const t = String(dataset.db_type || '').toLowerCase()
    if (!t) return 'SQL'
    return DB_TYPE_LABELS[t] || t.toUpperCase()
  }
  if (dataset.source_type === 'excel') return 'Excel'
  return String(dataset.source_type).toUpperCase()
}

export function toDatasetOptions(datasets, { withRowCount = false } = {}) {
  return (datasets || []).map((d) => {
    const type = datasetTypeLabel(d)
    const name = withRowCount ? `${d.name} ${tr('dataset.rowCount', { count: d.row_count || 0 })}` : d.name
    return { value: d.id, label: type ? `${name} - ${type}` : name, name, type }
  })
}