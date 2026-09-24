/**
 * 开放 API（/api/open/v1）端点路径文档。
 * 根级定义（info/servers/tags/components）见 ./swagger.js definition；此文件仅保留 @swagger 路径块。
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
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
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
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
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
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
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