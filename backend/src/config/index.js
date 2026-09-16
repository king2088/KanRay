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
try {
  const candidates = [path.join(dataDir, 'config.json'), path.join(root, 'config.json')];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && parsed.db) fileDb = { ...fileDb, ...parsed.db };
      if (parsed && parsed.cache) fileCache = { ...fileCache, ...parsed.cache };
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
    schedulerIntervalMs: parseInt(process.env.SYNC_SCHEDULER_INTERVAL_MS || '60000', 10),
    maxConcurrent: parseInt(process.env.SYNC_MAX_CONCURRENT || '2', 10),
    defaultIntervalSeconds: parseInt(process.env.SYNC_DEFAULT_INTERVAL_SECONDS || '86400', 10),
    lockTtlMs: parseInt(process.env.SYNC_LOCK_TTL_MS || '1800000', 10),
  },
};
