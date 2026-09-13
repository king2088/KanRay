const http = require('http');

function request(cfg, query) {
  return new Promise((resolve, reject) => {
    const dbPart = cfg.database ? `&database=${encodeURIComponent(cfg.database)}` : '';
    const options = {
      hostname: cfg.host, port: Number(cfg.port) || 8123,
      path: `/?default_format=TabSeparatedWithNames${dbPart}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...(cfg.user ? { 'X-ClickHouse-User': cfg.user } : {}),
        ...(cfg.password ? { 'X-ClickHouse-Key': cfg.password } : {}),
      },
      timeout: 10000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`ClickHouse ${res.statusCode}: ${data.slice(0, 200)}`));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('连接超时')); });
    req.end(query);
  });
}

function parseTSVRows(data) {
  const lines = data.trim().split('\n');
  if (!data.trim()) return [];
  const headers = lines[0].split('\t').map((h) => h.trim());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = line.split('\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] !== undefined ? vals[i].trim() : null; });
    return row;
  });
}

async function q(cfg, sql) {
  const data = await request(cfg, sql);
  return parseTSVRows(data);
}

async function testConnection(cfg) {
  try {
    await q(cfg, 'SELECT 1');
    return { ok: true, message: '连接成功' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

async function listSchemas(cfg) {
  return cfg.database ? [{ name: cfg.database }] : [];
}

async function listTables(cfg, type, schema) {
  const esc = clickhouseEscape(schema);
  const rows = await q(cfg, `SELECT name, engine FROM system.tables WHERE database = '${esc}' ORDER BY name`);
  return rows.map((r) => {
    const engine = String(r.engine || '');
    return { name: String(r.name), type: engine.toUpperCase().includes('VIEW') ? 'view' : 'table' };
  });
}

async function listColumns(cfg, type, schema, table) {
  const rows = await q(cfg, `SELECT name, type FROM system.columns WHERE database = '${clickhouseEscape(schema)}' AND table = '${clickhouseEscape(table)}' ORDER BY position`);
  return rows.map((r) => {
    const colType = String(r.type || 'String');
    return {
      name: String(r.name),
      type: colType,
      role: /Float|Int|UInt|Decimal|Double/.test(colType) ? 'metric' : 'dimension',
    };
  });
}

// ClickHouse 字符串字面量按 C 风格转义：\ 与 ' 均需反斜杠前缀
function clickhouseEscape(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function runQuery(cfg, sql, params = []) {
  let query = sql;
  params.forEach((p) => {
    query = query.replace('?', typeof p === 'string' ? `'${clickhouseEscape(p)}'` : String(p));
  });
  return q(cfg, query);
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };