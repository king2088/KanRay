module.exports = [
  `CREATE TABLE IF NOT EXISTS datasets (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, original_file TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0, column_count INTEGER NOT NULL DEFAULT 0,
    table_name TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now(),
    source_type TEXT NOT NULL DEFAULT 'excel', datasource_id BIGINT, schema_name TEXT,
    table_name_ext TEXT, build_definition TEXT, owner_id BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS dataset_fields (
    id BIGSERIAL PRIMARY KEY, dataset_id BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS metrics (
    id BIGSERIAL PRIMARY KEY, dataset_id BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, kind TEXT NOT NULL, definition TEXT NOT NULL DEFAULT '',
    owner_id BIGINT, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_metrics_dataset ON metrics(dataset_id)',
  `CREATE TABLE IF NOT EXISTS charts (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, dataset_id BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    chart_type TEXT NOT NULL, config TEXT NOT NULL, owner_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dashboards (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, layout TEXT NOT NULL,
    gap_x INTEGER NOT NULL DEFAULT 12, gap_y INTEGER NOT NULL DEFAULT 12, card_style TEXT NOT NULL,
    owner_id BIGINT, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '', is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', is_builtin SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY, user_id BIGINT, email TEXT, action TEXT NOT NULL,
    resource_type TEXT, resource_id TEXT, detail TEXT, ip TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS data_sources (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    config TEXT NOT NULL, is_active SMALLINT NOT NULL DEFAULT 1, owner_id BIGINT,
    mode TEXT NOT NULL DEFAULT 'direct', last_test_at TIMESTAMP, last_test_ok SMALLINT, last_test_msg TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_data_sources_owner ON data_sources(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type)',
  'CREATE INDEX IF NOT EXISTS idx_datasets_owner ON datasets(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_charts_owner ON charts(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)',
  `CREATE TABLE IF NOT EXISTS sync_configs (
    id BIGSERIAL PRIMARY KEY, datasource_id BIGINT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    source_schema TEXT, source_table TEXT NOT NULL, local_table TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'app', strategy TEXT NOT NULL DEFAULT 'incremental',
    watermark_field TEXT, watermark_kind TEXT NOT NULL DEFAULT 'id', primary_key TEXT,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 86400,
    last_sync_at TIMESTAMP, last_watermark TEXT, last_sync_status TEXT, last_sync_msg TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (datasource_id, source_schema, source_table)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_logs (
    id BIGSERIAL PRIMARY KEY,
    sync_config_id BIGINT NOT NULL REFERENCES sync_configs(id) ON DELETE CASCADE,
    started_at TIMESTAMP, finished_at TIMESTAMP, status TEXT, rows_synced INTEGER, message TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_sync_configs_ds ON sync_configs(datasource_id)',
  `CREATE TABLE IF NOT EXISTS sync_locks (
    lock_name TEXT NOT NULL PRIMARY KEY, locked_by TEXT,
    locked_until BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dashboard_shares (
    id BIGSERIAL PRIMARY KEY, dashboard_id BIGINT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    expires_at TIMESTAMP, is_active SMALLINT NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id)',
  `CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'static',
    user_id BIGINT NOT NULL, key_hash TEXT NOT NULL UNIQUE, key_prefix TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP, last_used_at TIMESTAMP, created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)',
];