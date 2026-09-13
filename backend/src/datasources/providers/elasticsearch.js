const http = require('http');

function request(cfg, method, path) {
  return new Promise((resolve, reject) => {
    const auth = cfg.user && cfg.password
      ? Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')
      : null;
    const options = {
      hostname: cfg.host, port: Number(cfg.port) || 9200,
      path, method,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Basic ${auth}` } : {}) },
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
    req.end();
  });
}

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

module.exports = { testConnection, listSchemas, listTables, listColumns };