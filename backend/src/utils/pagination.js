const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/** 解析请求中的分页参数，未传任何分页参数时返回 null（表示不分页） */
function parsePageQuery(query) {
  const hasPage = query.page !== undefined && query.page !== null && query.page !== '';
  const hasPageSize = query.pageSize !== undefined && query.pageSize !== null && query.pageSize !== '';
  if (!hasPage && !hasPageSize) return null;
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.pageSize || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

/** 将一个数组按分页切片，返回 { list, total } */
function paginate(items, page, pageSize) {
  const total = items.length;
  const list = items.slice((page - 1) * pageSize, page * pageSize);
  return { list, total };
}

module.exports = { parsePageQuery, paginate, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };