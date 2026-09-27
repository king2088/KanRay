import { ElMessage } from 'element-plus'

// 错误提示只该弹一次。
//
// http.js 的响应拦截器默认已经弹过 toast（调用方可用 config.silent 抑制），
// catch 块里再来一句 ElMessage.error(e?.message || t('...')) 会得到两条：
//   - 业务错误（响应 code !== 0）：拦截器 reject 的是已本地化的 new Error(msg)，
//     两条内容一模一样，纯重复
//   - HTTP 错误：拦截器用原始 axios err reject，e.message 是
//     "Request failed with status code 500" 这类未翻译的 axios 原文——
//     中文界面里第二条直接冒英文，而第一条已经是本地化文案
// 拦截器弹过的错误会带上 e.toasted，这里据此跳过。
// 兜底文案仍保留给真正没被拦截器处理的异常（store 抛错、JS TypeError 等）。

// 判定逻辑单独拆成纯函数：不 import element-plus，node 测试可直接引入。
export function apiErrorMessage(e, fallback) {
  if (!e || e.toasted) return null
  return e.message || fallback || ''
}

export function toastApiError(t, e, fallbackKey) {
  const msg = apiErrorMessage(e, t(fallbackKey))
  if (msg) ElMessage.error(msg)
}

// 拦截器弹过 toast 时在错误对象上打标记，让下游 catch 块知道不用再弹。
export function markToasted(e) {
  if (e && typeof e === 'object') e.toasted = true
  return e
}
