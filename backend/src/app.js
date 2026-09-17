const express = require('express');
const cors = require('cors');
const config = require('./config');
const { errorHandler, notFound } = require('./middleware/response');

const datasetRoutes = require('./routes/dataset.routes');
const chartRoutes = require('./routes/chart.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const datasourceRoutes = require('./routes/datasource.routes');
const { dashSharesRouter, sharesRouter } = require('./routes/share.routes');
const publicShareRoutes = require('./routes/public-share.routes');
const openApiRoutes = require('./routes/open-api.routes');
const { adminApiKeysRouter, tokenRouter } = require('./routes/api-key.routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./openapi/swagger');
const { configRouter } = require('./routes/system.routes');

const app = express();

// 部署在 nginx 反代之后：信任首跳代理以正确解析 req.ip（express-rate-limit v8 需要 trust proxy）
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', name: 'kanban-backend', version: '1.0.0' }, message: 'success' });
});

app.use('/api/datasets', datasetRoutes);
app.use('/api/charts', chartRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/datasources', datasourceRoutes);
app.use('/api/dashboards', dashSharesRouter);
app.use('/api/shares', sharesRouter);
app.use('/api/public/shares', publicShareRoutes);
// 开放 API：spec JSON 与文档 UI（公开只读引用）
app.get('/api/open/v1/openapi.json', (req, res) => res.json(swaggerSpec));
app.use('/api/open/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: '看板开放 API' }));
app.use('/api/open/v1', openApiRoutes);
app.use('/api/admin/api-keys', adminApiKeysRouter);
app.use('/api/auth/tokens', tokenRouter);
app.get('/api/config', configRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
