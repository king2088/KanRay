// 阿里云 MaxCompute 轻量 REST 客户端（无 SDK）：Basic(AK:SK) 认证，走 SQL 实例接口。
// 元数据用 SQL（SHOW / DESC），保证接口一致；结果解析对常见 JSON 形态做宽容匹配。
// createProvider(fetchImpl) 支持注入 fake fetch 单测（缺省 global fetch）。
const { maxcompute: mcDialect } = require('../dialects');
const { toDialect } = require('../portable-sql');
const { render } = require('./interpolate');

const NUMERIC = /INT|DOUBLE|FLOAT|DECIMAL|BIGINT|SMALLINT|NUMERIC|DEC/i;

function headersOf(cfg) {
  const token = Buffer.from(`${cfg.access_key_id || ''}:${cfg.access_key_secret || ''}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    'x-odps-project-name': String(cfg.project || ''),
  };
}

async function request(fetchImpl, cfg, method, path, body) {
  const base = String(cfg.endpoint || '').replace(/\/+$/, '');
  const res = await fetchImpl(`${base}${path}`, {
    method,
    headers: headersOf(cfg),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = text;
  try { json = JSON.parse(text); } catch (e) { /* 保留文本 */ }
  if (!res.ok) throw new Error(`MaxCompute ${res.status}: ${String(text).slice(0, 300)}`);
  return json;
}

// 结果 JSON 宽容解析：lines/rows/data 三选一，schema 找 resultSchema/columns/columnNames
function parseResult(res) {
  const lines = res && (res.lines || res.rows || res.data || (Array.isArray(res) ? res : null));
  if (!lines) return [];
  const schema = (res.resultSchema || res.columns || res.columnNames || [])
    .map((c) => (c && typeof c === 'object' ? c.name : c));
  const out = [];
  for (const line of lines) {
    if (Array.isArray(line)) {
      if (schema.length) {
        const o = {};
        schema.forEach((c, i) => { o[c] = line[i]; });
        out.push(o);
      } else {
        out.push(line);
      }
    } else if (line && typeof line === 'object') {
      out.push(line);
    }
  }
  return out;
}

function createProvider(fetchImpl) {
  const fetchFn = fetchImpl || ((url, opts) => globalThis.fetch(url, opts));

  async function runInstance(cfg, sql) {
    const base = `/api/projects/${encodeURIComponent(cfg.project || '')}`;
    const created = await request(fetchFn, cfg, 'POST', `${base}/instances`, { action: 'sql', query: sql });
    const id = created.instanceId || created.instanceID
      || (created.instances && created.instances[0] && created.instances[0].instanceId)
      || (created.location ? String(created.location).split('/').pop() : '');
    if (!id) throw new Error('MaxCompute 未返回实例 ID');
    for (let i = 0; i < 60; i += 1) {
      const st = await request(fetchFn, cfg, 'GET', `${base}/instances/${encodeURIComponent(id)}`);
      const status = String(st.status || st.instanceStatus || '').toUpperCase();
      if (/SUCCESS|FINISHED|TERMINATED/.test(status)) break;
      if (/FAILED|CANCEL/.test(status)) throw new Error(`MaxCompute 查询失败: ${st.message || st.errorMsg || status}`);
      await new Promise((r) => setTimeout(r, 200));
    }
    const result = await request(fetchFn, cfg, 'GET', `${base}/instances/${encodeURIComponent(id)}/result`);
    return parseResult(result);
  }

  async function testConnection(cfg) {
    try {
      await runInstance(cfg, 'SELECT 1');
      return { ok: true, message: '连接成功' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  function firstValue(r) {
    if (!r || typeof r !== 'object') return null;
    const k = Object.keys(r);
    return k.length ? r[k[0]] : null;
  }

  // MaxCompute 无多 schema 概念，schema 层固定为 project 名
  function listSchemas(cfg) {
    return Promise.resolve([{ name: cfg.project || 'default' }]);
  }

  async function listTables(cfg, type, schema) {
    const rows = await runInstance(cfg, 'SHOW TABLES');
    return rows.map((r) => ({ name: String(firstValue(r)), type: 'table' }));
  }

  async function listColumns(cfg, type, schema, table) {
    const q = mcDialect.quoteIdent(String(table));
    const rows = await runInstance(cfg, `DESC ${q}`);
    return rows
      .filter((r) => !/^#/.test(String(firstValue(r))))
      .map((r) => {
        const vals = Object.values(r);
        const name = String(vals[0]);
        const t = String(vals[1] != null ? vals[1] : 'string');
        return { name, type: t, role: NUMERIC.test(t) ? 'metric' : 'dimension' };
      });
  }

  async function runQuery(cfg, sql, params = []) {
    const native = toDialect(sql, mcDialect);
    const final = params && params.length ? render(native, params) : native;
    return runInstance(cfg, final);
  }

  return { testConnection, listSchemas, listTables, listColumns, runQuery };
}

module.exports = createProvider();
module.exports.createProvider = createProvider;