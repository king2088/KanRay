// 把 ? 占位符按序替换为安全的字面量（引擎传入的滤值均为标量）
function render(sql, params = []) {
  let i = 0;
  return String(sql).replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

module.exports = { render };