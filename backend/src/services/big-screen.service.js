const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const HttpError = require('../utils/http-error');

/** 解析 JSON 字段（存储为字符串，读取还原对象/数组） */
function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function renderScreen(d) {
  if (!d) return d;
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? '',
    thumbnail: d.thumbnail ?? '',
    config: safeParse(d.config, {}),
    components: safeParse(d.components, []),
    ownerId: d.ownerId ?? d.owner_id ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

const SELECT_SCREEN = `
  SELECT id, name, description, thumbnail, config, components, owner_id AS ownerId,
         created_at AS createdAt, updated_at AS updatedAt
  FROM big_screens
`;

async function listBigScreens(where = '') {
  return (await db
    .prepare(`${SELECT_SCREEN}${where ? ' WHERE ' + where : ''} ORDER BY updated_at DESC`)
    .all())
    .map(renderScreen);
}

async function getBigScreen(id) {
  return renderScreen(await db.prepare(`${SELECT_SCREEN} WHERE id = ?`).get(Number(id)));
}

async function getBigScreenOrThrow(id) {
  const s = await getBigScreen(id);
  if (!s) throw new HttpError(404, `大屏不存在: id=${id}`);
  return s;
}

async function createBigScreen(body = {}, ownerId = null) {
  const name = String(body.name || '').trim().slice(0, 100);
  if (!name) throw new HttpError(400, '大屏名称不能为空');
  const description = String(body.description || '').slice(0, 500);
  const thumbnail = String(body.thumbnail || '');
  const config = body.config === undefined || body.config === null ? '{}' :
    (typeof body.config === 'string' ? body.config : JSON.stringify(body.config));
  const components = body.components === undefined || body.components === null ? '[]' :
    (typeof body.components === 'string' ? body.components : JSON.stringify(body.components));
  const info = await db
    .prepare('INSERT INTO big_screens (name, description, thumbnail, config, components, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, description, thumbnail, config, components, ownerId == null ? null : Number(ownerId));
  return getBigScreen(Number(info.lastInsertRowid));
}

async function updateBigScreen(id, body = {}) {
  const existing = await getBigScreenOrThrow(id);
  const name = body.name !== undefined ? String(body.name || '').trim().slice(0, 100) : existing.name;
  if (!name) throw new HttpError(400, '大屏名称不能为空');
  const description = body.description !== undefined ? String(body.description || '').slice(0, 500) : existing.description;
  const thumbnail = body.thumbnail !== undefined ? String(body.thumbnail || '') : existing.thumbnail;
  let config = existing.config;
  if (body.config !== undefined) {
    if (typeof body.config === 'string') config = safeParse(body.config, {});
    else config = body.config ?? {};
  }
  let components = existing.components;
  if (body.components !== undefined) {
    if (typeof body.components === 'string') components = safeParse(body.components, []);
    else components = body.components ?? [];
  }
  await db.prepare("UPDATE big_screens SET name = ?, description = ?, thumbnail = ?, config = ?, components = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, description, thumbnail, JSON.stringify(config), JSON.stringify(components), Number(id));
  return getBigScreen(id);
}

async function deleteBigScreen(id) {
  await getBigScreenOrThrow(id);
  await db.prepare('DELETE FROM big_screens WHERE id = ?').run(Number(id));
  return true;
}

// ---------- 分享（big_screen_shares） ----------

const SELECT_SHARE = `
  SELECT s.id, s.big_screen_id AS bigScreenId, s.big_screen_id AS big_screen_id, s.token,
         s.password_hash AS passwordHash, s.password_hash AS password_hash,
         s.expires_at AS expiresAt, s.expires_at AS expires_at, s.is_active AS isActive,
         s.is_active AS is_active, s.created_by AS createdBy, s.created_by AS created_by,
         s.created_at AS createdAt, s.created_at AS created_at, s.updated_at AS updatedAt,
         s.updated_at AS updated_at
  FROM big_screen_shares s
`;

function generateToken() {
  return crypto.randomBytes(16).toString('base64url');
}

function stripPassword(row) {
  if (!row) return row;
  const { passwordHash, password_hash, ...rest } = row;
  return { ...rest, hasPassword: !!passwordHash, isActive: Number(row.isActive !== undefined ? row.isActive : row.is_active) };
}

function validatePassword(password) {
  if (password === null || password === undefined || password === '') return '';
  const v = String(password);
  if (v.length < 4 || v.length > 64) throw new HttpError(400, '分享密码需为 4-64 位');
  return v;
}

async function hashPassword(password) {
  const v = validatePassword(password);
  return v ? await bcrypt.hash(v, 10) : '';
}

function parseExpiresAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new HttpError(400, '过期时间格式不正确');
  if (d.getTime() <= Date.now()) throw new HttpError(400, '过期时间必须晚于当前时间');
  return d.toISOString();
}

async function getShare(id) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.id = ?`).get(Number(id))) || null;
}

async function getShareOrThrow(id) {
  const s = await getShare(id);
  if (!s) throw new HttpError(404, '分享不存在');
  return s;
}

async function getShareByToken(token) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.token = ?`).get(String(token || ''))) || null;
}

async function createShare({ bigScreenId, password, expiresAt, userId }) {
  await getBigScreenOrThrow(Number(bigScreenId));
  const hash = await hashPassword(password);
  const info = await db.prepare(
    'INSERT INTO big_screen_shares (big_screen_id, token, password_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(Number(bigScreenId), generateToken(), hash, parseExpiresAt(expiresAt), Number(userId));
  return stripPassword(await getShare(Number(info.lastInsertRowid)));
}

async function listShares(bigScreenId) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.big_screen_id = ? ORDER BY s.id DESC`).all(Number(bigScreenId)))
    .map(stripPassword);
}

async function updateShare(id, body = {}) {
  await getShareOrThrow(id);
  const fields = [];
  const params = [];
  if (body.password !== undefined) {
    fields.push('password_hash = ?');
    params.push(await hashPassword(body.password));
  }
  if (body.expiresAt !== undefined) {
    fields.push('expires_at = ?');
    params.push(parseExpiresAt(body.expiresAt));
  }
  if (body.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(body.isActive ? 1 : 0);
  }
  if (fields.length) {
    params.push(id);
    await db.prepare(`UPDATE big_screen_shares SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  }
  return stripPassword(await getShare(id));
}

async function deleteShare(id) {
  await getShareOrThrow(id);
  await db.prepare('DELETE FROM big_screen_shares WHERE id = ?').run(Number(id));
  return true;
}

function shareState(share, now = Date.now()) {
  if (!share) return 'not_found';
  if (!Number(share.isActive !== undefined ? share.isActive : share.is_active)) return 'inactive';
  const exp = share.expiresAt !== undefined ? share.expiresAt : share.expires_at;
  if (exp && new Date(exp).getTime() <= now) return 'expired';
  return 'active';
}

function assertShareUsable(share, now = Date.now()) {
  const st = shareState(share, now);
  if (st === 'inactive') throw new HttpError(403, '分享已被关闭', null, 40302);
  if (st === 'expired') throw new HttpError(403, '分享链接已过期', null, 40301);
  if (st === 'not_found') throw new HttpError(404, '分享不存在或已被删除');
  return share;
}

/** 公开渲染视图：仅暴露 id/name/description/config/components */
async function getBigScreenRenderView(bigScreenId) {
  const s = await getBigScreenOrThrow(bigScreenId);
  return { id: s.id, name: s.name, description: s.description, config: s.config, components: s.components };
}

module.exports = {
  listBigScreens,
  getBigScreen,
  getBigScreenOrThrow,
  createBigScreen,
  updateBigScreen,
  deleteBigScreen,
  generateToken,
  stripPassword,
  getShare,
  getShareOrThrow,
  getShareByToken,
  createShare,
  listShares,
  updateShare,
  deleteShare,
  shareState,
  assertShareUsable,
  getBigScreenRenderView,
};
