// Hive/Impala 共用的 HS2 provider 工厂：元数据走 SHOW/DESCRIBE，查询走 hs2 会话。
// connectImpl 可注入 fake（单测）；缺省使用 providers/hs2 的真实连接。
const { connect } = require('./hs2');
const { toDialect } = require('../portable-sql');
const { render } = require('./interpolate');

function firstValue(r) {
  if (!r || typeof r !== 'object') return null;
  const k = Object.keys(r);
  return k.length ? r[k[0]] : null;
}

function makeProvider({ dialect, engine, connectImpl = connect }) {
  async function run(cfg, fn) {
    const s = await connectImpl(cfg);
    try {
      return await fn(s);
    } finally {
      await s.close();
    }
  }

  async function testConnection(cfg) {
    try {
      await run(cfg, (s) => s.execute('SELECT 1'));
      return { ok: true, message: '连接成功' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async function listSchemas(cfg) {
    return run(cfg, async (s) => {
      const rows = await s.execute('SHOW DATABASES');
      return rows.map((r) => ({ name: String(firstValue(r)) }));
    });
  }

  async function listTables(cfg, type, schema) {
    return run(cfg, async (s) => {
      const q = (n) => dialect.quoteIdent(String(n));
      const rows = await s.execute(schema ? `SHOW TABLES IN ${q(schema)}` : 'SHOW TABLES');
      return rows.map((r) => ({ name: String(firstValue(r)), type: 'table' }));
    });
  }

  async function listColumns(cfg, type, schema, table) {
    return run(cfg, async (s) => {
      const q = (n) => dialect.quoteIdent(String(n));
      const qualified = schema ? `${q(schema)}.${q(table)}` : q(table);
      const rows = await s.execute(`DESCRIBE ${qualified}`);
      return rows
        .filter((r) => !/^#/.test(String(firstValue(r))))
        .map((r) => {
          const vals = Object.values(r);
          const name = String(vals[0]);
          const t = String(vals[1] != null ? vals[1] : 'string');
          return { name, type: t, role: /int|double|float|decimal|bigint|smallint|tinyint|number|real/i.test(t) ? 'metric' : 'dimension' };
        });
    });
  }

  async function runQuery(cfg, sql, params = []) {
    const native = toDialect(sql, dialect);
    const final = params && params.length ? render(native, params) : native;
    return run(cfg, (s) => s.execute(final));
  }

  return { testConnection, listSchemas, listTables, listColumns, runQuery };
}

module.exports = { makeProvider };