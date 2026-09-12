const app = require('./app');
const config = require('./config');
const { seed } = require('./seeds');

seed();
console.log('[kanban-backend] 已初始化种子数据（角色/权限/管理员）');

if (!process.env.JWT_SECRET || !process.env.ADMIN_INITIAL_PASSWORD) {
  console.warn('[kanban-backend] 警告: 使用默认 JWT_SECRET/管理员密码，生产环境请通过环境变量配置（见 backend/.env.example）');
}

app.listen(config.port, () => {
  console.log(`[kanban-backend] 启动成功: http://localhost:${config.port}`);
  console.log(`[kanban-backend] 数据目录: ${config.dataDir}`);
});
