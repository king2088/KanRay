const db = require('../db');
const HttpError = require('../utils/http-error');

/** 解析 JSON 字段（存储为字符串，读取还原对象/数组） */
function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function renderTemplate(d) {
  if (!d) return d;
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? '',
    thumbnail: d.thumbnail ?? '',
    config: safeParse(d.config, {}),
    components: safeParse(d.components, []),
    ownerId: d.ownerId ?? d.owner_id ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

const SELECT_TEMPLATE = `
  SELECT id, name, description, thumbnail, config, components, owner_id AS ownerId,
         created_at AS createdAt, updated_at AS updatedAt
  FROM big_screen_templates
`;

async function listTemplates(where = '') {
  return (await db
    .prepare(`${SELECT_TEMPLATE}${where ? ' WHERE ' + where : ''} ORDER BY created_at DESC`)
    .all())
    .map(renderTemplate);
}

async function getTemplate(id) {
  return renderTemplate(await db.prepare(`${SELECT_TEMPLATE} WHERE id = ?`).get(Number(id)));
}

async function getTemplateOrThrow(id) {
  const t = await getTemplate(id);
  if (!t) throw new HttpError(404, `大屏模板不存在: id=${id}`);
  return t;
}

async function createTemplate(body = {}, ownerId = null) {
  const name = String(body.name || '').trim().slice(0, 100);
  if (!name) throw new HttpError(400, '模板名称不能为空');
  const description = String(body.description || '').slice(0, 500);
  const thumbnail = String(body.thumbnail || '');
  const config = body.config === undefined || body.config === null ? '{}' :
    (typeof body.config === 'string' ? body.config : JSON.stringify(body.config));
  const components = body.components === undefined || body.components === null ? '[]' :
    (typeof body.components === 'string' ? body.components : JSON.stringify(body.components));
  const info = await db
    .prepare('INSERT INTO big_screen_templates (name, description, thumbnail, config, components, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, description, thumbnail, config, components, ownerId == null ? null : Number(ownerId));
  return getTemplate(Number(info.lastInsertRowid));
}

async function deleteTemplate(id) {
  await getTemplateOrThrow(id);
  await db.prepare('DELETE FROM big_screen_templates WHERE id = ?').run(Number(id));
  return true;
}

module.exports = {
  listTemplates,
  getTemplate,
  getTemplateOrThrow,
  createTemplate,
  deleteTemplate,
};