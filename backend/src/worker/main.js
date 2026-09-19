// src/worker/main.js
// 独立同步 worker 进程入口（SYNC_MODE=worker）。
// 职责：初始化元数据模式 → 启动调度（把到期配置入队）→ 消费 sync_jobs 队列并执行同步。
// 与 API 进程共用同一元数据库与分布式锁；多副本时靠条件 UPDATE 领取任务互斥。
const os = require('node:os');
const config = require('../config');
const db = require('../db');
const { startScheduler, stopScheduler } = require('../jobs/sync-scheduler');
const queue = require('../services/sync-queue.service');
const { runSync } = require('../services/sync.service');
const { withLock } = require('../services/lock');

const WORKER_ID = `${os.hostname()}-${process.pid}`;
const running = new Set();
let consumerTimer = null;
let pruneTimer = null;
let shuttingDown = false;

async function runJob(job) {
  const cid = job.sync_config_id;
  const heartbeat = setInterval(
    () => queue.renew(job.id, WORKER_ID, config.sync.lockTtlMs).catch(() => {}),
    Math.max(5000, Math.floor(config.sync.lockTtlMs / 3)),
  );
  try {
    const wrapped = await withLock(`sync:${cid}`, config.sync.lockTtlMs, () => runSync(cid));
    if (wrapped == null) {
      await queue.finish(job.id, 'success', '已由其它实例执行');
    } else if (wrapped.value && wrapped.value.skipped) {
      await queue.finish(job.id, 'success', '跳过：配置已在执行中');
    } else {
      await queue.finish(job.id, 'success');
    }
  } catch (e) {
    await queue.finish(job.id, 'failed', e.message);
    console.error(`[sync-worker] job ${job.id} cfg ${cid} 失败:`, e.message);
  } finally {
    clearInterval(heartbeat);
  }
}

async function consumerTick() {
  if (shuttingDown) return;
  while (running.size < config.sync.maxConcurrent) {
    let job;
    try {
      job = await queue.claim(WORKER_ID, config.sync.lockTtlMs);
    } catch (e) {
      console.error('[sync-worker] 领取任务失败:', e.message);
      return;
    }
    if (!job) return;
    running.add(job.id);
    runJob(job).finally(() => running.delete(job.id));
  }
}

async function main() {
  await db.initSchema();
  console.log(`[sync-worker] 启动 worker=${WORKER_ID} 并发上限=${config.sync.maxConcurrent} 轮询=${config.sync.workerPollMs}ms`);
  startScheduler();
  consumerTimer = setInterval(() => { consumerTick().catch((e) => console.error('[sync-worker] consumer tick:', e.message)); }, config.sync.workerPollMs);
  await consumerTick().catch((e) => console.error('[sync-worker] consumer tick:', e.message));
  await prune();
  pruneTimer = setInterval(prune, 3600000);
}

async function prune() {
  try {
    const n = await queue.pruneFinished();
    if (n > 0) console.log(`[sync-worker] 清理过期同步任务 ${n} 条`);
  } catch (e) {
    console.error('[sync-worker] 清理过期任务失败:', e.message);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[sync-worker] 收到 ${signal}，等待在途任务结束（${running.size} 个）…`);
  stopScheduler();
  if (consumerTimer) { clearInterval(consumerTimer); consumerTimer = null; }
  if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null; }
  const deadline = Date.now() + 30000;
  while (running.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  try { db.close(); } catch (e) { /* ignore */ }
  console.log('[sync-worker] 已退出');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((e) => { console.error('[sync-worker] 启动失败', e); process.exit(1); });
