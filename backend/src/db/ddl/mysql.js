module.exports = [
  `CREATE TABLE IF NOT EXISTS datasets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, original_file VARCHAR(255) NOT NULL,
    row_count INT NOT NULL DEFAULT 0, column_count INT NOT NULL DEFAULT 0,
    table_name VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_type VARCHAR(20) NOT NULL DEFAULT 'excel', datasource_id BIGINT, schema_name VARCHAR(255),
    table_name_ext VARCHAR(255), build_definition LONGTEXT, owner_id BIGINT
  )`,
`CREATE TABLE IF NOT EXISTS dataset_fields (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, dataset_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL, label VARCHAR(255) NOT NULL, type VARCHAR(50) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_dataset_fields_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, dataset_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL, kind VARCHAR(20) NOT NULL, definition TEXT,
    owner_id BIGINT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_metrics_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
    KEY idx_metrics_dataset (dataset_id)
  )`,
  `CREATE TABLE IF NOT EXISTS charts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, dataset_id BIGINT NOT NULL,
    chart_type VARCHAR(50) NOT NULL, config LONGTEXT NOT NULL, owner_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_charts_dataset (dataset_id),
    CONSTRAINT fk_charts_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dashboards (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, layout LONGTEXT NOT NULL,
    gap_x INT NOT NULL DEFAULT 12, gap_y INT NOT NULL DEFAULT 12, card_style LONGTEXT NOT NULL,
    owner_id BIGINT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '', is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL, name VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '', is_builtin TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_roles_code (code)
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    UNIQUE KEY uq_permissions_code (code)
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL, permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL, role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL,
    token_hash VARCHAR(128) NOT NULL, expires_at DATETIME NOT NULL, revoked_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_refresh_tokens_hash (token_hash),
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT, email VARCHAR(255), action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50), resource_id VARCHAR(255), detail LONGTEXT, ip VARCHAR(128),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS data_sources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(50) NOT NULL,
    config LONGTEXT NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, owner_id BIGINT,
    mode VARCHAR(20) NOT NULL DEFAULT 'direct', last_test_at DATETIME, last_test_ok TINYINT(1), last_test_msg VARCHAR(2000),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE INDEX IF NOT EXISTS idx_data_sources_owner ON data_sources(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type)',
  'CREATE INDEX IF NOT EXISTS idx_datasets_owner ON datasets(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_charts_owner ON charts(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id)',
  `CREATE TABLE IF NOT EXISTS sync_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, datasource_id BIGINT NOT NULL,
    source_schema VARCHAR(255), source_table VARCHAR(255) NOT NULL, local_table VARCHAR(255) NOT NULL,
    target_type VARCHAR(20) NOT NULL DEFAULT 'app', strategy VARCHAR(20) NOT NULL DEFAULT 'incremental',
    watermark_field VARCHAR(255), watermark_kind VARCHAR(20) NOT NULL DEFAULT 'id', primary_key VARCHAR(255),
    sync_interval_seconds INT NOT NULL DEFAULT 86400,
    last_sync_at DATETIME, last_watermark VARCHAR(255), last_sync_status VARCHAR(20), last_sync_msg TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sync_configs (datasource_id, source_schema, source_table),
    CONSTRAINT fk_sync_configs_ds FOREIGN KEY (datasource_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sync_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sync_config_id BIGINT NOT NULL,
    started_at DATETIME, finished_at DATETIME, status VARCHAR(20), rows_synced INT, message TEXT,
    CONSTRAINT fk_sync_logs_cfg FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS idx_sync_configs_ds ON sync_configs(datasource_id)',
  `CREATE TABLE IF NOT EXISTS sync_locks (
    lock_name VARCHAR(128) NOT NULL PRIMARY KEY, locked_by VARCHAR(64),
    locked_until BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS dashboard_shares (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, dashboard_id BIGINT NOT NULL,
    token VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME, is_active TINYINT(1) NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dashboard_shares_token (token),
    KEY idx_dashboard_shares_dashboard (dashboard_id),
    CONSTRAINT fk_dashboard_shares_dash FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(16) NOT NULL DEFAULT 'static',
    user_id BIGINT NOT NULL, key_hash VARCHAR(64) NOT NULL, key_prefix VARCHAR(32) NOT NULL,
    scopes VARCHAR(255) NOT NULL DEFAULT '[]', status VARCHAR(16) NOT NULL DEFAULT 'active',
    expires_at DATETIME, last_used_at DATETIME, created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_api_keys_hash (key_hash),
    KEY idx_api_keys_user (user_id)
  )`,
];