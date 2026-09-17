/**
 * 开放 API（/api/open/v1）Swagger 文档。
 * 供 swagger-jsdoc 解析生成 OpenAPI 3.0 spec；此文件仅含 JSDoc 注解。
 */

/**
 * @swagger
 * openapi: 3.0.0
 * info:
 *   title: 看板开放 API
 *   description: |
 *     面向外部客户集成的开放 REST API。使用 `Authorization: Bearer <API Key|PAT>`
 *     或 `X-API-Key: <API Key>` 认证；凭证在管理端「开放 API」或「个人中心·访问令牌」创建，
 *     仅创建/滚动时明文展示一次。所有响应沿用 `{code, message, data}` 外壳；
 *     列表端点返回 `data.items + data.total`，分页 `?limit`（默认 50 / 上限 200）+ `?offset`。
 *     数据端点支持 `?format=csv` 或 `Accept: text/csv` 返回带 BOM 的 CSV。
 *   version: 1.0.0
 * servers:
 *   - url: /api/open/v1
 * tags:
 *   - name: 发现
 *     description: 可见资源列表
 *   - name: 取数
 *     description: 图表、数据集、看板数据出口
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *   responses:
 *     BadRequest:
 *       description: 参数错误
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     Unauthorized:
 *       description: Key 无效 / 已吊销 / 已过期（统一 401，防枚举）
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     Forbidden:
 *       description: Scope 不足或账号禁用
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     NotFound:
 *       description: 资源不存在或无权访问（统一 404 掩盖）
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     TooManyRequests:
 *       description: 超出限流（默认 120 次/分钟/Key）
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *   schemas:
 *     Error:
 *       type: object
 *       required: [code, message]
 *       properties:
 *         code: { type: integer, example: 401 }
 *         message: { type: string }
 *         data: { nullable: true }
 *     ChartSummary:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         chartType: { type: string, example: bar }
 *         datasetId: { type: integer }
 *         datasetName: { type: string }
 *         createdAt: { type: string }
 *         updatedAt: { type: string }
 *     DatasetSummary:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         sourceType: { type: string, example: excel }
 *         rowCount: { type: integer }
 *         columnCount: { type: integer }
 *         createdAt: { type: string }
 *     DashboardSummary:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         createdAt: { type: string }
 *         updatedAt: { type: string }
 *     Column:
 *       type: object
 *       properties:
 *         field: { type: string }
 *         label: { type: string }
 *         agg: { type: string, example: sum }
 *     ChartDataResult:
 *       type: object
 *       properties:
 *         chart:
 *           type: object
 *           properties:
 *             id: { type: integer }
 *             name: { type: string }
 *             chartType: { type: string }
 *         columns:
 *           type: array
 *           items: { $ref: '#/components/schemas/Column' }
 *         rows:
 *           type: array
 *           items: { type: object }
 *         truncated: { type: boolean, description: 超出 OPEN_API_MAX_ROWS 时截断 }
 *     AggregateResult:
 *       type: object
 *       properties:
 *         columns:
 *           type: array
 *           items: { $ref: '#/components/schemas/Column' }
 *         rows:
 *           type: array
 *           items: { type: object }
 *         truncated: { type: boolean }
 *     AggregateRequest:
 *       type: object
 *       required: [metrics]
 *       properties:
 *         metrics:
 *           type: array
 *           minItems: 1
 *           items:
 *             type: object
 *             required: [field, agg]
 *             properties:
 *               field: { type: string, description: 数据集已注册字段 }
 *               agg: { type: string, enum: [sum, avg, count, count_distinct, max, min] }
 *               label: { type: string }
 *         dimensions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field: { type: string }
 *               label: { type: string }
 *               granularity: { type: string }
 *         filters:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field: { type: string }
 *               op: { type: string, enum: [eq, ne, in, contains, lt, lte, gt, gte] }
 *               value: {}
 *         timeGrain: { type: string }
 *         sortBy: { type: string }
 *         groupLimit: { type: integer, maximum: 10000 }
 *     DashboardExportResult:
 *       type: object
 *       properties:
 *         dashboard:
 *           type: object
 *           properties:
 *             id: { type: integer }
 *             name: { type: string }
 *             createdAt: { type: string }
 *             updatedAt: { type: string }
 *         cards:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               chart: { type: object }
 *               columns: { type: array, items: { $ref: '#/components/schemas/Column' } }
 *               rows: { type: array, items: { type: object } }
 *               truncated: { type: boolean }
 */

/**
 * @swagger
 * /charts:
 *   get:
 *     tags: [发现]
 *     summary: 可见图表列表
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: keyword, in: query, description: 名称/数据集模糊搜索, schema: { type: string } }
 *       - { name: limit, in: query, description: 每页条数（默认50/上限200）, schema: { type: integer, default: 50 } }
 *       - { name: offset, in: query, description: 偏移量, schema: { type: integer, default: 0 } }
 *     responses:
 *       '200':
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/ChartSummary' } }
 *                 total: { type: integer }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */

/**
 * @swagger
 * /datasets:
 *   get:
 *     tags: [发现]
 *     summary: 可见数据集列表
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 50 } }
 *       - { name: offset, in: query, schema: { type: integer, default: 0 } }
 *     responses:
 *       '200':
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/DatasetSummary' } }
 *                 total: { type: integer }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */

/**
 * @swagger
 * /dashboards:
 *   get:
 *     tags: [发现]
 *     summary: 可见看板列表
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 50 } }
 *       - { name: offset, in: query, schema: { type: integer, default: 0 } }
 *     responses:
 *       '200':
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/DashboardSummary' } }
 *                 total: { type: integer }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */

/**
 * @swagger
 * /charts/{id}/data:
 *   get:
 *     tags: [取数]
 *     summary: 按图表当前配置取数
 *     description: 校验图表与其数据集双重归属；响应为 columns + rows（不含构建 SQL）。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *       - { name: format, in: query, description: 'csv 时返回带 BOM 的 CSV', schema: { type: string, enum: [csv] } }
 *     responses:
 *       '200':
 *         description: ok
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ChartDataResult' }
 *           text/csv:
 *             schema: { type: string }
 *       '400': { $ref: '#/components/responses/BadRequest' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */

/**
 * @swagger
 * /datasets/{id}/aggregate:
 *   post:
 *     tags: [取数]
 *     summary: 数据集自定义聚合
 *     description: metrics/dimensions/filters 字段必须为该数据集已注册字段；超出 OPEN_API_MAX_ROWS 会截断并返回 truncated。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AggregateRequest' }
 *     responses:
 *       '200':
 *         description: ok
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AggregateResult' }
 *           text/csv:
 *             schema: { type: string }
 *       '400': { $ref: '#/components/responses/BadRequest' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '422': { description: 包含未注册字段 }
 */

/**
 * @swagger
 * /dashboards/{id}/export:
 *   get:
 *     tags: [取数]
 *     summary: 看板快照导出（元信息 + 全部图表数据）
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *       - { name: format, in: query, description: 'csv 时逐卡输出 CSV（以 # 图表名 分行）', schema: { type: string, enum: [csv] } }
 *     responses:
 *       '200':
 *         description: ok
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DashboardExportResult' }
 *           text/csv:
 *             schema: { type: string }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */