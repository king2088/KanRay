const http = require('http');
const https = require('https');

async function testConnection(cfg) {
  const url = cfg.url;
  if (!url) return { ok: false, message: '缺少 URL' };
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      let headers = {};
      if (cfg.headers) {
        try { headers = typeof cfg.headers === 'string' ? JSON.parse(cfg.headers) : cfg.headers; } catch (e) { /* 忽略 */ }
      }
      const options = {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: cfg.method || 'GET',
        headers,
        timeout: 10000,
      };
      const req = mod.request(options, (res) => {
        const expected = Number(cfg.expectedStatus) || 200;
        res.resume();
        if (res.statusCode === expected) resolve({ ok: true, message: `状态码 ${res.statusCode}` });
        else resolve({ ok: false, message: `期望状态码 ${expected}，实际 ${res.statusCode}` });
      });
      req.on('error', (e) => resolve({ ok: false, message: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: '连接超时' }); });
      req.end();
    } catch (e) {
      resolve({ ok: false, message: e.message });
    }
  });
}

module.exports = { testConnection };