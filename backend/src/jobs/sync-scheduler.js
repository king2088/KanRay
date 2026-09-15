// src/jobs/sync-scheduler.js
// 同步调度器：按 sync_interval_seconds 到期轮询。到期判定在 JS 完成（跨方言），
// 避免 sqlite datetime 加减与 mysql/pg/mssql/oracle 不一致。
const config = require('../config');
const db = require('../db');
const { runSync } = require('../services/sync.service');
const running = new Set();
let timer = null;

function parseUtc(ts) {
  if (!ts) return null;
  const s = String(ts).replace(' ', 'T');
  return new Date(/Z$|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`);
}

async function tick() {
  if (running.size >= config.sync.maxConcurrent) return;
  const rows = await db.all("SELECT * FROM sync_configs WHERE last_sync_status != 'running'");
  const now = Date.now();
  const due = rows
    .filter((sc) => {
      const last = parseUtc(sc.last_sync_at);
      if (last == null) return true;
      const interval = Number(sc.sync_interval_seconds || config.sync.defaultIntervalSeconds) * 1000;
      return now >= last.getTime() + interval;
    })
    .sort((a, b) => ((a.last_sync_at == null ? 1 : 0) - (b.last_sync_at == null ? 1 : 0)) || (a.id - b.id));
  for (const sc of due) {
    if (running.size >= config.sync.maxConcurrent) break;
    running.add(sc.id);
    runSync(sc.id)
      .catch((e) => console.error(`[sync] cfg ${sc.id} failed:`, e.message))
      .finally(() => running.delete(sc.id));
  }
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

module.exports = { startScheduler, stopScheduler, tick, running };