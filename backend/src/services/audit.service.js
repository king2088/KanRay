const db = require('../db');

async function log(info, req) {
  const ip = req?.ip || req?.socket?.remoteAddress || '';
  await db.prepare(
    'INSERT INTO audit_logs (user_id, email, action, resource_type, resource_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(info.userId ?? null, info.email ?? null, info.action, info.resourceType ?? null, String(info.resourceId ?? '') || null, info.detail ? JSON.stringify(info.detail) : null, ip);
}

async function list({ page = 1, pageSize = 20 } = {}) {
  const total = await db.prepare('SELECT COUNT(*) n FROM audit_logs').get().n;
  const list = await db.prepare(
    'SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(pageSize, (page - 1) * pageSize);
  return { list, total };
}

module.exports = { log, list };