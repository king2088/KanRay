#!/usr/bin/env node
// backend/scripts/bench/http-bench.js
// 无外部依赖的并发压测脚本：登录后按固定并发持续请求目标接口，输出延迟分位与吞吐。
// 用于建立「同步期间 Web 请求 P95 / 事件循环延迟」基线，配合 GET /api/metrics 观察。
//
// 用法：
//   node scripts/bench/http-bench.js \
//     --url http://localhost:3001 \
//     --email admin@kanray.local --password admin123 \
//     --path /api/datasets --method GET \
//     --concurrency 20 --duration 15
//
// 观察服务端指标（另开终端）：
//   curl -s http://localhost:3001/api/metrics | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d).data,null,2)))"

const http = require('node:http');
const https = require('node:https');

function parseArgs(argv) {
  const out = {
    url: 'http://localhost:3001',
    path: '/api/datasets',
    method: 'GET',
    email: 'admin@kanray.local',
    password: 'admin123',
    concurrency: 20,
    duration: 15,
    token: '',
  };
  for (let i = 2; i < argv.length; i += 2) {
    const k = String(argv[i]).replace(/^--/, '');
    const v = argv[i + 1];
    if (k in out) out[k] = /^\d+$/.test(v) ? Number(v) : v;
  }
  return out;
}

function request(base, method, path, token, body) {
  return new Promise((resolve) => {
    const u = new URL(path, base);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const started = process.hrtime.bigint();
    const req = lib.request({
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
      },
      agent: false,
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode, ms: Number(process.hrtime.bigint() - started) / 1e6 }));
    });
    req.on('error', () => resolve({ status: 0, ms: Number(process.hrtime.bigint() - started) / 1e6 }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(base, email, password) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({ email, password }));
    const u = new URL('/api/auth/login', base);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'POST', hostname: u.hostname, port: u.port, path: u.pathname,
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data?.accessToken || '');
        } catch (e) { reject(new Error(`登录响应解析失败: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const token = args.token || await login(args.url, args.email, args.password);
  if (!token) throw new Error('未获取到 accessToken，请检查账号或 --token');

  const latencies = [];
  let ok = 0;
  let failed = 0;
  const deadline = Date.now() + args.duration * 1000;

  async function worker() {
    while (Date.now() < deadline) {
      const r = await request(args.url, args.method, args.path, token);
      latencies.push(r.ms);
      if (r.status >= 200 && r.status < 400) ok += 1; else failed += 1;
    }
  }

  await Promise.all(Array.from({ length: args.concurrency }, worker));

  latencies.sort((a, b) => a - b);
  const q = (p) => latencies.length ? Number(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))].toFixed(1)) : 0;
  const totalMs = latencies.reduce((s, x) => s + x, 0);
  console.log(JSON.stringify({
    target: `${args.method} ${args.path}`,
    concurrency: args.concurrency,
    durationSec: args.duration,
    requests: latencies.length,
    ok,
    failed,
    rps: Number((latencies.length / args.duration).toFixed(1)),
    latencyMs: { avg: Number((totalMs / (latencies.length || 1)).toFixed(1)), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(0.999999) },
  }, null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
