// 连接测试结果文案的取值纯函数：不依赖 Vue 实例，t 由调用方注入，
// 与 role-label.js 同一形状，便于 node 测试直接引入。
// detail 由调用方用 localizeApiMessage(message, messageEn) 算好后传入——
// 这里不 import ./index.js，免得把 vue-i18n 拖进纯函数，测试脚本就不必初始化 i18n 实例。
//
// 界面原本直接渲染 dataset.dataSource.testSuccess / testFailed 这两个带 {message} 的模板。
// 但 provider 的「连接成功」只是复述了「测试成功」这个结论、没有额外信息，硬拼进去会得到
// 「Connection succeeded: Connection successful」——中英两侧都冗余。
// 而「文件数据源已导入」「集群状态: degraded」这类是有信息量的，必须照原样带出。
// 所以只有详情恰好等于 provider 的连接成功提示、或 provider 根本没给文案时，才退回不带详情的模板。
//
// 「无信息量的 provider 文案」用 i18n 键表达而不是在前端写中文常量：provider 原文恒为中文，
// localizeApiMessage 按当前语言给出对应译文，这里用同一个 t() 取值，两边在同一种语言下比较。
// 注意不能用 te()——那是键存在性探针（i18n/index.js），恒按 en-US 判定，
// 中文界面下永远比不相等，冗余照样存在。
//
// 四个模板键刻意写成字面量 t() 调用而不是拼 ``${base}Plain``：i18n-keys-test.mjs 的
// 「未被引用的词典键」靠正则扫源码里的 t('...')，拼出来的键名它看不见，会被当成死键。

export function datasourceTestMessage(t, ok, detail) {
  if (!detail || detail === t('dataset.dataSource.providerConnected')) {
    return ok ? t('dataset.dataSource.testSuccessPlain') : t('dataset.dataSource.testFailedPlain')
  }
  return ok
    ? t('dataset.dataSource.testSuccess', { message: detail })
    : t('dataset.dataSource.testFailed', { message: detail })
}
