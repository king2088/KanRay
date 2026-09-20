const http = require('http');
const { render } = require('./interpolate');

function defaultRequest(cfg, method, path, body) {
  return new Promise((resolve, reject) => {
    const auth = cfg.user && cfg.password
      ? Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')
      : null;
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const options = {
      hostname: cfg.host, port: Number(cfg.port) || 9200,
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Basic ${auth}` } : {}),
        ...(payload ? { 'Content-Length': payload.length } : {}),
      },
      timeout: 10000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`ES ${res.statusCode}: ${data.slice(0, 200)}`));
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('连接超时')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function unq(name) {
  return String(name).replace(/^`|`$/g, '').replace(/^"|"$/g, '');
}

// 基础 SQL 子集 → ES _search DSL：SELECT 投影 / FROM 索引 / WHERE 等值/IN/LIKE/比较 / ORDER BY / LIMIT [OFFSET]。
// 聚合与 GROUP BY 走同步物化，避免在直查层做不完整的 SQL 翻译。
function parseEsSql(sql) {
  let rest = String(sql).trim().replace(/;\s*$/, '');
  let size = null;
  let from = 0;
  const lm = rest.match(/\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?\s*$/i);
  if (lm) {
    size = Number(lm[1]);
    from = lm[2] != null ? Number(lm[2]) : 0;
    rest = rest.slice(0, lm.index);
  }
  if (/\bGROUP\s+BY\b/i.test(rest) || /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(rest)) {
    throw new Error('ES 直查暂不支持聚合查询，请改用「同步数据源」物化后再查询');
  }
  const orderBy = [];
  const om = rest.match(/\s+ORDER\s+BY\s+(.+)$/is);
  if (om) {
    for (const seg of om[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const m2 = seg.match(/^([A-Za-z0-9_]+|`[^`]+`)\s+(ASC|DESC)\s*$/i) || seg.match(/^([A-Za-z0-9_]+|`[^`]+`)$/i);
      if (m2) orderBy.push({ [unq(m2[1])]: { order: (seg.toUpperCase().includes('DESC') ? 'desc' : 'asc') } });
    }
    rest = rest.slice(0, om.index);
  }
  const fm = rest.match(/\bFROM\s+([^\s]+)/i);
  if (!fm) throw new Error('ES 查询缺少 FROM 索引');
  const index = unq(fm[1]);
  const afterFrom = rest.slice(fm.index + fm[0].length);
  const wherePart = afterFrom.match(/^\s*WHERE\s+([\s\S]+)$/i);
  const selM = rest.slice(0, fm.index).match(/SELECT\s+([\s\S]*)$/i);
  const fields = parseFields(selM ? selM[1] : '*');
  const filters = [];
  if (wherePart && typeof wherePart[1] === 'string') {
    for (const cond of wherePart[1].split(/\s+AND\s+/i).map((s) => s.trim()).filter(Boolean)) {
      const f = mapCond(cond);
      if (f) filters.push(f);
    }
  }
  if (!filters.length) filters.push({ match_all: {} });
  return { index, fields, filters, orderBy, from, size };
}

function parseFields(raw) {
  const s = String(raw).trim();
  if (s === '' || s === '*') return null;
  const fields = [];
  for (const tok of s.split(',').map((t) => t.trim()).filter(Boolean)) {
    if (/[{("]/.test(tok)) throw new Error('ES 直查暂支持简单列投影，复杂表达式请改用同步物化');
    fields.push(unq(tok));
  }
  return fields;
}

function parseLiteral(raw) {
  const v = String(raw).trim();
  if (v.toUpperCase() === 'NULL') return null;
  if (v.toUpperCase() === 'TRUE' || v.toUpperCase() === 'FALSE') return v.toUpperCase() === 'TRUE';
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/(^|[^'])''/g, "$1'");
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^`|`$/g, '').replace(/^"|"$/g, '');
}

function mapCond(cond) {
  const m = cond.match(/^`?([A-Za-z0-9_]+)`?\s*(=|!=|>|>=|<|<=|LIKE|IN)\s+(.+)$/i);
  if (!m) return null;
  const field = unq(m[1]);
  const op = m[2].toUpperCase();
  const raw = m[3].trim();
  if (op === 'IN') {
    const inner = raw.replace(/^\(|\)$/g, '');
    const vals = inner.split(',').map(parseLiteral);
    return { terms: { [field]: vals } };
  }
  if (op === 'LIKE') {
    const pat = String(parseLiteral(raw)).replace(/%/g, '*');
    return { wildcard: { [field]: pat } };
  }
  const value = parseLiteral(raw);
  if (op === '=') {
    return value == null ? { bool: { must_not: { exists: { field } } } } : { term: { [field]: value } };
  }
  if (op === '!=') {
    return value == null ? { exists: { field } } : { bool: { must_not: { term: { [field]: value } } } };
  }
  const range = {};
  if (op === '>') range.gt = value;
  if (op === '>=') range.gte = value;
  if (op === '<') range.lt = value;
  if (op === '<=') range.lte = value;
  return { range: { [field]: range } };
}

function createProvider(transport) {
  const request = transport && transport.request
    ? ((cfg, method, path, body) => transport.request(cfg, method, path, body))
    : defaultRequest;

  async function testConnection(cfg) {
    try {
      const health = await request(cfg, 'GET', '/_cluster/health');
      return { ok: true, message: `集群状态: ${health.status}` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async function listSchemas(cfg) {
    const indices = await request(cfg, 'GET', '/_cat/indices?format=json');
    const names = [...new Set(indices.map((i) => i.index).filter((n) => !String(n).startsWith('.')))];
    return names.map((name) => ({ name }));
  }

  async function listTables(cfg, type, schema) {
    const mapping = await request(cfg, 'GET', `/${encodeURIComponent(schema)}/_mapping`);
    return Object.keys(mapping).filter((n) => !String(n).startsWith('.')).map((name) => ({ name, type: 'table' }));
  }

  async function listColumns(cfg, type, schema, table) {
    const mapping = await request(cfg, 'GET', `/${encodeURIComponent(table)}/_mapping`);
    const doc = mapping[table];
    const props = (doc && doc.mappings && doc.mappings.properties) || {};
    return Object.entries(props).map(([name, def]) => ({
      name,
      type: def.type || 'text',
      role: ['integer', 'long', 'float', 'double', 'half_float', 'scaled_float'].includes(def.type) ? 'metric' : 'dimension',
    }));
  }

  async function runQuery(cfg, sql, params = []) {
    const final = params && params.length ? render(sql, params) : sql;
    const parsed = parseEsSql(final);
    const body = {
      query: { bool: { filter: parsed.filters } },
      size: parsed.size == null ? 1000 : Math.min(1000, parsed.size),
    };
    if (parsed.fields) body._source = parsed.fields;
    if (parsed.orderBy.length) body.sort = parsed.orderBy;
    if (parsed.from > 0) body.from = parsed.from;
    const res = await request(cfg, 'POST', `/${encodeURIComponent(parsed.index)}/_search`, body);
    return ((res && res.hits && res.hits.hits) || []).map((h) => h._source || {});
  }

  return { testConnection, listSchemas, listTables, listColumns, runQuery };
}

module.exports = createProvider();
module.exports.createProvider = createProvider;