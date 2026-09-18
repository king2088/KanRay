const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { z } = require('zod');

const config = require('../config');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const { requireUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const datasetService = require('../services/dataset.service');
const datasourceService = require('../services/datasource.service');
const access = require('../services/access.service');
const rbac = require('../services/rbac.service');
const queryEngine = require('../engines/query-engine');
const { parsePageQuery, paginate } = require('../utils/pagination');

const router = express.Router();

// multer 存储到临时目录：先用随机文件名，避免覆盖
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname || '').toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    // 拒绝宏文件
    if (ext === '.xlsm') return cb(new HttpError(400, '不支持含宏的 Excel 文件(.xlsm)'));
    if (!config.upload.allowedExt.includes(ext)) {
      return cb(new HttpError(400, `不支持的文件类型: ${ext || '未知'}`));
    }
    cb(null, true);
  },
});

function cleanup(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  }
}

// GET /api/datasets  (可选 page/pageSize -> {list,total}，否则返回全量数组)
// 管理员全量；其余仅可见自己的数据集
router.get('/', requireUser, requirePermission('dataset', 'read'), async (req, res) => {
  const items = await datasetService.listDatasets(await access.scopedWhere('dataset', req.user, rbac));
  const page = parsePageQuery(req.query);
  ok(res, page ? paginate(items, page.page, page.pageSize) : items);
});

// GET /api/datasets/:id  (含字段)
router.get('/:id', requireUser, requirePermission('dataset', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dataset', id, req.user, rbac);
  ok(res, await datasetService.getDatasetOrThrow(id));
});

// POST /api/datasets/preview  (上传并预览，不落库)
router.post('/preview', requireUser, requirePermission('dataset', 'create'), upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, '请上传文件');
  try {
    const preview = await datasetService.previewExcel(req.file.path);
    ok(res, preview);
  } finally {
    cleanup(req.file.path);
  }
});

// POST /api/datasets  (上传并正式创建)
router.post('/', requireUser, requirePermission('dataset', 'create'), upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, '请上传文件');
  const nameSchema = z.string().trim().min(1).max(100);
  const parsed = nameSchema.safeParse(req.body.name);
  try {
    if (!parsed.success) throw new HttpError(400, '数据集名称不能为空且不超过 100 字符');
    const ds = await datasetService.parseAndCreate(parsed.data, req.file.path, req.user.id);
    // 上传的文件作为「文件型数据源」登记（Excel/CSV），便于在数据源列表中统一管理
    try {
      await datasourceService.createExcelDatasource(
        { name: parsed.data, file: req.file.originalname, rowCount: ds.row_count, columnCount: ds.column_count },
        req.user.id, req
      );
    } catch (e) { /* 文件数据源登记失败不影响数据集创建 */ }
    ok(res, ds, '数据集创建成功');
  } finally {
    cleanup(req.file.path);
  }
});

// DELETE /api/datasets/:id
router.delete('/:id', requireUser, requirePermission('dataset', 'delete'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dataset', id, req.user, rbac);
  await datasetService.deleteDataset(id);
  ok(res, true, '删除成功');
});

// PATCH /api/datasets/:id  (重命名)
router.patch('/:id', requireUser, requirePermission('dataset', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dataset', id, req.user, rbac);
  const schema = z.object({ name: z.string().trim().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '数据集名称不能为空且不超过 100 字符');
  const ds = await datasetService.renameDataset(id, parsed.data.name);
  ok(res, ds, '重命名成功');
});

// POST /api/datasets/row-counts  (批量懒计算并落库 SQL 数据集行数；仅 row_count=0 的才重算)
router.post('/row-counts', requireUser, requirePermission('dataset', 'read'), async (req, res) => {
  const schema = z.object({ ids: z.array(z.number().int().positive()).max(100).default([]) }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, '请求参数不正确', parsed.error.flatten());
  const scope = await access.scopedWhere('dataset', req.user, rbac);
  const counts = await datasetService.refreshRowCounts(parsed.data.ids, scope);
  ok(res, { counts });
});

// GET /api/datasets/:id/rows  (分页预览数据)
router.get('/:id/rows', requireUser, requirePermission('dataset', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dataset', id, req.user, rbac);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)));
  ok(res, await datasetService.paginateRows(id, page, pageSize));
});

// PATCH /api/datasets/:id/fields/:fieldId  (更新字段别名)
router.patch('/:id/fields/:fieldId', requireUser, requirePermission('dataset', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dataset', id, req.user, rbac);
  const schema = z.object({ label: z.string().trim().min(1).max(100) }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '字段别名不能为空且不超过 100 字符');
  const field = await datasetService.updateFieldLabel(id, Number(req.params.fieldId), parsed.data.label);
  ok(res, field, '字段更新成功');
});

// POST /api/datasets/:id/query  (聚合查询 -> 图表数据)
const querySchema = z.object({
  dimensions: z.array(z.object({
    field: z.string(),
    label: z.string().optional(),
    granularity: z.string().optional(),
  })).optional().default([]),
  metrics: z.array(z.union([
    z.object({
      type: z.literal('base').optional(),
      key: z.string().optional(),
      field: z.string(),
      agg: z.string(),
      label: z.string().optional(),
    }),
    z.object({
      type: z.literal('expr'),
      key: z.string().optional(),
      expr: z.string(),
      label: z.string().optional(),
    }),
    z.object({
      type: z.literal('derived'),
      key: z.string().optional(),
      kind: z.enum(['share', 'mom', 'yoy', 'cumsum', 'rank']),
      ref: z.string(),
      label: z.string().optional(),
    }),
  ])).optional().default([]),
  filters: z.array(z.object({
    field: z.string(),
    op: z.string(),
    value: z.any(),
  })).optional().default([]),
  sortBy: z.any().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  groupLimit: z.number().int().positive().optional(),
}).strict();

router.post('/:id/query', requireUser, requirePermission('dataset', 'read'), async (req, res) => {
  const id = Number(req.params.id);
  await access.assertResource('dataset', id, req.user, rbac);
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '查询参数不正确', parsed.error.flatten());
  const result = await queryEngine.aggregate({ datasetId: id, ...parsed.data });
  ok(res, result);
});

module.exports = router;
