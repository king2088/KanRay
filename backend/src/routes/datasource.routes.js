const express = require('express');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const datasourceService = require('../services/datasource.service');
const datasetService = require('../services/dataset.service');
const drivers = require('../datasources/drivers');

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
router.get('/', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  const items = datasourceService.list(access.scopedWhere('datasource', req.user, rbac));
  ok(res, items);
});

// POST /api/datasources/test —— 测试未保存配置
router.post('/test', requireUser, requirePermission('datasource', 'create'), async (req, res) => {
  const { type, config } = req.body || {};
  if (!type) throw new HttpError(400, '缺少数据源类型');
  const result = await datasourceService.testConfig({ type, config });
  ok(res, result);
});

// POST /api/datasources —— 创建
router.post('/', requireUser, requirePermission('datasource', 'create'), (req, res) => {
  const { name, type, config } = req.body || {};
  if (!name || !String(name).trim()) throw new HttpError(400, '数据源名称不能为空');
  if (!type) throw new HttpError(400, '缺少数据源类型');
  const ds = datasourceService.create({ name, type, config }, req.user.id, req);
  ok(res, ds, '数据源创建成功');
});

// GET /api/datasources/:id
router.get('/:id', requireUser, requirePermission('datasource', 'read'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const ds = datasourceService.get(id);
  if (!ds) throw new HttpError(404, '数据源不存在');
  ok(res, ds);
});

// PATCH /api/datasources/:id —— 更新（含启停）
router.patch('/:id', requireUser, requirePermission('datasource', 'update'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const ds = datasourceService.update(id, req.body || {}, req);
  ok(res, ds, '更新成功');
});

// DELETE /api/datasources/:id
router.delete('/:id', requireUser, requirePermission('datasource', 'delete'), (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  datasourceService.remove(id, req);
  ok(res, true, '删除成功');
});

// POST /api/datasources/:id/test —— 测试已保存并回写结果
router.post('/:id/test', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const result = await datasourceService.testSaved(id, req);
  ok(res, result);
});

// GET /api/datasources/:id/schemas
router.get('/:id/schemas', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  ok(res, await datasourceService.listSchemas(id, req));
});

// GET /api/datasources/:id/schemas/:schema/tables
router.get('/:id/schemas/:schema/tables', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  ok(res, await datasourceService.listTables(id, req.params.schema, req));
});

// GET /api/datasources/:id/schemas/:schema/tables/:table/columns
router.get('/:id/schemas/:schema/tables/:table/columns', requireUser, requirePermission('datasource', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  ok(res, await datasourceService.listColumns(id, req.params.schema, req.params.table, req));
});

// POST /api/datasources/:id/register-table —— 注册外部表为 SQL 数据集
router.post('/:id/register-table', requireUser, requirePermission('datasource', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  access.assertResource('datasource', id, req.user, rbac);
  const { schema, table, name } = req.body || {};
  if (!table) throw new HttpError(400, '缺少表名');
  const columns = await datasourceService.listColumns(id, schema, table, req);
  const ds = datasetService.registerSqlDataset(
    name || table, id, schema, table,
    columns.map((c) => ({ name: c.name, label: c.name, type: c.role === 'metric' ? 'number' : 'string' })),
    req.user.id
  );
  ok(res, ds, '数据集创建成功');
});

module.exports = router;