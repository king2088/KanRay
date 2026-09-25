// src/jobs/sync-scheduler.js
// 同步调度器：按 sync_interval_seconds 到期轮询。到期判定在 JS 完成（跨方言），
// 避免 sqlite datetime 加减与 mysql/pg/mssql/oracle 不一致。
//
// 两种运行模式（config.sync.mode）：
//  - inline：tick 直接在进程内执行 runSync（单机/测试默认）；
//  - worker：tick 只把到期配置写入 sync_jobs 队列，由独立 worker 进程消费执行。
const config = require('../config');
const db = require('../db');
const { runSync } = require('../services/sync.service');
const queue = require('../services/sync-queue.service');
const { withLock } = require('../services/lock');
const running = new Set();
let timer = null;

function parseUtc(ts) {
  if (!ts) return null;
  const s = String(ts).replace(' ', 'T');
  return new Date(/Z$|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`);
}

// 计算当前到期的同步配置（last_sync_at 为空或已过同步间隔）。
// running 但 updated_at 已超过锁租约（进程中断遗留）视为可重跑，纳入到期集合。
async function dueConfigs() {
  const rows = await db.all("SELECT * FROM sync_configs");
  const now = Date.now();
  return rows
    .filter((sc) => {
      if (sc.last_sync_status === 'running') {
        const startedAt = parseUtc(sc.updated_at);
        if (startedAt != null && now - startedAt.getTime() <= config.sync.lockTtlMs) return false;
      }
      const last = parseUtc(sc.last_sync_at);
      if (last == null) return true;
      const interval = Number(sc.sync_interval_seconds || config.sync.defaultIntervalSeconds) * 1000;
      return now >= last.getTime() + interval;
    })
    .sort((a, b) => ((a.last_sync_at == null ? 1 : 0) - (b.last_sync_at == null ? 1 : 0)) || (a.id - b.id));
}

// worker 模式：把到期配置入队（幂等，已有排队/执行中的任务则跳过）
async function enqueueDue() {
  const due = await dueConfigs();
  let enqueued = 0;
  for (const sc of due) {
    const job = await queue.enqueue(sc.id, 'schedule');
    if (!job.existing) enqueued += 1;
  }
  return { enqueued, due: due.length };
}

// inline 模式：进程内直接执行（受限并发）
async function runDueInline() {
  if (running.size >= config.sync.maxConcurrent) return { executed: 0, due: 0 };
  const due = await dueConfigs();
  for (const sc of due) {
    if (running.size >= config.sync.maxConcurrent) break;
    running.add(sc.id);
    withLock(`sync:${sc.id}`, config.sync.lockTtlMs, () => runSync(sc.id))
      .then((res) => {
        if (res == null) console.info(`[sync] cfg ${sc.id} 已由其它实例执行，跳过`);
      })
      .catch((e) => console.error(`[sync] cfg ${sc.id} failed:`, e.message))
      .finally(() => running.delete(sc.id));
  }
  return { executed: due.length, due: due.length };
}

async function tick() {
  return config.sync.mode === 'worker' ? enqueueDue() : runDueInline();
}

function startScheduler() {
  if (timer) return timer;
  timer = setInterval(tick, Math.max(1000, config.sync.schedulerIntervalMs || 60000));
  tick().catch((e) => console.error('[sync] scheduler tick error:', e.message));
  return timer;
}

function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { startScheduler, stopScheduler, tick, dueConfigs, enqueueDue, running };
