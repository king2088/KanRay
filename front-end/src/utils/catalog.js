const TREE_ICON = { schema: 'Database', table: 'Grid', field: 'Type' }
export const STRING_OPS = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '≠' }, { value: 'contains', labelKey: 'chart.stringOps.contains' },
  { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
  { value: 'in', label: '∈' },
]
export const AGG_OPTIONS = [
  { value: 'sum', labelKey: 'chart.aggSql.sum' },
  { value: 'avg', labelKey: 'chart.aggSql.avg' },
  { value: 'count', labelKey: 'chart.aggSql.count' },
  { value: 'count_distinct', labelKey: 'chart.aggSql.count_distinct' },
  { value: 'max', labelKey: 'chart.aggSql.max' },
  { value: 'min', labelKey: 'chart.aggSql.min' },
]
export function toTree(schemas) {
  return (schemas || []).map((s) => ({
    id: `schema:${s.schema}`,
    n: s.schema, kind: 'schema', children: (s.tables || []).map((t) => ({
      id: `${s.schema}:${t.table}`,
      n: t.table, kind: 'table', isLeaf: false,
      children: (t.columns || []).map((c) => ({
        id: `${s.schema}:${t.table}:${c.name}`,
        n: `${c.name} (${c.type})`, kind: 'field', raw: { schema: s.schema, table: t.table, name: c.name, type: c.type, role: c.role }, isLeaf: true,
      })),
    })),
  }))
}
export function allFields(schemas, tableId) {
  for (const s of schemas || []) {
    for (const t of s.tables || []) {
      if (`${s.schema}:${t.table}` === tableId) return (t.columns || []).map((c) => ({ ...c, schema: s.schema, table: t.table }))
    }
  }
  return []
}
export function schemaIdOf(prefix) { return prefix.split(':').slice(0, 2).join(':') }