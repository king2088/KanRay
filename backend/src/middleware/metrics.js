// src/middleware/metrics.js
// 轻量运行时可观测性：事件循环延迟、请求耗时直方图、请求/错误计数、同步任务指标。
// 无外部依赖，进程内聚合；通过 GET /api/metrics 暴露快照。
const { monitorEventLoopDelay } = require('node:perf_hooks');

const elu = monitorEventLoopDelay({ resolution: 20 });
elu.enable();

const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const state = {
  startedAt: Date.now(),
  requestsTotal: 0,
  errorsTotal: 0,
  statusClasses: { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  durationBuckets: new Array(DURATION_BUCKETS_MS.length + 1).fill(0),
  durationCount: 0,
  durationSumMs: 0,
  sync: { runs: 0, failures: 0, rows: 0, deleted: 0, lastDurationMs: 0 },
};

function observeDuration(ms) {
  state.durationCount += 1;
  state.durationSumMs += ms;
  let i = DURATION_BUCKETS_MS.findIndex((b) => ms <= b);
  if (i === -1) i = DURATION_BUCKETS_MS.length;
  state.durationBuckets[i] += 1;
}

// 请求中间件：记录耗时与状态码分布
function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  state.requestsTotal += 1;
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    observeDuration(ms);
    const cls = `${Math.floor(res.statusCode / 100)}xx`;
    if (state.statusClasses[cls] !== undefined) state.statusClasses[cls] += 1;
    if (res.statusCode >= 500) state.errorsTotal += 1;
  });
  next();
}

// 同步任务指标：由 sync.service 完成/失败时调用（可选，不传也不影响）
function recordSync({ ok, rows = 0, deleted = 0, durationMs = 0 }) {
  state.sync.runs += 1;
  if (!ok) state.sync.failures += 1;
  state.sync.rows += rows || 0;
  state.sync.deleted += deleted || 0;
  state.sync.lastDurationMs = Math.round(durationMs || 0);
}

function quantileFromBuckets(q) {
  if (state.durationCount === 0) return 0;
  const target = Math.ceil(state.durationCount * q);
  let cum = 0;
  for (let i = 0; i < state.durationBuckets.length; i += 1) {
    cum += state.durationBuckets[i];
    if (cum >= target) return DURATION_BUCKETS_MS[i] ?? DURATION_BUCKETS_MS[DURATION_BUCKETS_MS.length - 1];
  }
  return DURATION_BUCKETS_MS[DURATION_BUCKETS_MS.length - 1];
}

function snapshot() {
  const rss = process.memoryUsage().rss;
  return {
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    pid: process.pid,
    eventLoop: {
      meanMs: Number((elu.mean / 1e6).toFixed(3)),
      p99Ms: Number((elu.percentile(99) / 1e6).toFixed(3)),
      maxMs: Number((elu.max / 1e6).toFixed(3)),
    },
    memory: {
      rssBytes: rss,
      rssMb: Number((rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
    },
    http: {
      requestsTotal: state.requestsTotal,
      errorsTotal: state.errorsTotal,
      statusClasses: { ...state.statusClasses },
      durationMs: {
        count: state.durationCount,
        avg: state.durationCount ? Number((state.durationSumMs / state.durationCount).toFixed(2)) : 0,
        p50: quantileFromBuckets(0.5),
        p95: quantileFromBuckets(0.95),
        p99: quantileFromBuckets(0.99),
        buckets: DURATION_BUCKETS_MS.reduce((acc, b, i) => {
          acc[`le_${b}`] = state.durationBuckets[i];
          return acc;
        }, { le_inf: state.durationBuckets[DURATION_BUCKETS_MS.length] }),
      },
    },
    sync: { ...state.sync },
  };
}

function reset() {
  state.requestsTotal = 0;
  state.errorsTotal = 0;
  Object.keys(state.statusClasses).forEach((k) => { state.statusClasses[k] = 0; });
  state.durationBuckets.fill(0);
  state.durationCount = 0;
  state.durationSumMs = 0;
  state.sync = { runs: 0, failures: 0, rows: 0, deleted: 0, lastDurationMs: 0 };
}

module.exports = { metricsMiddleware, recordSync, snapshot, reset };
