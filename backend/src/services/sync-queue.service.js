// src/services/sync-queue.service.js
// 同步任务队列（worker 模式）：API 进程只入队，独立 worker 进程领取执行。
// 通过 sync_jobs 表协调，避免依赖外部队列中间件；领取用条件 UPDATE 保证多副本互斥，
// lease_until（epoch 毫秒）用于 worker 崩溃后的任务回收。
const db = require('../db');
const config = require('../config');

const ACTIVE = ['queued', 'running'];

function q(name) { return db.dialect.quoteIdent(name); }

async function hasActive(cid, now) {
  const ph = db.dialect.placeholder;
  const sql = `SELECT id FROM ${q('sync_jobs')} WHERE ${q('sync_config_id')} = ${ph(1)} AND (${q('status')} = ${ph(2)} OR (${q('status')} = ${ph(3)} AND ${q('lease_until')} > ${ph(4)}))`;
  const row = await db.prepare(sql).get(cid, 'queued', 'running', now);
  return !!row;
}

/**
 * 入队一次同步；若该配置已有排队中/执行中的任务则复用之（幂等）。
 * @returns {Promise<object>} 任务行（含 existing: true 表示复用）
 */
async function enqueue(cid, trigger = 'schedule') {
  const now = Date.now();
  if (await hasActive(cid, now)) {
    const row = await db.prepare(
      `SELECT * FROM ${q('sync_jobs')} WHERE ${q('sync_config_id')} = ${db.dialect.placeholder(1)} AND (${q('status')} = ${db.dialect.placeholder(2)} OR ${q('status')} = ${db.dialect.placeholder(3)}) ORDER BY id DESC`
    ).get(cid, 'queued', 'running');
    return { ...row, existing: true };
  }
  const ph = db.dialect.placeholder;
  const sql = `INSERT INTO ${q('sync_jobs')} (${q('sync_config_id')}, ${q('trigger_type')}, ${q('status')}, ${q('attempts')}, ${q('created_at')}) VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, datetime('now'))`;
  const r = await db.prepare(sql).run(cid, String(trigger), 'queued', 0);
  const job = await getJob(Number(r.lastInsertRowid));
  return { ...job, existing: false };
}

async function getJob(id) {
  return db.prepare(`SELECT * FROM ${q('sync_jobs')} WHERE ${q('id')} = ${db.dialect.placeholder(1)}`).get(id);
}

/**
 * 领取一个待执行任务（queued 或租约过期的 running），原子标记为 running。
 * @returns {Promise<object|null>} 领取到的任务，或 null
 */
async function claim(workerId, leaseMs = config.sync.lockTtlMs) {
  const now = Date.now();
  const ph = db.dialect.placeholder;
  const pick = db.dialect.limit(
    `SELECT * FROM ${q('sync_jobs')} WHERE ${q('status')} = ${ph(1)} OR (${q('status')} = ${ph(2)} AND ${q('lease_until')} <= ${ph(3)}) ORDER BY id ASC`,
    1,
  );
  const row = await db.prepare(pick).get('queued', 'running', now);
  if (!row) return null;

  const lease = now + leaseMs;
  const upd = `UPDATE ${q('sync_jobs')} SET ${q('status')} = ${ph(1)}, ${q('worker_id')} = ${ph(2)}, ${q('lease_until')} = ${ph(3)}, ${q('started_at')} = datetime('now'), ${q('attempts')} = ${q('attempts')} + 1 WHERE ${q('id')} = ${ph(4)} AND (${q('status')} = ${ph(5)} OR (${q('status')} = ${ph(6)} AND ${q('lease_until')} <= ${ph(7)}))`;
  const r = await db.prepare(upd).run('running', workerId, lease, row.id, 'queued', 'running', now);
  if (!r || r.changes !== 1) return null;
  return { ...row, status: 'running', worker_id: workerId, lease_until: lease, attempts: Number(row.attempts || 0) + 1 };
}

async function renew(jobId, workerId, leaseMs = config.sync.lockTtlMs) {
  const ph = db.dialect.placeholder;
  await db.prepare(`UPDATE ${q('sync_jobs')} SET ${q('lease_until')} = ${ph(1)} WHERE ${q('id')} = ${ph(2)} AND ${q('worker_id')} = ${ph(3)} AND ${q('status')} = ${ph(4)}`)
    .run(Date.now() + leaseMs, jobId, workerId, 'running');
}

async function finish(jobId, status, error = null) {
  const ph = db.dialect.placeholder;
  await db.prepare(`UPDATE ${q('sync_jobs')} SET ${q('status')} = ${ph(1)}, ${q('finished_at')} = datetime('now'), ${q('error')} = ${ph(2)}, ${q('lease_until')} = 0 WHERE ${q('id')} = ${ph(3)}`)
    .run(status, error == null ? null : String(error).slice(0, 1000), jobId);
}

async function activeCount() {
  const ph = db.dialect.placeholder;
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${q('sync_jobs')} WHERE ${q('status')} = ${ph(1)} OR ${q('status')} = ${ph(2)}`).get('queued', 'running');
  return Number(row?.c || 0);
}

async function queuedCount() {
  const ph = db.dialect.placeholder;
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${q('sync_jobs')} WHERE ${q('status')} = ${ph(1)}`).get('queued');
  return Number(row?.c || 0);
}

module.exports = { enqueue, claim, renew, finish, getJob, hasActive, activeCount, queuedCount, ACTIVE };
