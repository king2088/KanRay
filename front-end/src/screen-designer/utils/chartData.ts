export function rowsToChartData(rows: any[], categoryField: string, valueFields: string[]): string {
  const xAxis = (rows || []).map((r: any) => r[categoryField])
  const series = (valueFields || []).map((f: string) => ({
    name: f,
    data: (rows || []).map((r: any) => Number(r[f]) || 0),
  }))
  return JSON.stringify({ xAxis, series })
}