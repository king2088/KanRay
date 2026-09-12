const app = require('./app');
const config = require('./config');
const { seed } = require('./seeds');

seed();
console.log('[kanban-backend] 已初始化种子数据（角色/权限/管理员）');

app.listen(config.port, () => {
  console.log(`[kanban-backend] 启动成功: http://localhost:${config.port}`);
  console.log(`[kanban-backend] 数据目录: ${config.dataDir}`);
});