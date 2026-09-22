process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const db = require('../../src/db');
const { seed } = require('../../src/seeds');

async function resetDb() {
  await db.exec(`
    DELETE FROM dashboard_shares; DELETE FROM big_screen_shares; DELETE FROM user_roles; DELETE FROM role_permissions; DELETE FROM refresh_tokens;
    DELETE FROM audit_logs; DELETE FROM users; DELETE FROM roles; DELETE FROM permissions;
    DELETE FROM datasets; DELETE FROM charts; DELETE FROM dashboards; DELETE FROM big_screens;
    DELETE FROM data_sources;
  `);
  await seed();
}

module.exports = { db, seed, resetDb };