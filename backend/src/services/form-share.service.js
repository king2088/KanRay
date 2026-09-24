const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const HttpError = require('../utils/http-error');
const { getForm, fillSchema } = require('./form.service');
const { uuidv7 } = require('../utils/uuidv7');

const SELECT_SHARE = `
  SELECT s.id, s.form_id AS formId, s.form_id AS form_id, s.token,
         s.password_hash AS passwordHash, s.password_hash AS password_hash,
         s.expires_at AS expiresAt, s.expires_at AS expires_at, s.is_active AS isActive,
         s.is_active AS is_active, s.created_by AS createdBy, s.created_by AS created_by,
         s.created_at AS createdAt, s.created_at AS created_at, s.updated_at AS updatedAt,
         s.updated_at AS updated_at
  FROM form_shares s
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
  return (await db.prepare(`${SELECT_SHARE} WHERE s.id = ?`).get(String(id))) || null;
}

async function getShareOrThrow(id) {
  const s = await getShare(id);
  if (!s) throw new HttpError(404, '分享不存在');
  return s;
}

async function getShareByToken(token) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.token = ?`).get(String(token || ''))) || null;
}

async function createShare({ formId, password, expiresAt, userId }) {
  const form = await getForm(String(formId));
  if (!form) throw new HttpError(404, '表单不存在');
  const hash = await hashPassword(password);
  const shareId = uuidv7();
  const info = await db.prepare(
    'INSERT INTO form_shares (id, form_id, token, password_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(shareId, String(formId), generateToken(), hash, parseExpiresAt(expiresAt), userId == null ? null : String(userId));
  return stripPassword(await getShare(shareId));
}

async function listShares(formId) {
  return (await db.prepare(`${SELECT_SHARE} WHERE s.form_id = ? ORDER BY s.id DESC`).all(String(formId)))
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
    params.push(String(id));
    await db.prepare(`UPDATE form_shares SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  }
  return stripPassword(await getShare(id));
}

async function deleteShare(id) {
  await getShareOrThrow(id);
  await db.prepare('DELETE FROM form_shares WHERE id = ?').run(String(id));
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

async function getFillView(share) {
  const form = await getForm(String(share.formId));
  if (!form) throw new HttpError(404, '表单不存在或已被删除');
  if (form.status !== 'published') throw new HttpError(403, '表单当前不可填写', null, 40302);
  return { share: stripPassword(share), form: fillSchema(form) };
}

module.exports = {
  generateToken,
  createShare,
  listShares,
  getShare,
  getShareOrThrow,
  getShareByToken,
  updateShare,
  deleteShare,
  shareState,
  assertShareUsable,
  getFillView,
};