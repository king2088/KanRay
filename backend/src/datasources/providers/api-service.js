const http = require('http');
const https = require('https');
const config = require('../../config');
const { blockReason, createLookup } = require('../ssrf-guard');

function parseHeaders(headers) {
  if (!headers) return {};
  if (typeof headers === 'string') { try { return JSON.parse(headers); } catch (e) { return {}; } }
  return headers;
}

// 请求数据源 URL，返回解析后的 body（JSON 优先）
function requestJson(cfg) {
  const url = cfg.url;
  if (!url) return Promise.reject(new Error('缺少 URL'));
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      // 字面 IP 会绕过 http.request 的 lookup 钩子，必须在请求前同步校验（防 SSRF）
      const reason = blockReason(u.hostname, !!config.datasource.httpBlockPrivate);
      if (reason) return reject(new Error(`禁止访问数据源目标：${reason} 地址 ${u.hostname}`));
      const mod = u.protocol === 'https:' ? https : http;
      const options = {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: cfg.method || 'GET',
        headers: parseHeaders(cfg.headers),
        timeout: 10000,
        lookup: createLookup(!!config.datasource.httpBlockPrivate),
      };
      const req = mod.request(options, (res) => {
        const expected = Number(cfg.expectedStatus) || 200;
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode !== expected) return reject(new Error(`期望状态码 ${expected}，实际 ${res.statusCode}`));
          let body = data;
          try { body = JSON.parse(data); } catch (e) { /* 文本透传 */ }
          resolve(body);
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('连接超时')); });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// 宽容解析 API 返回：顶层数组 / {data:[...]} / {data:{list:[...]}} / {list:[...]}
function toRows(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.list)) return body.data.list;
  if (Array.isArray(body.list)) return body.list;
  if (Array.isArray(body.rows)) return body.rows;
  if (Array.isArray(body.items)) return body.items;
  return [];
}

function guessType(v) {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'object' && v != null) return 'json';
  return 'string';
}

async function testConnection(cfg) {
  try {
    await requestJson(cfg);
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function listSchemas() {
  return Promise.resolve([{ name: 'default' }]);
}

async function listTables(cfg, type, schema) {
  const body = await requestJson(cfg);
  const rows = toRows(body);
  if (!rows.length) throw new Error('API 返回为空，无法枚举表');
  return [{ name: 'api_data', type: 'table' }];
}

async function listColumns(cfg, type, schema, table) {
  const body = await requestJson(cfg);
  const rows = toRows(body);
  const first = rows.find((r) => r && typeof r === 'object');
  if (!first) throw new Error('API 返回为空数组，无法推断列');
  return Object.keys(first).map((name) => ({
    name,
    type: guessType(first[name]),
    role: guessType(first[name]) === 'number' ? 'metric' : 'dimension',
  }));
}

// API 数据源无服务端 SQL：忽略查询参数，返回整包数据（每行以对象形式）
async function runQuery(cfg, sql, params = []) {
  const body = await requestJson(cfg);
  const rows = toRows(body);
  return rows;
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };