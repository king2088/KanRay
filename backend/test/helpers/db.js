process.env.DB_PATH = `/tmp/kanban-test-${process.pid}.db`;
const db = require('../../src/db');
const { seed } = require('../../src/seeds');
const { uuidv7 } = require('../../src/utils/uuidv7');

let seededAdminId = null;

async function resetDb() {
  await db.exec(`
    DELETE FROM form_shares; DELETE FROM dashboard_shares; DELETE FROM big_screen_shares; DELETE FROM user_roles; DELETE FROM role_permissions; DELETE FROM refresh_tokens;
    DELETE FROM audit_logs; DELETE FROM users; DELETE FROM roles; DELETE FROM permissions;
    DELETE FROM datasets; DELETE FROM charts; DELETE FROM dashboards; DELETE FROM big_screens;
    DELETE FROM forms; DELETE FROM data_sources;
  `);
  const s = await seed();
  seededAdminId = s.adminId;
}

/** 最近一次 resetDb 生成的内置管理员 id（uuid7 字符串） */
function adminId() {
  if (!seededAdminId) throw new Error('请先调用 resetDb()');
  return seededAdminId;
}

module.exports = { db, seed, resetDb, adminId, uuidv7 };