const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..'); // backend/
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const uploadDir = process.env.UPLOAD_DIR || path.join(root, 'uploads');

// ensure runtime directories exist
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const STORE_TYPES = ['sqlite', 'mysql', 'mariadb', 'postgres', 'sqlserver', 'oracle'];

// Read config.json — 优先 DATA_DIR（测试隔离），再 fallback root
let fileDb = { type: 'sqlite', url: '', sqlitePath: 'data/kanban.db' };
let fileCache = { url: '' };
let fileDatasource = {};
try {
  const candidates = [path.join(dataDir, 'config.json'), path.join(root, 'config.json')];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && parsed.db) fileDb = { ...fileDb, ...parsed.db };
      if (parsed && parsed.cache) fileCache = { ...fileCache, ...parsed.cache };
      if (parsed && parsed.datasource) fileDatasource = { ...fileDatasource, ...parsed.datasource };
      break;
    }
  }
} catch (e) {
  throw new Error(`config.json 解析失败: ${e.message}`);
}

// Priority: env > config.json > defaults
const dbType = String(process.env.DB_TYPE || fileDb.type || 'sqlite').toLowerCase();
if (!STORE_TYPES.includes(dbType)) {
  throw new Error(`不支持的 DB_TYPE="${dbType}"，可选: ${STORE_TYPES.join(' / ')}`);
}

const dbUrl = process.env.DB_URL || fileDb.url || '';
const dbSqlitePath = process.env.DB_PATH || (() => {
  const p = fileDb.sqlitePath || 'data/kanban.db';
  return path.isAbsolute(p) ? p : path.join(root, p);
})();

// Redis 缓存开关：REDIS_URL 或 config.json cache.url，缺省空 -> memory（默认关闭）
const cacheUrl = String(process.env.REDIS_URL || fileCache.url || '').trim();

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  root,
  dataDir,
  uploadDir,
  db: {
    type: dbType,
    url: dbUrl,
    sqlitePath: dbSqlitePath,
    // 连接池上限（postgres/mysql 应用存储驱动使用），多副本部署时按副本数 × 此值估算总连接
    poolMax: Math.max(1, parseInt(process.env.DB_POOL_MAX || '10', 10)),
  },
  // 兼容旧引用：sqlite 返回路径，其它类型返回 url
  get dbPath() {
    return module.exports.db.type === 'sqlite' ? module.exports.db.sqlitePath : module.exports.db.url;
  },
  cache: {
    type: cacheUrl ? 'redis' : 'memory',
    url: cacheUrl,
    ttlMs: Math.max(1, parseInt(process.env.CACHE_TTL_MS || '60000', 10)),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    accessTtl: process.env.ACCESS_TTL || '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS || '7', 10),
  },
  upload: {
    allowedExt: ['.xlsx', '.xls', '.csv'],
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(20 * 1024 * 1024), 10),
    maxRows: parseInt(process.env.MAX_ROWS || '200000', 10),
    previewRows: 50,
  },
  sync: {
    // inline: 调度与执行都在 API 进程内（默认，单机/测试）；
    // worker: 调度只入队，由独立 worker 进程消费执行（多副本/生产）。
    mode: String(process.env.SYNC_MODE || 'inline').toLowerCase() === 'worker' ? 'worker' : 'inline',
    schedulerIntervalMs: parseInt(process.env.SYNC_SCHEDULER_INTERVAL_MS || '60000', 10),
    workerPollMs: parseInt(process.env.SYNC_WORKER_POLL_MS || '2000', 10),
    maxConcurrent: parseInt(process.env.SYNC_MAX_CONCURRENT || '2', 10),
    // 已完成任务（success/failed）保留天数，超期清理，避免 sync_jobs 无界增长
    jobRetentionDays: Math.max(1, parseInt(process.env.SYNC_JOB_RETENTION_DAYS || '7', 10)),
    defaultIntervalSeconds: parseInt(process.env.SYNC_DEFAULT_INTERVAL_SECONDS || '86400', 10),
    lockTtlMs: parseInt(process.env.SYNC_LOCK_TTL_MS || '1800000', 10),
  },
  query: {
    // 聚合查询在未显式指定 groupLimit 时的分组数上限，防止超大分组结果全量物化
    maxGroups: Math.max(1, parseInt(process.env.QUERY_MAX_GROUPS || '10000', 10)),
  },
  datasource: {
    // http 数据源是否拦截回环/私网段（防 SSRF）。默认关：本地 dev 可指向 localhost/局域网服务；
    // 生产多用户部署建议开启。云元数据端点(169.254/16、100.64/10)任何环境都硬拦。
    httpBlockPrivate: String(process.env.HTTP_DATASOURCE_BLOCK_PRIVATE ?? fileDatasource.httpBlockPrivate ?? 'false').toLowerCase() === 'true',
  },
  timezone: String(process.env.TIMEZONE || 'Asia/Shanghai'),
  openApi: {
    ratePerMin: parseInt(process.env.OPEN_API_RATE_PER_MIN || '120', 10),
    maxRows: parseInt(process.env.OPEN_API_MAX_ROWS || '10000', 10),
  },
};
