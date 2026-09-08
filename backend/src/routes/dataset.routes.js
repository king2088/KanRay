const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { z } = require('zod');

const config = require('../config');
const HttpError = require('../utils/http-error');
const { ok } = require('../middleware/response');
const datasetService = require('../services/dataset.service');
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
router.get('/', (req, res) => {
  const items = datasetService.listDatasets();
  const page = parsePageQuery(req.query);
  ok(res, page ? paginate(items, page.page, page.pageSize) : items);
});

// GET /api/datasets/:id  (含字段)
router.get('/:id', (req, res) => {
  const ds = datasetService.getDatasetOrThrow(Number(req.params.id));
  ok(res, ds);
});

// POST /api/datasets/preview  (上传并预览，不落库)
router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) throw new HttpError(400, '请上传文件');
  try {
    const preview = datasetService.previewExcel(req.file.path);
    ok(res, preview);
  } finally {
    cleanup(req.file.path);
  }
});

// POST /api/datasets  (上传并正式创建)
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) throw new HttpError(400, '请上传文件');
  const nameSchema = z.string().trim().min(1).max(100);
  const parsed = nameSchema.safeParse(req.body.name);
  try {
    if (!parsed.success) throw new HttpError(400, '数据集名称不能为空且不超过 100 字符');
    const ds = datasetService.parseAndCreate(parsed.data, req.file.path);
    ok(res, ds, '数据集创建成功');
  } finally {
    cleanup(req.file.path);
  }
});

// DELETE /api/datasets/:id
router.delete('/:id', (req, res) => {
  datasetService.deleteDataset(Number(req.params.id));
  ok(res, true, '删除成功');
});

// PATCH /api/datasets/:id  (重命名)
router.patch('/:id', (req, res) => {
  const schema = z.object({ name: z.string().trim().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '数据集名称不能为空且不超过 100 字符');
  const ds = datasetService.renameDataset(Number(req.params.id), parsed.data.name);
  ok(res, ds, '重命名成功');
});

// GET /api/datasets/:id/rows  (分页预览数据)
router.get('/:id/rows', (req, res) => {
  const id = Number(req.params.id);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)));
  ok(res, datasetService.paginateRows(id, page, pageSize));
});

// PATCH /api/datasets/:id/fields/:fieldId  (更新字段别名)
router.patch('/:id/fields/:fieldId', (req, res) => {
  const schema = z.object({ label: z.string().trim().min(1).max(100) }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '字段别名不能为空且不超过 100 字符');
  const field = datasetService.updateFieldLabel(Number(req.params.id), Number(req.params.fieldId), parsed.data.label);
  ok(res, field, '字段更新成功');
});

// POST /api/datasets/:id/query  (聚合查询 -> 图表数据)
const querySchema = z.object({
  dimensions: z.array(z.object({
    field: z.string(),
    label: z.string().optional(),
    granularity: z.string().optional(),
  })).optional().default([]),
  metrics: z.array(z.object({
    field: z.string(),
    agg: z.string(),
    label: z.string().optional(),
  })).optional().default([]),
  filters: z.array(z.object({
    field: z.string(),
    op: z.string(),
    value: z.any(),
  })).optional().default([]),
  sortBy: z.any().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  groupLimit: z.number().int().positive().optional(),
}).strict();

router.post('/:id/query', (req, res) => {
  const id = Number(req.params.id);
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, '查询参数不正确', parsed.error.flatten());
  const result = queryEngine.aggregate({ datasetId: id, ...parsed.data });
  ok(res, result);
});

module.exports = router;
