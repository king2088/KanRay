const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '看板开放 API',
      'x-en-title': 'KanRay Open API',
      version: '1.0.0',
      description:
        '面向外部客户集成的开放 REST API。使用 `Authorization: Bearer <API Key|PAT>` 或 `X-API-Key: <API Key>` 认证；凭证在管理端「开放 API」或「个人中心·访问令牌」创建，仅创建/滚动时明文展示一次。' +
        '所有响应沿用 `{code, message, data}` 外壳；列表端点返回 `data.items + data.total`，分页 `?limit`（默认 50 / 上限 200）+ `?offset`。' +
        '数据端点支持 `?format=csv` 或 `Accept: text/csv` 返回带 BOM 的 CSV。',
      'x-en':
        'Open REST API for external customer integrations. Authenticate with `Authorization: Bearer <API Key|PAT>` or `X-API-Key: <API Key>`; ' +
        'credentials are created under "Open API" in the admin console or "Access Tokens" in your profile, and are shown in plain text only once, at creation or rotation. ' +
        'Every response uses the `{code, message, data}` envelope; list endpoints return `data.items + data.total`, with pagination via `?limit` (default 50, max 200) and `?offset`. ' +
        'Data endpoints support `?format=csv` or `Accept: text/csv` to return CSV with a BOM.',
    },
    servers: [{ url: '/api/open/v1' }],
    tags: [
      { name: '发现', 'x-en-name': 'Discovery', description: '可见资源列表', 'x-en': 'Visible resource list' },
      { name: '取数', 'x-en-name': 'Data', description: '图表、数据集、看板数据出口', 'x-en': 'Data endpoints for charts, datasets and dashboards' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      responses: {
        BadRequest: {
          description: '参数错误',
          'x-en': 'Invalid parameters',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Unauthorized: {
          description: 'Key 无效 / 已吊销 / 已过期（统一 401，防枚举）',
          'x-en': 'Invalid, revoked or expired key (uniform 401 to prevent enumeration)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Scope 不足或账号禁用',
          'x-en': 'Insufficient scope or disabled account',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: '资源不存在或无权访问（统一 404 掩盖）',
          'x-en': 'Resource not found or not accessible (uniform 404 to mask existence)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        TooManyRequests: {
          description: '超出限流（默认 120 次/分钟/Key）',
          'x-en': 'Rate limit exceeded (default 120 requests per minute per key)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'integer', example: 401 },
            message: { type: 'string' },
            data: { nullable: true },
          },
        },
        ChartSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            chartType: { type: 'string', example: 'bar' },
            datasetName: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
        DatasetSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            sourceType: { type: 'string', example: 'excel' },
            rowCount: { type: 'integer' },
            columnCount: { type: 'integer' },
            createdAt: { type: 'string' },
          },
        },
        DashboardSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
        Column: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            label: { type: 'string' },
            agg: { type: 'string', example: 'sum' },
          },
        },
        ChartDataResult: {
          type: 'object',
          properties: {
            chart: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                chartType: { type: 'string' },
              },
            },
            columns: { type: 'array', items: { $ref: '#/components/schemas/Column' } },
            rows: { type: 'array', items: { type: 'object' } },
            truncated: { type: 'boolean', description: '超出 OPEN_API_MAX_ROWS 时截断', 'x-en': 'Truncated when OPEN_API_MAX_ROWS is exceeded' },
          },
        },
        AggregateResult: {
          type: 'object',
          properties: {
            columns: { type: 'array', items: { $ref: '#/components/schemas/Column' } },
            rows: { type: 'array', items: { type: 'object' } },
            truncated: { type: 'boolean' },
          },
        },
        AggregateRequest: {
          type: 'object',
          required: ['metrics'],
          properties: {
            metrics: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['field', 'agg'],
                properties: {
                  field: { type: 'string', description: '数据集已注册字段', 'x-en': 'Field registered on the dataset' },
                  agg: { type: 'string', enum: ['sum', 'avg', 'count', 'count_distinct', 'max', 'min'] },
                  label: { type: 'string' },
                },
              },
            },
            dimensions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  label: { type: 'string' },
                  granularity: { type: 'string' },
                },
              },
            },
            filters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  op: { type: 'string', enum: ['eq', 'ne', 'in', 'contains', 'lt', 'lte', 'gt', 'gte'] },
                  value: {},
                },
              },
            },
            timeGrain: { type: 'string' },
            sortBy: { type: 'string' },
            groupLimit: { type: 'integer', maximum: 10000 },
          },
        },
        DashboardExportResult: {
          type: 'object',
          properties: {
            dashboard: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  chart: { type: 'object' },
                  columns: { type: 'array', items: { $ref: '#/components/schemas/Column' } },
                  rows: { type: 'array', items: { type: 'object' } },
                  truncated: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, 'openapi.doc.js')],
};

const spec = swaggerJsdoc(options);

module.exports = spec;