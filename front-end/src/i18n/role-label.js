// 角色文案取值纯函数：不依赖 Vue 实例，便于 node 测试直接引入。
// t/te 由调用方注入——UserAdmin/RoleAdmin 传 useI18n() 的，
// UserMenu 传 @/i18n 的全局导出，两边签名一致。
// 只对内置角色查词典；自定义角色直接用数据库里的原文，不做翻译。

const keyOf = (code, field) => `admin.role.builtinLabels.${code}.${field}`

const label = (t, te, role, field, fallback) => {
  const code = role?.code
  if (role?.is_builtin && code && te(keyOf(code, field))) return t(keyOf(code, field))
  return fallback || ''
}

export function roleName(t, te, role) {
  // 名称缺失时兜底 code，与改前 UserAdmin 的 `roleNameMap[r] || r` 行为一致
  return label(t, te, role, 'name', role?.name || role?.code)
}

export function roleDesc(t, te, role) {
  // 描述没有 code 兜底：没有就是空串，不把 code 摆在描述列里
  return label(t, te, role, 'desc', role?.description)
}
