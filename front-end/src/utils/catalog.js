const TREE_ICON = { schema: 'Database', table: 'Grid', field: 'Type' }
export const STRING_OPS = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '≠' }, { value: 'contains', label: '包含' },
  { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
  { value: 'in', label: '∈' },
]
export const AGG_OPTIONS = [
  { value: 'sum', label: '求和 SUM' },
  { value: 'avg', label: '平均 AVG' },
  { value: 'count', label: '计数 COUNT' },
  { value: 'count_distinct', label: '去重计数' },
  { value: 'max', label: '最大 MAX' },
  { value: 'min', label: '最小 MIN' },
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