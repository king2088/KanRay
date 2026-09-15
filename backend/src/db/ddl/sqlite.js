module.exports = [
  `CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, original_file TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0, column_count INTEGER NOT NULL DEFAULT 0,
    table_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source_type TEXT NOT NULL DEFAULT 'excel', datasource_id INTEGER, schema_name TEXT,
    table_name_ext TEXT, build_definition TEXT, owner_id INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS dataset_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS charts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    chart_type TEXT NOT NULL, config TEXT NOT NULL, owner_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, layout TEXT NOT NULL DEFAULT '[]',
    gap_x INTEGER NOT NULL DEFAULT 12, gap_y INTEGER NOT NULL DEFAULT 12, card_style TEXT NOT NULL DEFAULT '{}',
    owner_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT, action TEXT NOT NULL,
    resource_type TEXT, resource_id TEXT, detail TEXT, ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}', is_active INTEGER NOT NULL DEFAULT 1, owner_id INTEGER,
    mode TEXT NOT NULL DEFAULT 'direct', last_test_at TEXT, last_test_ok INTEGER, last_test_msg TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_data_sources_owner ON data_sources(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type)',
  'CREATE INDEX IF NOT EXISTS idx_datasets_owner ON datasets(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_charts_owner ON charts(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)',
  `CREATE TABLE IF NOT EXISTS sync_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, datasource_id INTEGER NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    source_schema TEXT, source_table TEXT NOT NULL, local_table TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'app', strategy TEXT NOT NULL DEFAULT 'incremental',
    watermark_field TEXT, watermark_kind TEXT NOT NULL DEFAULT 'id', primary_key TEXT,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 86400,
    last_sync_at TEXT, last_watermark TEXT, last_sync_status TEXT, last_sync_msg TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (datasource_id, source_schema, source_table)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_config_id INTEGER NOT NULL REFERENCES sync_configs(id) ON DELETE CASCADE,
    started_at TEXT, finished_at TEXT, status TEXT, rows_synced INTEGER, message TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_sync_configs_ds ON sync_configs(datasource_id)',
];