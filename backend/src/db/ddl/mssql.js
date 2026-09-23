module.exports = [
  `CREATE TABLE datasets (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255) NOT NULL, original_file NVARCHAR(255) NOT NULL,
    row_count INT NOT NULL DEFAULT 0, column_count INT NOT NULL DEFAULT 0,
    table_name NVARCHAR(255) NOT NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    source_type NVARCHAR(20) NOT NULL DEFAULT 'excel', datasource_id BIGINT, schema_name NVARCHAR(255),
    table_name_ext NVARCHAR(255), build_definition NVARCHAR(MAX), owner_id BIGINT
  )`,
  `CREATE TABLE dataset_fields (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, dataset_id BIGINT NOT NULL,
    name NVARCHAR(255) NOT NULL, label NVARCHAR(255) NOT NULL, type NVARCHAR(50) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_dataset_fields_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE metrics (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, dataset_id BIGINT NOT NULL,
    name NVARCHAR(255) NOT NULL, kind NVARCHAR(20) NOT NULL, definition NVARCHAR(MAX) NOT NULL,
    owner_id BIGINT, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT fk_metrics_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_metrics_dataset ON metrics(dataset_id)',
  `CREATE TABLE charts (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255) NOT NULL, dataset_id BIGINT NOT NULL,
    chart_type NVARCHAR(50) NOT NULL, config NVARCHAR(MAX) NOT NULL, owner_id BIGINT,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT fk_charts_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE dashboards (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255) NOT NULL, layout NVARCHAR(MAX) NOT NULL,
    gap_x INT NOT NULL DEFAULT 12, gap_y INT NOT NULL DEFAULT 12, card_style NVARCHAR(MAX) NOT NULL,
    owner_id BIGINT, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  )`,
  `CREATE TABLE users (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, email NVARCHAR(255) NOT NULL, password_hash NVARCHAR(255) NOT NULL,
    name NVARCHAR(255) NOT NULL DEFAULT '', is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_users_email UNIQUE (email)
  )`,
  `CREATE TABLE roles (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, code NVARCHAR(50) NOT NULL, name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500) NOT NULL DEFAULT '', is_builtin BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_roles_code UNIQUE (code)
  )`,
  `CREATE TABLE permissions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, code NVARCHAR(100) NOT NULL, name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT uq_permissions_code UNIQUE (code)
  )`,
  `CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL, permission_id BIGINT NOT NULL,
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE user_roles (
    user_id BIGINT NOT NULL, role_id BIGINT NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE refresh_tokens (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, user_id BIGINT NOT NULL,
    token_hash NVARCHAR(128) NOT NULL, expires_at DATETIME2 NOT NULL, revoked_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE audit_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, user_id BIGINT, email NVARCHAR(255), action NVARCHAR(100) NOT NULL,
    resource_type NVARCHAR(50), resource_id NVARCHAR(255), detail NVARCHAR(MAX), ip NVARCHAR(128),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  )`,
  `CREATE TABLE data_sources (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255) NOT NULL, type NVARCHAR(50) NOT NULL,
    config NVARCHAR(MAX) NOT NULL, is_active BIT NOT NULL DEFAULT 1, owner_id BIGINT,
    mode NVARCHAR(20) NOT NULL DEFAULT 'direct', last_test_at DATETIME2, last_test_ok BIT, last_test_msg NVARCHAR(2000),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  )`,
  'CREATE INDEX idx_data_sources_owner ON data_sources(owner_id)',
  'CREATE INDEX idx_data_sources_type ON data_sources(type)',
  'CREATE INDEX idx_datasets_owner ON datasets(owner_id)',
  'CREATE INDEX idx_charts_owner ON charts(owner_id)',
  'CREATE INDEX idx_dashboards_owner ON dashboards(owner_id)',
  `CREATE TABLE big_screens (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255) NOT NULL, description NVARCHAR(MAX) NOT NULL DEFAULT '',
    thumbnail NVARCHAR(MAX) NOT NULL DEFAULT '', config NVARCHAR(MAX) NOT NULL DEFAULT '{}', components NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    owner_id BIGINT, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  )`,
  'CREATE INDEX idx_big_screens_owner ON big_screens(owner_id)',
  'CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash)',
  `CREATE TABLE sync_configs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, datasource_id BIGINT NOT NULL,
    source_schema NVARCHAR(255), source_table NVARCHAR(255) NOT NULL, local_table NVARCHAR(255) NOT NULL,
    target_type NVARCHAR(20) NOT NULL DEFAULT 'app', strategy NVARCHAR(20) NOT NULL DEFAULT 'incremental',
    watermark_field NVARCHAR(255), watermark_kind NVARCHAR(20) NOT NULL DEFAULT 'id', primary_key NVARCHAR(255),
    reconcile_delete INT NOT NULL DEFAULT 1,
    sync_interval_seconds INT NOT NULL DEFAULT 86400,
    last_sync_at DATETIME2, last_watermark NVARCHAR(255), last_sync_status NVARCHAR(20), last_sync_msg NVARCHAR(MAX),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_sync_configs UNIQUE (datasource_id, source_schema, source_table),
    CONSTRAINT fk_sync_configs_ds FOREIGN KEY (datasource_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE sync_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, sync_config_id BIGINT NOT NULL,
    started_at DATETIME2, finished_at DATETIME2, status NVARCHAR(20), rows_synced INT, message NVARCHAR(MAX),
    CONSTRAINT fk_sync_logs_cfg FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_sync_configs_ds ON sync_configs(datasource_id)',
  `CREATE TABLE sync_locks (
    lock_name NVARCHAR(128) NOT NULL PRIMARY KEY, locked_by NVARCHAR(64),
    locked_until BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  )`,
  `CREATE TABLE sync_jobs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, sync_config_id BIGINT NOT NULL,
    trigger_type NVARCHAR(20) NOT NULL DEFAULT 'schedule', status NVARCHAR(20) NOT NULL DEFAULT 'queued',
    attempts INT NOT NULL DEFAULT 0, worker_id NVARCHAR(64), error NVARCHAR(MAX), lease_until BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), started_at DATETIME2, finished_at DATETIME2,
    CONSTRAINT fk_sync_jobs_cfg FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, id)',
  'CREATE INDEX idx_sync_jobs_config ON sync_jobs(sync_config_id)',
  `CREATE TABLE dashboard_shares (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, dashboard_id BIGINT NOT NULL,
    token NVARCHAR(64) NOT NULL, password_hash NVARCHAR(255) NOT NULL,
    expires_at DATETIME2, is_active BIT NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_dashboard_shares_token UNIQUE (token),
    CONSTRAINT fk_dashboard_shares_dash FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id)',
  `CREATE TABLE big_screen_shares (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, big_screen_id BIGINT NOT NULL,
    token NVARCHAR(64) NOT NULL, password_hash NVARCHAR(255) NOT NULL,
    expires_at DATETIME2, is_active BIT NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_big_screen_shares_token UNIQUE (token),
    CONSTRAINT fk_big_screen_shares_scr FOREIGN KEY (big_screen_id) REFERENCES big_screens(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_big_screen_shares_screen ON big_screen_shares(big_screen_id)',
  `CREATE TABLE big_screen_templates (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100) NOT NULL, description NVARCHAR(500) NOT NULL DEFAULT '',
    thumbnail NVARCHAR(1000) NOT NULL DEFAULT '', config NVARCHAR(MAX) NOT NULL, components NVARCHAR(MAX) NOT NULL,
    owner_id BIGINT, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  )`,
  'CREATE INDEX idx_big_screen_templates_owner ON big_screen_templates(owner_id)',
  `CREATE TABLE api_keys (
    id BIGINT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255) NOT NULL, type NVARCHAR(16) NOT NULL DEFAULT 'static',
    user_id BIGINT NOT NULL, key_hash NVARCHAR(64) NOT NULL, key_prefix NVARCHAR(32) NOT NULL,
    scopes NVARCHAR(255) NOT NULL DEFAULT '[]', status NVARCHAR(16) NOT NULL DEFAULT 'active',
    expires_at DATETIME2, last_used_at DATETIME2, created_by BIGINT,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_api_keys_hash UNIQUE (key_hash)
  )`,
  'CREATE INDEX idx_api_keys_user ON api_keys(user_id)',
];