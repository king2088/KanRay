const app = require('./app');
const config = require('./config');
const { seed } = require('./seeds');
const { startScheduler, stopScheduler } = require('./jobs/sync-scheduler');

async function main() {
  const db = require('./db');
  await db.initSchema();
  await seed();
  console.log('[kanban-backend] 已初始化种子数据（角色/权限/管理员）');

  if (!process.env.JWT_SECRET || !process.env.ADMIN_INITIAL_PASSWORD) {
    console.warn('[kanban-backend] 警告: 使用默认 JWT_SECRET/管理员密码，生产环境请通过环境变量配置（见 backend/.env.example）');
  }

  startScheduler();

  app.listen(config.port, () => {
    console.log(`[kanban-backend] 启动成功: http://localhost:${config.port}`);
    console.log(`[kanban-backend] 数据目录: ${config.dataDir}`);
  });
}

process.on('SIGTERM', () => { stopScheduler(); process.exit(0); });

main().catch((e) => { console.error('[kanban-backend] 启动失败', e); process.exit(1); });
