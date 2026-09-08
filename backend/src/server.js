const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`[kanban-backend] 启动成功: http://localhost:${config.port}`);
  console.log(`[kanban-backend] 数据目录: ${config.dataDir}`);
});