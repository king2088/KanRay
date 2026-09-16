// src/services/lock.js
// 分布式锁：Redis 开启（config.cache.type==='redis'）时优先用 SET NX PX；
// Redis 不可用或未配置时，默认走数据库租约锁（sync_locks 表），
// 多实例共享元数据库即可互斥，无需额外设施。
const crypto = require('node:crypto');
const config = require('../config');
const cache = require('../cache');
const db = require('../db');

const KEY_PREFIX = 'lock:kanban:';
const RELEASE_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

function token() {
  return crypto.randomUUID();
}

// Redis 抢占（配置启用时唯一锁策略，避免双后端同时执行）：返回 null 表示未抢到或不可用
async function acquireRedis(name, id, ttlMs) {
  const redis = await cache.waitForRedis();
  if (!redis) return null;
  try {
    const ok = await redis.set(`${KEY_PREFIX}${name}`, id, 'PX', ttlMs, 'NX');
    return ok === 'OK' ? { token: id, backend: 'redis' } : null;
  } catch (e) {
    console.error('[lock] redis 不可用，本次跳过:', e.message);
    return null;
  }
}

// 数据库租约抢占：单条 UPDATE 原子判定（locked_until 毫秒时间戳，跨方言可比较）
async function acquireDb(name, id, ttlMs) {
  try {
    await db.run('INSERT INTO sync_locks (lock_name) VALUES (?)', [name]);
  } catch (_) { /* 行已存在（唯一键冲突） */ }
  const until = Date.now() + ttlMs;
  const r = await db.run(
    'UPDATE sync_locks SET locked_by = ?, locked_until = ? WHERE lock_name = ? AND (locked_until IS NULL OR locked_until < ?)',
    [id, until, name, Date.now()],
  );
  if (!r || r.changes !== 1) return null;
  return { token: id, backend: 'db' };
}

/**
 * 尝试获取锁（非阻塞）。成功返回 { token, backend }，失败返回 null。
 * Redis 配置启用时只用 Redis 锁（不可用则本次跳过，避免双后端并发）；
 * 未配置 Redis（默认）时走数据库租约锁。
 */
async function acquire(name, ttlMs) {
  const id = token();
  if (cache.isRedis()) return acquireRedis(name, id, ttlMs);
  return acquireDb(name, id, ttlMs);
}

async function release(name, holder) {
  if (holder.backend === 'redis') {
    const redis = cache.redisClient();
    if (redis) {
      try { await redis.eval(RELEASE_LUA, 1, `${KEY_PREFIX}${name}`, holder.token); } catch (_) { /* 幂等 */ }
      return;
    }
    return;
  }
  try {
    await db.run('UPDATE sync_locks SET locked_by = NULL, locked_until = 0 WHERE lock_name = ? AND locked_by = ?', [name, holder.token]);
  } catch (_) { /* 幂等 */ }
}

/**
 * 持锁执行 fn。抢不到锁返回 null（调用方判空跳过）；
 * 抢到则执行并在 finally 释放，返回 { executed: true, value }。
 */
async function withLock(name, ttlMs, fn) {
  const holder = await acquire(name, ttlMs);
  if (!holder) return null;
  try {
    return { executed: true, value: await fn() };
  } finally {
    await release(name, holder);
  }
}

module.exports = { acquire, release, withLock };