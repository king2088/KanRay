// 文件型数据源（Excel/CSV 上传）浏览：映射到数据集落库的本地表。
// cfg.tableName 为关联的 ds_* 本地表；旧行缺省为空 → 浏览返回空清单。
const db = require('../../db');
const { file: fileDialect } = require('../dialects');
const { toDialect } = require('../portable-sql');
const { render } = require('./interpolate');

const NUMERIC = /int|float|double|decimal|numeric|bigint|smallint|tinyint|number|real/i;

function safeDsTable(table) {
  const t = String(table || '').trim().replace(/[^A-Za-z0-9_]/g, '');
  if (!/^ds_/i.test(t)) throw new Error('文件数据源仅允许访问数据集本地表（ds_*）');
  return t;
}

function createProvider() {
  async function testConnection() {
    return { ok: true, message: '文件数据源已导入' };
  }

  function listSchemas() {
    return Promise.resolve([{ name: 'local' }]);
  }

  async function listTables(cfg) {
    if (!cfg || !cfg.tableName) return [];
    const t = safeDsTable(cfg.tableName);
    const all = (await db.listTables()).map((n) => String(n).toLowerCase());
    return all.includes(t.toLowerCase()) ? [{ name: String(cfg.tableName), type: 'table' }] : [];
  }

  async function listColumns(cfg, type, schema, table) {
    const target = table || (cfg && cfg.tableName) || null;
    if (cfg && Array.isArray(cfg.columns) && cfg.columns.length
      && (!target || String(target).replace(/[^A-Za-z0-9_]/g, '') === String(cfg.tableName || '').replace(/[^A-Za-z0-9_]/g, ''))) {
      return cfg.columns.map((c) => ({
        name: String(c.name),
        type: String(c.type || 'string'),
        label: c.label != null ? String(c.label) : String(c.name),
        role: NUMERIC.test(String(c.type || '')) ? 'metric' : 'dimension',
      }));
    }
    const t = safeDsTable(target);
    const cols = await db.listColumns(t);
    return cols.map((c) => {
      const type = String(c.type || 'text').toLowerCase();
      return { name: c.name, type, role: NUMERIC.test(type) ? 'metric' : 'dimension' };
    });
  }

  async function runQuery(cfg, sql, params = []) {
    const native = toDialect(sql, fileDialect);
    const final = params && params.length ? render(native, params) : native;
    const m = final.match(/FROM\s+(?:(?:["`]?[A-Za-z0-9_]+["`]?)\s*\.\s*)?["`]?([A-Za-z0-9_]+)["`]?(?:\s|$)/i);
    if (m) safeDsTable(m[1]);
    if (/\s;\s*--/i.test(final) || final.split(';').length > 2) throw new Error('文件数据源仅允许单条查询');
    return db.prepare(final).all();
  }

  return { testConnection, listSchemas, listTables, listColumns, runQuery };
}

module.exports = createProvider();
module.exports.createProvider = createProvider;