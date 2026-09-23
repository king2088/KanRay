export function rowsToChartData(rows: any[], categoryField: string, valueFields: string[]): string {
  const xAxis = (rows || []).map((r: any) => r[categoryField])
  const series = (valueFields || []).map((f: string) => ({
    name: f,
    data: (rows || []).map((r: any) => Number(r[f]) || 0),
  }))
  return JSON.stringify({ xAxis, series })
}

// 转换后端聚合查询结果（{dimensions, metrics, rows}）为 widget 可消费的 {xAxis, series}
export function queryRowsToChartData(res: any): string {
  const dims: any[] = res?.dimensions || []
  const metrics: any[] = res?.metrics || []
  const rows: any[] = res?.rows || []
  const dimKeys = dims.map((d: any) => `dim:${d.field}`)
  const xAxis = rows.map((row: any) =>
    dimKeys.map((k: string) => row?.[k]?.value ?? '').join(' | ')
  )
  const series = metrics.map((m: any) => ({
    name: m.label || m.field || m.key || '',
    data: rows.map((row: any) => {
      const v = row?.[`metric:${m.key}`]?.value
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }),
  }))
  return JSON.stringify({ xAxis, series })
}

// 组件内 query 配置 → 后端 /datasets/:id/query 请求体
export function buildQueryPayload(query: any): any {
  const payload: any = {
    dimensions: (query?.dimensions || [])
      .filter((d: any) => d && d.field)
      .map((d: any) => ({ field: d.field, granularity: d.granularity || undefined })),
    metrics: (query?.metrics || [])
      .filter((m: any) => m && m.field && m.agg)
      .map((m: any) => ({ type: 'base', key: m.key, field: m.field, agg: m.agg })),
    groupLimit: query?.groupLimit || undefined,
    sortBy: query?.sortBy === 0 ? 0 : query?.sortBy === 'dim' ? 'dim' : undefined,
    sortOrder: query?.sortOrder === 'asc' || query?.sortOrder === 'desc' ? query.sortOrder : undefined,
  }
  return payload
}