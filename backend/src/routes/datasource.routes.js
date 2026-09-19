const express = require('express');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const datasourceService = require('../services/datasource.service');
const datasetService = require('../services/dataset.service');
const syncService = require('../services/sync.service');
const drivers = require('../datasources/drivers');
const db = require('../db');
const { parsePageQuery, paginate } = require('../utils/pagination');
const dialects = require('../datasources/dialects');
const providers = require('../datasources/providers');
const buildSql = require('../datasources/build-sql');
const { decryptConfig, getDriverMeta } = datasourceService;

const router = express.Router();

// GET /api/datasources/drivers —— 22 种驱动元数据
router.get('/drivers', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  ok(res, drivers.map((d) => ({
    type: d.type, name: d.name, category: d.category,
    status: d.status, capabilities: d.capabilities,
    defaultPort: d.defaultPort, fields: d.fields,
  })));
});

// GET /api/datasources —— 列表（owner 隔离：admin 全量，否则仅自己）
// 可选 page/pageSize -> {list,total}，否则返回全量数组（向后兼容）
router.get('/', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const items = await datasourceService.list(await access.scopedWhere('datasource', req.user, rbac));
  const page = parsePageQuery(req.query);
  ok(res, page ? paginate(items, page.page, page.pageSize) : items);
});

// POST /api/datasources/test —— 测试未保存配置
router.post('/test', requireUser, requirePermission('datasource', 'create'), async (req, res) => {
  const { type, config } = req.body || {};
  if (!type) throw new HttpError(400, '缺少数据源类型');
  const result = await datasourceService.testConfig({ type, config });
  ok(res, result);
});

// POST /api/datasources —— 创建
router.post('/', requireUser, requirePermission('datasource', 'create'), async (req, res) => {
  const { name, type, config, mode } = req.body || {};
  if (!name || !String(name).trim()) throw new HttpError(400, '数据源名称不能为空');
  if (!type) throw new HttpError(400, '缺少数据源类型');
  const ds = await datasourceService.create({ name, type, config, mode }, req.user.id, req);
  ok(res, ds, '数据源创建成功');
});

// GET /api/datasources/:id
router.get('/:id', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const ds = await datasourceService.get(id);
  if (!ds) throw new HttpError(404, '数据源不存在');
  ok(res, ds);
});

// PATCH /api/datasources/:id —— 更新（含启停）
router.patch('/:id', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const ds = await datasourceService.update(id, req.body || {}, req);
  ok(res, ds, '更新成功');
});

// DELETE /api/datasources/:id
router.delete('/:id', requireUser, requirePermission('datasource', 'delete'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  await datasourceService.remove(id, req);
  ok(res, true, '删除成功');
});

// POST /api/datasources/:id/test —— 测试已保存并回写结果
router.post('/:id/test', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const result = await datasourceService.testSaved(id, req);
  ok(res, result);
});

// GET /api/datasources/:id/schemas
router.get('/:id/schemas', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  ok(res, await datasourceService.listSchemas(id, req, { source: req.query.source === '1' }));
});

// GET /api/datasources/:id/schemas/:schema/tables
router.get('/:id/schemas/:schema/tables', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  ok(res, await datasourceService.listTables(id, req.params.schema, req, { source: req.query.source === '1' }));
});

// GET /api/datasources/:id/schemas/:schema/tables/:table/columns
router.get('/:id/schemas/:schema/tables/:table/columns', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  ok(res, await datasourceService.listColumns(id, req.params.schema, req.params.table, req, { source: req.query.source === '1' }));
});

// GET /api/datasources/:id/schemas/:schema/tables/:table/rows —— 数据表预览
router.get('/:id/schemas/:schema/tables/:table/rows', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '50', 10)));
  ok(res, await datasourceService.paginateRows(id, req.params.schema, req.params.table, { source: req.query.source === '1' }, page, pageSize));
});

// POST /api/datasources/:id/register-table —— 注册外部表为 SQL 数据集
router.post('/:id/register-table', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const { schema, table, name } = req.body || {};
  if (!table) throw new HttpError(400, '缺少表名');
  const columns = await datasourceService.listColumns(id, schema, table, req);
  const ds = await datasetService.registerSqlDataset(
    name || table, id, schema, table,
    columns.map((c) => ({ name: c.name, label: c.name, type: c.role === 'metric' ? 'number' : 'string' })),
    req.user.id
  );
  ok(res, ds, '数据集创建成功');
});

// ─── 同步配置与手动触发 ─────────────────────────────────────────
// GET /api/datasources/:id/sync-configs —— 某数据源的同步配置列表
router.get('/:id/sync-configs', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  ok(res, await syncService.configsOf(id));
});

// POST /api/datasources/:id/sync-configs —— 创建同步配置并触发首同步
router.post('/:id/sync-configs', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const cfg = await syncService.createConfig(id, req.body || {}, req);
  if (req.body?.runNow !== false) {
    syncService.trigger(cfg.id, 'startup').catch((e) => console.error(`[sync] cfg ${cfg.id} 首同步触发失败:`, e.message));
  }
  ok(res, cfg, '同步配置已创建，首同步已触发');
});

// PATCH /api/datasources/:id/sync-configs/:cid —— 修改同步配置
router.patch('/:id/sync-configs/:cid', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  ok(res, await syncService.updateConfig(Number(req.params.cid), req.body || {}));
});

// DELETE /api/datasources/:id/sync-configs/:cid —— 删除同步配置
router.delete('/:id/sync-configs/:cid', requireUser, requirePermission('datasource', 'delete'), async (req, res) => {
  await syncService.deleteConfig(Number(req.params.cid));
  ok(res, true, '同步配置已删除');
});

// POST /api/datasources/:id/sync-configs/:cid/run —— 手动立即同步
router.post('/:id/sync-configs/:cid/run', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const result = await syncService.trigger(Number(req.params.cid), 'manual');
  ok(res, result, result.queued ? '已加入同步队列' : '同步执行完成');
});

// GET /api/datasources/:id/sync-configs/:cid/logs —— 同步日志
router.get('/:id/sync-configs/:cid/logs', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  ok(res, await syncService.logsOf(Number(req.params.cid)));
});

// M3 构建：运行时加载（raw 行 + 明文配置 + 方言 + provider）
async function loadRuntime(id) {
  const raw = await db.prepare('SELECT type, is_active, config FROM data_sources WHERE id = ?').get(id);
  if (!raw) throw new HttpError(404, '数据源不存在');
  if (!raw.is_active) throw new HttpError(400, '数据源已停用');
  const driverMeta = getDriverMeta(raw.type);
  const dialect = dialects[driverMeta.family];
  if (!dialect) throw new HttpError(500, `未知方言: ${driverMeta.family}`);
  const cfg = decryptConfig(JSON.parse(raw.config));
  const provider = providers.getProvider(driverMeta.family);
  if (!provider || typeof provider.runQuery !== 'function') throw new HttpError(400, '该数据源不支持查询');
  return { dialect, cfg, provider };
}

// ETL 链涉及的全部物理表
function collectEtlTables(nodes) {
  const tables = [];
  for (const n of nodes || []) {
    if (n.nodeType === 'source') tables.push({ schema: n.schema || null, table: n.table });
    else if (n.nodeType === 'join' && n.to) tables.push({ schema: n.to.schema || null, table: n.to.table });
  }
  return tables;
}

// 引用表元数据是否全部解析（部分缺失时不做字段回填，避免字段集不完整）
function catalogKeyed(catalog) {
  const keyed = {};
  for (const t of catalog || []) keyed[`${t.schema}.${t.table}`] = t;
  return keyed;
}

// 引用的物理表是否全部解析出元数据列
function catalogResolved(keyed, tables) {
  for (const t of tables || []) {
    const meta = keyed[`${t.schema}.${t.table}`];
    if (!meta || !meta.columns || !meta.columns.length) return false;
  }
  return true;
}

// builder 字段缺失时按目录推导默认字段集；任一引用表元数据缺失则整体不回填
function deriveBuilderFields(definition, catalog) {
  const keyed = catalogKeyed(catalog);
  const refs = (definition.tables || []).map((t, i) => ({ alias: t.alias || `t${i}`, schema: t.schema || null, table: t.table }));
  (definition.joins || []).forEach((j) => {
    if (j.to && j.to.alias) refs.push({ alias: j.to.alias, schema: j.to.schema || null, table: j.to.table });
  });
  for (const ref of refs) {
    const meta = keyed[`${ref.schema}.${ref.table}`];
    if (!meta || !meta.columns || !meta.columns.length) return [];
  }
  const fields = [];
  for (const ref of refs) {
    const meta = keyed[`${ref.schema}.${ref.table}`];
    for (const c of meta.columns) {
      fields.push({ source: ref.alias, field: c.name, label: `${ref.alias}.${c.name}`, type: buildSql.guessType(c.type) });
    }
  }
  return fields;
}

// 汇总定义涉及的表元数据；元数据缺失时降级为空列集（编译仍可产出）
async function resolveBuildContext(id, req, tables) {
  const catalog = [];
  for (const t of tables || []) {
    if (!t || !t.table) continue;
    try {
      const columns = await datasourceService.listColumns(id, t.schema || null, t.table, req);
      catalog.push({ schema: t.schema || null, table: t.table, columns });
    } catch (e) {
      catalog.push({ schema: t.schema || null, table: t.table, columns: [] });
    }
  }
  return catalog;
}

// GET /api/datasources/:id/sql-assist —— 构建器元数据树
router.get('/:id/sql-assist', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const schemas = await datasourceService.listSchemas(id, req);
  const trees = [];
  for (const s of schemas) {
    const schema = s.name;
    const tables = await datasourceService.listTables(id, schema, req);
    const entries = [];
    for (const t of tables.slice(0, 500)) {
      const columns = await datasourceService.listColumns(id, schema, t.name, req);
      entries.push({ schema, table: t.name, type: t.type, columns });
    }
    trees.push({ schema, tables: entries });
  }
  ok(res, trees);
});

// POST /api/datasources/:id/build/preview-detail —— 明细预览
router.post('/:id/build/preview-detail', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const { definition, limit } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const { dialect, cfg, provider } = await loadRuntime(id);
  const catalog = await resolveBuildContext(id, req, definition.tables || []);
  const { sql, params, fields } = buildSql.compileDetail(definition, dialect, catalog);
  const n = Math.min(200, Math.max(1, Math.floor(Number(limit) || 200)));
  const execSql = buildSql.applyRowLimit(dialect, sql, n);
  const rows = await provider.runQuery(cfg, execSql, params);
  ok(res, { fields, rows: rows.slice(0, n), sql: execSql });
});

// POST /api/datasources/:id/build/preview-aggregate —— 聚合预览
router.post('/:id/build/preview-aggregate', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const { definition, aggregation, limit } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const merged = { ...definition, aggregation: aggregation || definition.aggregation };
  const { dialect, cfg, provider } = await loadRuntime(id);
  const catalog = await resolveBuildContext(id, req, definition.tables || []);
  const { sql, params, fields } = buildSql.compileDetail(merged, dialect, catalog);
  const n = Math.min(1000, Math.max(1, Math.floor(Number(limit) || 1000)));
  const execSql = buildSql.applyRowLimit(dialect, sql, n);
  const rows = await provider.runQuery(cfg, execSql, params);
  ok(res, { fields, rows: rows.slice(0, n), sql: execSql });
});

// POST /api/datasources/:id/build/preview-node —— ETL 节点预览
router.post('/:id/build/preview-node', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const { definition, nodeId, limit } = req.body || {};
  if (!definition || !nodeId) throw new HttpError(400, '缺少定义或节点');
  const { dialect, cfg, provider } = await loadRuntime(id);
  const catalog = await resolveBuildContext(id, req, collectEtlTables(definition.nodes || []));
  const { nodeSql } = buildSql.compileEtl(definition, dialect, catalog);
  try {
    const { sql, params, fields } = nodeSql(nodeId);
    const n = Math.min(200, Math.max(1, Math.floor(Number(limit) || 200)));
    // output 节点已自带 LIMIT，applyRowLimit 会取较小值，避免双 LIMIT
    const execSql = buildSql.applyRowLimit(dialect, sql, n);
    const rows = await provider.runQuery(cfg, execSql, params);
    ok(res, { fields, rows: rows.slice(0, n), sql: execSql });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error('[build] ETL 节点预览失败', e);
    throw new HttpError(500, 'ETL节点执行失败');
  }
});

// POST /api/datasources/:id/build/save —— 保存构建定义（缺失字段时 server 端回填）
router.post('/:id/build/save', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const { name, definition, datasetId } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  let def = definition;
  if ((!definition.fields || !definition.fields.length) && (definition.type === 'builder' || definition.type === 'etl')) {
    const { dialect } = await loadRuntime(id);
    let fields = [];
    if (definition.type === 'builder') {
      const catalog = await resolveBuildContext(id, req, definition.tables || []);
      fields = deriveBuilderFields(definition, catalog);
    } else {
      const tables = collectEtlTables(definition.nodes || []);
      const catalog = await resolveBuildContext(id, req, tables);
      if (catalogResolved(catalogKeyed(catalog), tables)) {
        const { nodeSql } = buildSql.compileEtl(definition, dialect, catalog);
        const nodes = definition.nodes || [];
        const last = nodes[nodes.length - 1];
        if (last && last.nodeId) ({ fields } = nodeSql(last.nodeId));
      }
    }
    if (fields && fields.length) def = { ...definition, fields };
  }
  const ds = await datasetService.saveBuiltDataset({
    name,
    definition: def,
    datasourceId: id,
    datasetId: datasetId ? Number(datasetId) : null,
    ownerId: req.user.id,
    admin: await access.isAdmin(req.user, rbac),
  });
  ok(res, ds, datasetId ? '数据集已更新' : '数据集创建成功');
});

// POST /api/datasources/:id/build/validate —— 语义校验
router.post('/:id/build/validate', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('datasource', id, req.user, rbac);
  const { definition } = req.body || {};
  if (!definition) throw new HttpError(400, '缺少构建定义');
  const { dialect } = await loadRuntime(id);
  const result = { valid: true, errors: [] };
  try {
    if (definition.type === 'etl') {
      const nodes = definition.nodes || [];
      if (!nodes.length) throw new Error('ETL 定义缺少节点');
      const { nodeSql } = buildSql.compileEtl(definition, dialect, []);
      for (const n of nodes) nodeSql(n.nodeId);
    } else {
      buildSql.compileDetail(definition, dialect, []);
    }
  } catch (e) {
    result.valid = false;
    result.errors.push(e.message);
  }
  ok(res, result);
});

module.exports = router;