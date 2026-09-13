const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  original_file TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  table_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 字段元数据（语义层）
CREATE TABLE IF NOT EXISTS dataset_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,          -- 物理列名（落库时的列名）
  label TEXT NOT NULL,         -- 展示别名
  type TEXT NOT NULL,          -- string | number | integer | date | boolean
  position INTEGER NOT NULL DEFAULT 0
);

-- 图表
CREATE TABLE IF NOT EXISTS charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL,        -- bar | line | pie | ...
  config TEXT NOT NULL,            -- JSON：维度/指标/筛选/样式
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 看板
CREATE TABLE IF NOT EXISTS dashboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT '[]',  -- JSON：组件数组
  gap_x INTEGER NOT NULL DEFAULT 12,  -- 卡片左右间距（px）
  gap_y INTEGER NOT NULL DEFAULT 12,  -- 卡片上下间距（px）
  card_style TEXT NOT NULL DEFAULT '{}',  -- JSON：卡片全局样式（边框/标题等）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 角色
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 权限点
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- 角色-权限
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 用户-角色
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 刷新令牌
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  owner_id INTEGER,
  last_test_at TEXT,
  last_test_ok INTEGER,
  last_test_msg TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_data_sources_owner ON data_sources(owner_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
`)

// 旧库迁移：补齐 gap_x/gap_y/card_style（幂等，已存在则跳过）
const dashCols = db.prepare("PRAGMA table_info('dashboards')").all().map(c => c.name)
if (!dashCols.includes('gap_x')) db.exec("ALTER TABLE dashboards ADD COLUMN gap_x INT NOT NULL DEFAULT 12");
if (!dashCols.includes('gap_y')) db.exec("ALTER TABLE dashboards ADD COLUMN gap_y INT NOT NULL DEFAULT 12");
if (!dashCols.includes('card_style')) db.exec("ALTER TABLE dashboards ADD COLUMN card_style TEXT NOT NULL DEFAULT '{}'");

// 旧库迁移：资源表补齐 owner_id（幂等，已存在则跳过）
['datasets', 'charts', 'dashboards'].forEach((t) => {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  if (!cols.includes('owner_id')) db.exec(`ALTER TABLE ${t} ADD COLUMN owner_id INTEGER`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_owner ON ${t}(owner_id);`);
});

// M2: datasets 增列（幂等 ALTER，source_type=excel 兼容既有数据）
const dsCols = db.prepare("PRAGMA table_info('datasets')").all().map((c) => c.name);
if (!dsCols.includes('source_type')) db.exec("ALTER TABLE datasets ADD COLUMN source_type TEXT NOT NULL DEFAULT 'excel'");
if (!dsCols.includes('datasource_id')) db.exec("ALTER TABLE datasets ADD COLUMN datasource_id INTEGER");
if (!dsCols.includes('schema_name')) db.exec("ALTER TABLE datasets ADD COLUMN schema_name TEXT");
if (!dsCols.includes('table_name_ext')) db.exec("ALTER TABLE datasets ADD COLUMN table_name_ext TEXT");

// 刷新令牌哈希检索索引
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);');

/**
 * 为数据集动态创建数据表（单引号表名转义策略：表名由系统生成，安全）
 */
function ensureDatasetTable(schemaName, fields) {
  const cols = fields.map((f) => {
    const sqlType = f.sqlType; // 由上层根据 type 生成
    return `"${f.name}" ${sqlType}`;
  });
  db.exec(`CREATE TABLE IF NOT EXISTS ${schemaName} (${cols.join(', ')})`);
}

module.exports = db;
module.exports.ensureDatasetTable = ensureDatasetTable;
