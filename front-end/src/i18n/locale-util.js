// 语言选择纯函数：不依赖 Vue，便于 node 测试直接引入。

export function isEnglish(locale) {
  return locale === 'en-US'
}

// 后端接口文案双字段选择：英文界面优先取英文，缺失时回退中文。
export function pickLocaleText(locale, textZh, textEn) {
  if (isEnglish(locale)) return textEn || textZh || ''
  return textZh || ''
}
