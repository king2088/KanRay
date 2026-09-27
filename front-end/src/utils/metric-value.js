// 图表取值：按**指标 key** 读行，而不是按 field。
//
// 背景：后端 query-engine.js 对每个指标写四个键
//   row[field]                ← 按字段的便捷副本，同字段的第二个指标会把它盖掉
//   row[key]                  ← 唯一
//   row['metric:' + field]    ← 同样按字段，会被盖掉
//   row['metric:' + key]      ← 唯一
// 前两个「按字段」的键是 last-write-wins 的：一张图里两个指标取同一列
// （库指标 sum(rate) + 内联 avg(rate)）时，两个都只能读到后写入的那个。
// DOM 渲染路径（ChartBuilder / ChartTile）读的是 `metric:<key>`，本来就免疫；
// 只有 ECharts 路径按 field 取值，所以只有它把两个指标画成同一个（且是错的那个）值。
//
// 为什么取 row[key] 而不是 row['metric:' + key]?.value：
//   两者是同一个值——结构化副本只是把同一个值包在 {label, agg, value} 里，
//   而且三种指标（base/expr/derived）都是成对写入的，所以不存在「只有一种形状」的指标。
//   选 row[key] 的理由有三条：
//     1) 类型零变化。row[field] 与 row[key] 取自同一个 SQL 别名，实测同为 number 或同为
//        字符串；绕一层对象既没多给信息，又多一次解包。ECharts 收到的值类型保持原样。
//     2) 每个数据点每个系列都调一次，省掉一次可选链 + 一次属性解包。
//     3) 不做兜底。若 key 真的不在行里，那说明指标定义与响应不匹配，属于该冒出来的错误；
//        加一条 `?? row['metric:' + key]?.value` 只会把它悄悄吞掉。
//   唯一要小心的是**缺值时返回 undefined 而不是 null**：地图分支是
//   `Number(v) ?? null` 后 filter(v !== null && isFinite(v))，Number(null) === 0
//   会把「没有值」的点画成 0，undefined 才能被 filter 掉。这里保留原生属性访问的语义。
//
// 维度不要走这个函数：row[field] 对维度同样是 last-write-wins，但查询层已拒绝重复维度，
// 那不是这个 bug，别顺手一起改。
//
// 无副作用、无 import，可以被 node 直接 import —— 这正是它存在的意义：
// chart-configs.js 走 `@/` 别名，没法被普通 node 测试 import，所以在抽出这个纯函数之前，
// 这里的取值逻辑一行都测不了，只能写源码正则（bug 就是这么活下来的）。

/**
 * 取一行里某个指标的值。
 * @param {object} row 查询响应里的一行
 * @param {object} metric 该指标（响应的 metrics 数组元素，key 已是最终 key）
 * @returns {*} 指标原始值（不做数值强转）；行/指标/键任一缺失时为 undefined
 */
export function metricValue(row, metric) {
  if (!row || !metric) return undefined
  return row[metric.key]
}
