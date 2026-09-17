const db = require('../db');
const config = require('../config');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit; // validate: custom keyGenerator 需经官方 IP helper 兜底
const HttpError = require('../utils/http-error');
const apiKeyService = require('../services/api-key.service');
const audit = require('../services/audit.service');

const KEY_RE = /^kan_(?:live|pat)_.+/;

function extractKey(req) {
  const auth = req.headers.authorization || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!KEY_RE.test(token)) token = '';
  if (!token) {
    const x = req.headers['x-api-key'];
    if (typeof x === 'string' && KEY_RE.test(x.trim())) token = x.trim();
  }
  return token || null;
}

// 开放 API 凭证中间件：仅接受 kan_* API Key / PAT，解析出 principal
async function openAuth(req, res, next) {
  const raw = extractKey(req);
  if (!raw) throw new HttpError(401, '缺少 API Key');
  const key = await apiKeyService.getByHash(apiKeyService.hashKey(raw));
  if (!key) throw new HttpError(401, 'API Key 无效');
  if (key.status !== 'active') throw new HttpError(401, 'API Key 已被吊销');
  const exp = key.expiresAt || key.expires_at;
  if (exp && new Date(exp).getTime() <= Date.now()) throw new HttpError(401, 'API Key 已过期');
  const userRow = await db.prepare('SELECT id, email, name, is_active FROM users WHERE id = ?').get(Number(key.user_id || key.userId));
  if (!userRow) throw new HttpError(401, '账号不存在');
  if (!Number(userRow.is_active)) throw new HttpError(403, '账号已被禁用');

  const permissions = await apiKeyService.userPermissions(userRow.id);
  const effective = apiKeyService.effectivePermissions(key, permissions);
  req.principal = {
    key,
    user: { id: userRow.id, email: userRow.email, name: userRow.name, isActive: Number(userRow.is_active) },
    permissions,
    effective,
  };

  // last_used_at 节流更新（>60s 才写）
  const lastAt = new Date(key.lastUsedAt || key.last_used_at || 0).getTime();
  if (!Number.isFinite(lastAt) || Date.now() - lastAt > 60 * 1000) {
    await apiKeyService.touchLastUsed(key.id);
  }
  next();
}

// scope 门：open-api 数据出口所需的 permission 必须在 key 生效权限内
function requireScope(permission) {
  return (req, res, next) => {
    if (!req.principal) throw new HttpError(401, '未认证');
    if (!req.principal.effective.includes(permission)) {
      throw new HttpError(403, `该 API Key 无权执行操作: ${permission}`);
    }
    next();
  };
}

// 按 key 限流工厂（keyGenerator 取 keyHash；未解析到 principal 时回退 IP）
function createOpenRateLimit(max = config.openApi.ratePerMin) {
  return rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, id) => req.principal?.key?.keyHash || ipKeyGenerator(req, id),
    handler: (req, res) => res.status(429).json({ code: 429, message: '请求过于频繁，请稍后再试', data: null }),
  });
}

const openRateLimit = createOpenRateLimit();

// 数据出口审计钩子：取数/聚合/导出类端点调用
async function auditExit(req, resourceType, resourceId, action) {
  const p = req.principal;
  await audit.log({
    userId: p.user.id,
    email: p.user.email,
    action,
    resourceType,
    resourceId,
    detail: {
      keyId: p.key.id,
      keyPrefix: p.key.keyPrefix || p.key.key_prefix,
      keyName: p.key.name,
      scopes: apiKeyService.parseScopes(p.key.scopes),
    },
  }, req);
}

module.exports = { openAuth, requireScope, createOpenRateLimit, openRateLimit, auditExit };