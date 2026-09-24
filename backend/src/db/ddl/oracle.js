module.exports = [
  `CREATE TABLE datasets (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL,
    original_file VARCHAR2(255) NOT NULL, row_count NUMBER(10) DEFAULT 0 NOT NULL,
    column_count NUMBER(10) DEFAULT 0 NOT NULL, table_name VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, source_type VARCHAR2(20) DEFAULT 'excel' NOT NULL,
    datasource_id VARCHAR2(36), schema_name VARCHAR2(255), table_name_ext VARCHAR2(255),
    build_definition CLOB, owner_id VARCHAR2(36)
  )`,
  `CREATE TABLE dataset_fields (
    id VARCHAR2(36) PRIMARY KEY, dataset_id VARCHAR2(36) NOT NULL,
    name VARCHAR2(255) NOT NULL, label VARCHAR2(255) NOT NULL, type VARCHAR2(50) NOT NULL,
    position NUMBER(10) DEFAULT 0 NOT NULL,
    CONSTRAINT fk_dataset_fields_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE metrics (
    id VARCHAR2(36) PRIMARY KEY, dataset_id VARCHAR2(36) NOT NULL,
    name VARCHAR2(255) NOT NULL, kind VARCHAR2(20) NOT NULL, definition CLOB DEFAULT '' NOT NULL,
    owner_id VARCHAR2(36), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_metrics_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_metrics_dataset ON metrics(dataset_id)',
  `CREATE TABLE charts (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL,
    dataset_id VARCHAR2(36) NOT NULL, chart_type VARCHAR2(50) NOT NULL, config CLOB NOT NULL,
    owner_id VARCHAR2(36), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_charts_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE dashboards (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL,
    layout CLOB NOT NULL, gap_x NUMBER(10) DEFAULT 12 NOT NULL, gap_y NUMBER(10) DEFAULT 12 NOT NULL,
    card_style CLOB NOT NULL, owner_id VARCHAR2(36), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  `CREATE TABLE users (
    id VARCHAR2(36) PRIMARY KEY, email VARCHAR2(255) NOT NULL,
    password_hash VARCHAR2(255) NOT NULL, name VARCHAR2(255) DEFAULT '' NOT NULL,
    is_active NUMBER(1) DEFAULT 1 NOT NULL, created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_users_email UNIQUE (email)
  )`,
  `CREATE TABLE roles (
    id VARCHAR2(36) PRIMARY KEY, code VARCHAR2(50) NOT NULL,
    name VARCHAR2(255) NOT NULL, description VARCHAR2(500) DEFAULT '' NOT NULL,
    is_builtin NUMBER(1) DEFAULT 0 NOT NULL, created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_roles_code UNIQUE (code)
  )`,
  `CREATE TABLE permissions (
    id VARCHAR2(36) PRIMARY KEY, code VARCHAR2(100) NOT NULL,
    name VARCHAR2(255) NOT NULL, description VARCHAR2(500) DEFAULT '' NOT NULL,
    CONSTRAINT uq_permissions_code UNIQUE (code)
  )`,
  `CREATE TABLE role_permissions (
    role_id VARCHAR2(36) NOT NULL, permission_id VARCHAR2(36) NOT NULL,
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE user_roles (
    user_id VARCHAR2(36) NOT NULL, role_id VARCHAR2(36) NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE refresh_tokens (
    id VARCHAR2(36) PRIMARY KEY, user_id VARCHAR2(36) NOT NULL,
    token_hash VARCHAR2(128) NOT NULL, expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE audit_logs (
    id VARCHAR2(36) PRIMARY KEY, user_id VARCHAR2(36), email VARCHAR2(255),
    action VARCHAR2(100) NOT NULL, resource_type VARCHAR2(50), resource_id VARCHAR2(255),
    detail CLOB, ip VARCHAR2(128), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  `CREATE TABLE data_sources (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL,
    type VARCHAR2(50) NOT NULL, config CLOB NOT NULL, is_active NUMBER(1) DEFAULT 1 NOT NULL,
    owner_id VARCHAR2(36), "mode" VARCHAR2(20) DEFAULT 'direct' NOT NULL, last_test_at TIMESTAMP,
    last_test_ok NUMBER(1), last_test_msg VARCHAR2(2000), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  'CREATE INDEX idx_data_sources_owner ON data_sources(owner_id)',
  'CREATE INDEX idx_data_sources_type ON data_sources(type)',
  'CREATE INDEX idx_datasets_owner ON datasets(owner_id)',
  'CREATE INDEX idx_charts_owner ON charts(owner_id)',
  'CREATE INDEX idx_dashboards_owner ON dashboards(owner_id)',
  `CREATE TABLE big_screens (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL, description CLOB NOT NULL,
    thumbnail CLOB NOT NULL, config CLOB NOT NULL, components CLOB NOT NULL,
    owner_id VARCHAR2(36), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  'CREATE INDEX idx_big_screens_owner ON big_screens(owner_id)',
  'CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash)',
  `CREATE TABLE sync_configs (
    id VARCHAR2(36) PRIMARY KEY, datasource_id VARCHAR2(36) NOT NULL,
    source_schema VARCHAR2(255), source_table VARCHAR2(255) NOT NULL, local_table VARCHAR2(255) NOT NULL,
    target_type VARCHAR2(20) DEFAULT 'app' NOT NULL, strategy VARCHAR2(20) DEFAULT 'incremental' NOT NULL,
    watermark_field VARCHAR2(255), watermark_kind VARCHAR2(20) DEFAULT 'id' NOT NULL, primary_key VARCHAR2(255),
    reconcile_delete NUMBER(1) DEFAULT 1 NOT NULL,
    sync_interval_seconds NUMBER(10) DEFAULT 86400 NOT NULL,
    last_sync_at TIMESTAMP, last_watermark VARCHAR2(255), last_sync_status VARCHAR2(20), last_sync_msg VARCHAR2(4000),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_sync_configs UNIQUE (datasource_id, source_schema, source_table),
    CONSTRAINT fk_sync_configs_ds FOREIGN KEY (datasource_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE sync_logs (
    id VARCHAR2(36) PRIMARY KEY, sync_config_id VARCHAR2(36) NOT NULL,
    started_at TIMESTAMP, finished_at TIMESTAMP, status VARCHAR2(20), rows_synced NUMBER(10), message VARCHAR2(4000),
    CONSTRAINT fk_sync_logs_cfg FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_sync_configs_ds ON sync_configs(datasource_id)',
  `CREATE TABLE sync_locks (
    lock_name VARCHAR2(128) NOT NULL PRIMARY KEY, locked_by VARCHAR2(64),
    locked_until NUMBER(20) DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  `CREATE TABLE sync_jobs (
    id VARCHAR2(36) PRIMARY KEY, sync_config_id VARCHAR2(36) NOT NULL,
    trigger_type VARCHAR2(20) DEFAULT 'schedule' NOT NULL, status VARCHAR2(20) DEFAULT 'queued' NOT NULL,
    attempts NUMBER(10) DEFAULT 0 NOT NULL, worker_id VARCHAR2(64), error VARCHAR2(4000),
    lease_until NUMBER(20) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, started_at TIMESTAMP, finished_at TIMESTAMP,
    CONSTRAINT fk_sync_jobs_cfg FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, id)',
  'CREATE INDEX idx_sync_jobs_config ON sync_jobs(sync_config_id)',
  `CREATE TABLE dashboard_shares (
    id VARCHAR2(36) PRIMARY KEY, dashboard_id VARCHAR2(36) NOT NULL,
    token VARCHAR2(64) NOT NULL, password_hash VARCHAR2(255) NOT NULL,
    expires_at TIMESTAMP, is_active NUMBER(1) DEFAULT 1 NOT NULL, created_by VARCHAR2(36) NOT NULL,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_dashboard_shares_token UNIQUE (token),
    CONSTRAINT fk_dashboard_shares_dash FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id)',
  `CREATE TABLE forms (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL,
    description VARCHAR2(1000) DEFAULT '' NOT NULL, status VARCHAR2(20) DEFAULT 'draft' NOT NULL,
    schema_json CLOB NOT NULL, submit_config CLOB NOT NULL, table_name VARCHAR2(255), dataset_id VARCHAR2(36),
    submission_seq NUMBER(19) DEFAULT 0 NOT NULL,
    owner_id VARCHAR2(36) NOT NULL, created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  'CREATE INDEX idx_forms_owner ON forms(owner_id)',
  `CREATE TABLE form_shares (
    id VARCHAR2(36) PRIMARY KEY, form_id VARCHAR2(36) NOT NULL,
    token VARCHAR2(64) NOT NULL, password_hash VARCHAR2(255) NOT NULL,
    expires_at TIMESTAMP, is_active NUMBER(1) DEFAULT 1 NOT NULL, created_by VARCHAR2(36) NOT NULL,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_form_shares_token UNIQUE (token),
    CONSTRAINT fk_form_shares_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_form_shares_form ON form_shares(form_id)',
  `CREATE TABLE big_screen_shares (
    id VARCHAR2(36) PRIMARY KEY, big_screen_id VARCHAR2(36) NOT NULL,
    token VARCHAR2(64) NOT NULL, password_hash VARCHAR2(255) NOT NULL,
    expires_at TIMESTAMP, is_active NUMBER(1) DEFAULT 1 NOT NULL, created_by VARCHAR2(36) NOT NULL,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_big_screen_shares_token UNIQUE (token),
    CONSTRAINT fk_big_screen_shares_scr FOREIGN KEY (big_screen_id) REFERENCES big_screens(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX idx_big_screen_shares_screen ON big_screen_shares(big_screen_id)',
  `CREATE TABLE big_screen_templates (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(100) NOT NULL, description VARCHAR2(500) DEFAULT '' NOT NULL,
    thumbnail VARCHAR2(1000) DEFAULT '' NOT NULL, config NCLOB NOT NULL, components NCLOB NOT NULL,
    owner_id VARCHAR2(36), created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
  )`,
  'CREATE INDEX idx_big_screen_templates_owner ON big_screen_templates(owner_id)',
  `CREATE TABLE api_keys (
    id VARCHAR2(36) PRIMARY KEY, name VARCHAR2(255) NOT NULL, type VARCHAR2(16) DEFAULT 'static' NOT NULL,
    user_id VARCHAR2(36) NOT NULL, key_hash VARCHAR2(64) NOT NULL, key_prefix VARCHAR2(32) NOT NULL,
    scopes VARCHAR2(255) DEFAULT '[]' NOT NULL, status VARCHAR2(16) DEFAULT 'active' NOT NULL,
    expires_at TIMESTAMP, last_used_at TIMESTAMP, created_by VARCHAR2(36),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_api_keys_hash UNIQUE (key_hash)
  )`,
  'CREATE INDEX idx_api_keys_user ON api_keys(user_id)',
];