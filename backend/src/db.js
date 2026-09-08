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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

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
