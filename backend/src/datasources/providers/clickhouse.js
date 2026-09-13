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
  const rows = await q(cfg, "SELECT name FROM system.databases ORDER BY name");
  return rows.map((r) => ({ name: String(r.name) }));
}

async function listTables(cfg, type, schema) {
  const esc = String(schema).replace(/'/g, "''");
  const rows = await q(cfg, `SELECT name, engine FROM system.tables WHERE database = '${esc}' ORDER BY name`);
  return rows.map((r) => {
    const engine = String(r.engine || '');
    return { name: String(r.name), type: engine.toUpperCase().includes('VIEW') ? 'view' : 'table' };
  });
}

async function listColumns(cfg, type, schema, table) {
  const escSchema = String(schema).replace(/'/g, "''");
  const escTable = String(table).replace(/'/g, "''");
  const rows = await q(cfg, `SELECT name, type FROM system.columns WHERE database = '${escSchema}' AND table = '${escTable}' ORDER BY position`);
  return rows.map((r) => {
    const colType = String(r.type || 'String');
    return {
      name: String(r.name),
      type: colType,
      role: /Float|Int|UInt|Decimal|Double/.test(colType) ? 'metric' : 'dimension',
    };
  });
}

async function runQuery(cfg, sql, params = []) {
  let query = sql;
  params.forEach((p, i) => {
    query = query.replace('?', typeof p === 'string' ? `'${String(p).replace(/'/g, "''")}'` : String(p));
  });
  return q(cfg, query);
}

module.exports = { testConnection, listSchemas, listTables, listColumns, runQuery };