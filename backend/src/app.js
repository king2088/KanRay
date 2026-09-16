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
const { configRouter } = require('./routes/system.routes');

const app = express();

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
app.get('/api/config', configRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
