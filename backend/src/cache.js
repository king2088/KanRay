// src/cache.js
// 统一缓存门面：Redis 开启（config.cache.type==='redis'）时走 ioredis（懒加载），
// 否则或 Redis 不可用时回退进程内存 Map（带 TTL）。
// 语义：get(key) -> value | undefined；set(key, value, ttlMs) 可序列化为 JSON。
const config = require('./config');

let redis = null;
let redisReady = false;
let redisDisabled = false;
const mem = new Map(); // key -> { v, exp }

// 返回原始 ioredis 实例（懒加载），未开启/初始化失败返回 null。锁模块复用同一连接。
function redisClient() {
  if (config.cache.type !== 'redis' || redisDisabled) return null;
  if (!redis) {
    try {
      const IORedis = require('ioredis'); // 仅开启时加载，未安装也可启动
      redis = new IORedis(config.cache.url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 200, 2000),
      });
      redis.on('connect', () => { redisReady = true; });
      redis.on('ready', () => { redisReady = true; });
      redis.on('error', (e) => {
        redisReady = false;
        if (!redisDisabled) console.error('[cache] redis 错误，回退内存:', e.message);
      });
      redis.on('close', () => { redisReady = false; });
      redis.on('end', () => { redisReady = false; redisDisabled = true; });
    } catch (e) {
      redisDisabled = true;
      console.error('[cache] redis 初始化失败，回退内存:', e.message);
      return null;
    }
  }
  return redis;
}

function getRedis() {
  return redisReady ? redisClient() : null;
}

function memGet(key) {
  const it = mem.get(key);
  if (!it) return undefined;
  if (it.exp <= Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return it.v;
}

function memSet(key, value, ttlMs) {
  mem.set(key, { v: value, exp: Date.now() + ttlMs });
}

async function get(key) {
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(key);
      return raw == null ? undefined : JSON.parse(raw);
    } catch (e) {
      return memGet(key);
    }
  }
  return memGet(key);
}

async function set(key, value, ttlMs = config.cache.ttlMs) {
  const r = getRedis();
  if (r) {
    try {
      await r.set(key, JSON.stringify(value), 'PX', ttlMs);
      return;
    } catch (e) {
      memSet(key, value, ttlMs);
      return;
    }
  }
  memSet(key, value, ttlMs);
}

async function del(key) {
  const r = getRedis();
  if (r) {
    try { await r.del(key); } catch (_) { mem.delete(key); }
    return;
  }
  mem.delete(key);
}

async function flush() {
  mem.clear();
  const r = getRedis();
  if (r) {
    try { await r.flushdb(); } catch (_) { /* 忽略 */ }
  }
}

function isRedis() {
  return config.cache.type === 'redis';
}

module.exports = { get, set, del, flush, isRedis, redisClient };