const db = require('../db');
const HttpError = require('../utils/http-error');
const { getDatasetOrThrow } = require('../services/dataset.service');

const CHART_TYPES = [
  // 柱形图
  'bar', 'barClustered', 'barStacked', 'barLine', 'barPictorial',
  'barPercentStacked', 'barGroupStacked', 'barStackedLine', 'barStackedPictorial',
  'bullet', 'waterfall', 'pareto',
  // 条形图
  'horizontalBar', 'horizontalBarClustered', 'horizontalBarStacked',
  'horizontalBarPercentStacked', 'horizontalBarGroupStacked', 'horizontalBullet', 'butterfly',
  // 折线图与面积图
  'line', 'lineMulti', 'areaStacked', 'areaPercentStacked',
  // 饼图与漏斗图
  'pie', 'doughnut', 'sunburst', 'nightingale', 'funnel', 'funnelHorizontal',
  // 散点图与气泡图
  'scatter', 'bubble',
  // 指标与进度
  'stat', 'progressBar', 'circularProgress', 'multiRingProgress', 'fluidProgress', 'gauge', 'statTrend',
  // 地图
  'mapChina', 'mapChinaBubble', 'mapChinaSymbol', 'mapWorld',
  // 表格
  'table',
  // 其他
  'heatmap', 'boxplot', 'radar', 'polarBar', 'barBreakAxis', 'calendar',
  'candlestick', 'treemap', 'sankey', 'chord',
];

const SELECT_SQL = `
  SELECT c.id, c.name, c.chart_type AS chartType, c.dataset_id AS datasetId, d.name AS datasetName,
         c.config, c.created_at AS createdAt, c.updated_at AS updatedAt
  FROM charts c LEFT JOIN datasets d ON d.id = c.dataset_id
`

/** 查询条件：keyword(名称/数据源模糊)、datasetId、ids 白名单、excludeIds 排除、limit/offset */
function buildWhere(opts = {}) {
  const where = []
  const params = []
  const kw = String(opts.keyword || '').trim()
  if (kw) {
    const escaped = kw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    const like = `%${escaped}%`
    where.push(`(c.name LIKE ? ESCAPE '\\' OR d.name LIKE ? ESCAPE '\\')`)
    params.push(like, like)
  }
  const dsId = Number(opts.datasetId)
  if (Number.isFinite(dsId) && dsId > 0) {
    where.push('c.dataset_id = ?')
    params.push(dsId)
  }
  const idList = (opts.ids || []).map(Number).filter(Number.isFinite)
  if (idList.length) {
    where.push(`c.id IN (${idList.map(() => '?').join(',')})`)
    params.push(...idList)
  }
  const excludeList = (opts.excludeIds || []).map(Number).filter(Number.isFinite)
  if (excludeList.length) {
    where.push(`c.id NOT IN (${excludeList.map(() => '?').join(',')})`)
    params.push(...excludeList)
  }
  const scope = String(opts.scope || '').trim()
  if (scope) {
    where.push(`(${scope})`)
  }
  return { whereSql: where.length ? ` WHERE ${where.join(' AND ')}` : '', params }
}

async function listCharts(opts = {}) {
  const { whereSql, params } = buildWhere(opts)
  let { limit, offset } = opts
  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
  const hasOffset = Number.isFinite(Number(offset)) && Number(offset) >= 0
  let limitSql = ''
  if (hasLimit) {
    limitSql = ` LIMIT ?${hasOffset ? ' OFFSET ?' : ''}`
    params.push(Number(limit))
    if (hasOffset) params.push(Number(offset))
  }
  return (await db
    .prepare(`${SELECT_SQL}${whereSql} ORDER BY c.updated_at DESC, c.id DESC${limitSql}`)
    .all(...params))
    .map((r) => ({ ...r, config: JSON.parse(r.config) }));
}

async function countCharts(opts = {}) {
  const { whereSql, params } = buildWhere(opts)
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM charts c LEFT JOIN datasets d ON d.id = c.dataset_id${whereSql}`)
    .get(...params);
  return Number(row?.n || 0);
}

async function getChart(id) {
  const c = await db
    .prepare(`
      SELECT c.id, c.name, c.chart_type AS chartType, c.dataset_id AS datasetId, d.name AS datasetName,
             c.config, c.created_at AS createdAt, c.updated_at AS updatedAt
      FROM charts c LEFT JOIN datasets d ON d.id = c.dataset_id
      WHERE c.id = ?
    `)
    .get(id);
  if (!c) return null;
  return { ...c, config: JSON.parse(c.config) };
}

async function getChartOrThrow(id) {
  const c = await getChart(id);
  if (!c) throw new HttpError(404, `图表不存在: id=${id}`);
  return c;
}

async function validateChartPayload(body) {
  const chartType = body.chartType;
  if (!CHART_TYPES.includes(chartType)) throw new HttpError(400, `不支持的图表类型: ${chartType}`);
  if (!body.name || !String(body.name).trim()) throw new HttpError(400, '图表名称不能为空');
  const datasetId = Number(body.datasetId);
  if (!Number.isInteger(datasetId)) throw new HttpError(400, '数据集 ID 无效');
  await getDatasetOrThrow(datasetId); // 校验存在

  const config = body.config || {};
  if (!Array.isArray(config.metrics) || config.metrics.length === 0) {
    throw new HttpError(400, '图表至少需要一个指标');
  }
  return {
    name: String(body.name).trim().slice(0, 100),
    chartType,
    datasetId,
    config,
  };
}

async function createChart(body, ownerId = null) {
  const c = await validateChartPayload(body);
  const info = await db
    .prepare('INSERT INTO charts (name, dataset_id, chart_type, config, owner_id) VALUES (?, ?, ?, ?, ?)')
    .run(c.name, c.datasetId, c.chartType, JSON.stringify(c.config), ownerId == null ? null : Number(ownerId));
  return getChart(Number(info.lastInsertRowid));
}

async function updateChart(id, body) {
  const existing = await getChartOrThrow(id);
  const c = await validateChartPayload(body);
  await db.prepare('UPDATE charts SET name = ?, dataset_id = ?, chart_type = ?, config = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(c.name, c.datasetId, c.chartType, JSON.stringify(c.config), id);
  return getChart(id);
}

async function deleteChart(id) {
  await getChartOrThrow(id);
  await db.prepare('DELETE FROM charts WHERE id = ?').run(id);
  return true;
}

module.exports = {
  CHART_TYPES,
  listCharts,
  countCharts,
  getChart,
  getChartOrThrow,
  validateChartPayload,
  createChart,
  updateChart,
  deleteChart,
};