const crypto = require('crypto');
const db = require('../db');
const HttpError = require('../utils/http-error');

// 开放 API 允许的 scope 白名单（与 /api/open 数据消费端点一一对应）
const OPEN_SCOPES = ['chart:read', 'dataset:read', 'dashboard:read'];

const KEY_TYPES = { static: 'kan_live_', pat: 'kan_pat_' };

const SELECT = `
  SELECT id, name, type,
         user_id AS userId, user_id AS user_id,
         key_hash AS keyHash, key_hash AS key_hash,
         key_prefix AS keyPrefix, key_prefix AS key_prefix,
         scopes, status,
         expires_at AS expiresAt, expires_at AS expires_at,
         last_used_at AS lastUsedAt, last_used_at AS last_used_at,
         created_by AS createdBy, created_by AS created_by,
         created_at AS createdAt, created_at AS created_at,
         updated_at AS updatedAt, updated_at AS updated_at
  FROM api_keys
`;

function hashKey(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}

function generatePlaintext(type = 'static') {
  const prefix = KEY_TYPES[type] || KEY_TYPES.static;
  return `${prefix}${crypto.randomBytes(24).toString('base64url')}`;
}

function parseScopes(scopes) {
  if (scopes === null || scopes === undefined || scopes === '') return [];
  if (Array.isArray(scopes)) return scopes;
  try {
    const parsed = JSON.parse(scopes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stripSecret(row) {
  if (!row) return row;
  const { keyHash, key_hash, scopes, ...rest } = row;
  return { ...rest, scopes: parseScopes(scopes) };
}

function validateName(name) {
  if (!name || !String(name).trim() || String(name).length > 100) {
    throw new HttpError(400, 'Key 名称需为 1-100 字符');
  }
  return String(name).trim();
}

function validateScopes(scopes, type) {
  const arr = parseScopes(scopes);
  if (type === 'pat') return []; // PAT 继承本人全部权限，不接受自定义 scope
  const unknown = arr.filter((s) => !OPEN_SCOPES.includes(s));
  if (unknown.length) throw new HttpError(400, `不支持的 scope: ${unknown.join(', ')}`);
  return [...new Set(arr)];
}

function parseExpiresAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new HttpError(400, '过期时间格式不正确');
  if (d.getTime() <= Date.now()) throw new HttpError(400, '过期时间必须晚于当前时间');
  return d.toISOString();
}

async function create({ name, type = 'static', userId, scopes = [], expiresAt = null, createdBy = null }) {
  if (!userId || !Number.isFinite(Number(userId))) throw new HttpError(400, '缺少映射用户');
  const plain = generatePlaintext(type);
  const cleanScopes = validateScopes(scopes, type);
  const inserted = await db.prepare(
    'INSERT INTO api_keys (name, type, user_id, key_hash, key_prefix, scopes, status, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    validateName(name), type, Number(userId), hashKey(plain), plain.slice(0, 12),
    JSON.stringify(cleanScopes), 'active', parseExpiresAt(expiresAt),
    createdBy ? Number(createdBy) : null
  );
  const row = await getOrThrow(inserted.lastInsertRowid);
  return { plaintext: plain, key: stripSecret(row) };
}

async function getOrThrow(id) {
  const row = await db.prepare(`${SELECT} WHERE id = ?`).get(Number(id));
  if (!row) throw new HttpError(404, 'API Key 不存在');
  return row;
}

async function getByHash(hash) {
  return (await db.prepare(`${SELECT} WHERE key_hash = ?`).get(hash)) || null;
}

async function list({ type, userId } = {}) {
  const conds = [];
  const params = [];
  if (type) { conds.push('type = ?'); params.push(type); }
  if (userId) { conds.push('user_id = ?'); params.push(Number(userId)); }
  const rows = await db.prepare(`${SELECT}${conds.length ? ' WHERE ' + conds.join(' AND ') : ''} ORDER BY id DESC`).all(...params);
  return rows.map(stripSecret);
}

async function rotate(id, { userId } = {}) {
  const row = await getOrThrow(id);
  if (userId !== undefined && Number(row.user_id) !== Number(userId)) throw new HttpError(403, '只能操作自己的令牌');
  const plain = generatePlaintext(row.type);
  await db.prepare('UPDATE api_keys SET key_hash = ?, key_prefix = ?, updated_at = ? WHERE id = ?')
    .run(hashKey(plain), plain.slice(0, 12), new Date().toISOString(), Number(id));
  const updated = await getOrThrow(id);
  return { plaintext: plain, key: stripSecret(updated) };
}

async function setStatus(id, status) {
  if (!['active', 'revoked'].includes(status)) throw new HttpError(400, '非法状态');
  const row = await getOrThrow(id);
  await db.prepare('UPDATE api_keys SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), Number(id));
  return stripSecret(await getOrThrow(id));
}

async function updateMeta(id, { name, scopes, expiresAt, isActive }) {
  const row = await getOrThrow(id);
  const sets = [];
  const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(validateName(name)); }
  if (scopes !== undefined) { sets.push('scopes = ?'); params.push(JSON.stringify(validateScopes(scopes, row.type))); }
  if (expiresAt !== undefined) { sets.push('expires_at = ?'); params.push(parseExpiresAt(expiresAt)); }
  if (isActive !== undefined) {
    const st = isActive ? 'active' : 'revoked';
    sets.push('status = ?');
    params.push(st);
  }
  if (!sets.length) return stripSecret(await getOrThrow(id));
  sets.push('updated_at = ?');
  params.push(new Date().toISOString(), Number(id));
  await db.prepare(`UPDATE api_keys SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return stripSecret(await getOrThrow(id));
}

async function touchLastUsed(id) {
  await db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), Number(id));
}

async function hardDelete(id, { userId } = {}) {
  const row = await getOrThrow(id);
  if (userId !== undefined && Number(row.user_id) !== Number(userId)) throw new HttpError(403, '只能操作自己的令牌');
  await db.prepare('DELETE FROM api_keys WHERE id = ?').run(Number(id));
  return true;
}

// 生效权限 = key.scopes ∩ 用户自身权限（static）；PAT 直接继承本人权限
function effectivePermissions(row, userPermissions) {
  const perm = userPermissions || [];
  if (row.type === 'pat') return perm;
  const scopeSet = new Set(parseScopes(row.scopes));
  return perm.filter((p) => scopeSet.has(p));
}

async function userPermissions(userId) {
  const rows = await db.prepare(
    `SELECT p.code FROM role_permissions rp
     JOIN user_roles ur ON ur.role_id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = ?`
  ).all(Number(userId));
  return rows.map((r) => r.code);
}

module.exports = {
  OPEN_SCOPES, hashKey, generatePlaintext, parseScopes, stripSecret,
  create, getOrThrow, getByHash, list, rotate, setStatus, updateMeta,
  touchLastUsed, hardDelete, effectivePermissions, userPermissions,
};