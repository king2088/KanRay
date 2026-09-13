process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const db = require('../../src/db');
const { seed } = require('../../src/seeds');

function resetDb() {
  db.exec(`
    DELETE FROM user_roles; DELETE FROM role_permissions; DELETE FROM refresh_tokens;
    DELETE FROM audit_logs; DELETE FROM users; DELETE FROM roles; DELETE FROM permissions;
    DELETE FROM datasets; DELETE FROM charts; DELETE FROM dashboards;
    DELETE FROM data_sources;
  `);
  seed();
}

module.exports = { db, seed, resetDb };
