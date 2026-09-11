// 图表类型 SVG 图标（统一风格：24×24 viewBox，stroke 线稿，圆头圆角，线宽一致）
// key 为 CHART_TYPES 中的 value；value 为 <g> 内部内容
export const CHART_ICON_PATHS = {
  // ---------- 柱形图 ----------
  bar:
    '<rect x="3.5" y="9" width="5" height="10" rx="1"/><rect x="10" y="4" width="5" height="15" rx="1"/><rect x="16.5" y="12" width="4" height="7" rx="1"/>',
  barClustered:
    '<rect x="3" y="9" width="4" height="10" rx="1"/><rect x="7.5" y="5" width="4" height="14" rx="1"/><rect x="14" y="11" width="4" height="8" rx="1"/><rect x="18.5" y="7" width="2.5" height="12" rx="1"/>',
  barStacked:
    '<rect x="8" y="2.5" width="8" height="5.3" rx="1"/><rect x="8" y="8.3" width="8" height="5.3" rx="1"/><rect x="8" y="14.1" width="8" height="5.3" rx="1"/>',
  barPercentStacked:
    '<rect x="8" y="2.5" width="8" height="5.3" rx="1"/><rect x="8" y="8.3" width="8" height="5.3" rx="1" stroke-dasharray="2.5 1.6"/><rect x="8" y="14.1" width="8" height="5.3" rx="1"/>',
  barGroupStacked:
    '<rect x="4" y="5" width="3" height="13" rx="1"/><rect x="7.5" y="9" width="3" height="9" rx="1"/><rect x="13.5" y="3" width="3" height="15" rx="1"/><rect x="17" y="7" width="3" height="11" rx="1"/>',
  barLine:
    '<rect x="3" y="9" width="4" height="9" rx="1"/><rect x="9" y="5" width="4" height="13" rx="1"/><polyline points="3,12 10,8 17,11 21,6"/>',
  barPictorial:
    '<rect x="3" y="9" width="4" height="9" rx="1"/><rect x="9" y="5" width="4" height="13" rx="1"/><circle cx="16.5" cy="6" r="2.6"/>',
  barStackedLine:
    '<rect x="8" y="2.5" width="8" height="5.3" rx="1"/><rect x="8" y="8.3" width="8" height="5.3" rx="1"/><rect x="8" y="14.1" width="8" height="5.3" rx="1"/><polyline points="2,12 9,7 14,10 22,5"/>',
  barStackedPictorial:
    '<rect x="8" y="2.5" width="8" height="5.3" rx="1"/><rect x="8" y="8.3" width="8" height="5.3" rx="1"/><rect x="8" y="14.1" width="8" height="5.3" rx="1"/><circle cx="12" cy="2.5" r="1.8"/>',
  bullet:
    '<rect x="3" y="5" width="10" height="4" rx="1"/><rect x="3" y="13" width="16" height="4" rx="1"/><path d="M17 3.5v18"/>',
  waterfall:
    '<path d="M3 20V9h5v3h5v-7h5v15z"/><path d="M2.5 20h19"/>',
  pareto:
    '<rect x="3" y="11" width="4" height="9" rx="1"/><rect x="8" y="7" width="4" height="13" rx="1"/><rect x="13" y="4" width="4" height="16" rx="1"/><polyline points="3,11 10,7 17,4 21,10"/>',

  // ---------- 条形图 ----------
  horizontalBar:
    '<rect x="3" y="3" width="15" height="4" rx="1"/><rect x="3" y="10" width="10" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/>',
  horizontalBarClustered:
    '<rect x="3" y="3" width="14" height="3" rx="1"/><rect x="3" y="7" width="7" height="3" rx="1"/><rect x="3" y="13" width="12" height="3" rx="1"/><rect x="3" y="17" width="6" height="3" rx="1"/>',
  horizontalBarStacked:
    '<rect x="3" y="6" width="8" height="5" rx="1"/><rect x="11.5" y="6" width="5" height="5" rx="1"/><rect x="17" y="6" width="4" height="5" rx="1"/>',
  horizontalBarPercentStacked:
    '<rect x="3" y="6" width="8" height="5" rx="1"/><rect x="11.5" y="6" width="5" height="5" rx="1" stroke-dasharray="2.5 1.6"/><rect x="17" y="6" width="4" height="5" rx="1"/>',
  horizontalBarGroupStacked:
    '<rect x="3" y="4" width="6" height="4" rx="1"/><rect x="9.5" y="4" width="11" height="4" rx="1"/><rect x="3" y="14" width="10" height="4" rx="1"/><rect x="13.5" y="14" width="7" height="4" rx="1"/>',
  horizontalBullet:
    '<rect x="3" y="5" width="10" height="4" rx="1"/><rect x="3" y="13" width="16" height="4" rx="1"/><path d="M18 2v20"/>',
  butterfly:
    '<rect x="3" y="3" width="8" height="4" rx="1"/><rect x="13" y="3" width="8" height="4" rx="1"/><rect x="3" y="9" width="5" height="4" rx="1"/><rect x="16" y="9" width="5" height="4" rx="1"/><rect x="3" y="15" width="11" height="4" rx="1"/><rect x="10" y="15" width="11" height="4" rx="1"/>',

  // ---------- 折线图与面积图 ----------
  line: '<polyline points="3,16 8,11 13,14 21,5"/>',
  lineMulti:
    '<polyline points="3,17 8,11 13,14 21,7"/><polyline points="3,20 8,8 13,12 21,15"/>',
  areaStacked:
    '<path d="M3 18 8 11 13 14 21 7v9H3z"/><path d="M3 18 8 14 13 17 21 12v4H3z"/>',
  areaPercentStacked:
    '<path d="M3 18 8 11 13 14 21 7v9H3z"/><path d="M3 18 8 14 13 17 21 12v4H3z" stroke-dasharray="3 2"/>',

  // ---------- 饼图与漏斗图 ----------
  pie:
    '<circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="3"/><line x1="12" y1="12" x2="20.1" y2="9.2"/>',
  doughnut:
    '<path d="M12 3.5a8.5 8.5 0 1 0 7.4 4.3"/><path d="M19.4 8 12 8.5V12"/>',
  sunburst:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="2.2"/>',
  nightingale:
    '<path d="M12 12 7.3 5.6a8.6 8.6 0 0 1 9.4 0z"/><path d="M12 12l6.8 5.6a8.6 8.6 0 0 1-9 4z"/><path d="M12 12 4.5 12.4a8.6 8.6 0 0 1 2-4.1z"/>',
  funnel:
    '<path d="M4 3.5h16l-3.2 5H7.2z"/><path d="M6.7 8.5h10.6l-2.7 5H9.4z"/><path d="M9 13.5h6l-3 6z"/>',
  funnelHorizontal:
    '<rect x="4" y="4" width="16" height="3.2" rx="1"/><rect x="4" y="8.8" width="12" height="3.2" rx="1"/><rect x="4" y="13.6" width="8" height="3.2" rx="1"/><rect x="4" y="18.4" width="4" height="2.4" rx="1"/>',

  // ---------- 散点与气泡 ----------
  scatter:
    '<circle cx="5.5" cy="6" r="2.1"/><circle cx="13.5" cy="11" r="2.1"/><circle cx="18.5" cy="16" r="2.1"/><circle cx="9" cy="17.5" r="1.6"/><circle cx="16.5" cy="5" r="1.6"/>',
  bubble:
    '<circle cx="8" cy="14.5" r="6"/><circle cx="16" cy="7.5" r="4.4"/><circle cx="18" cy="15.5" r="2.6"/>',

  // ---------- 指标与进度 ----------
  stat:
    '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M7.5 9h9M7.5 13.5h5.5"/>',
  progressBar:
    '<rect x="4" y="9" width="16" height="6" rx="3"/><rect x="5.6" y="10.6" width="9" height="2.8" rx="1.4"/>',
  circularProgress:
    '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 7.1 4.3"/><path d="M17.2 10.6a6.2 6.2 0 0 1-1.6 8.6"/>',
  multiRingProgress:
    '<path d="M12 3.5a8.5 8.5 0 1 1-4.6 15.7"/><path d="M7 18.6a11.5 11.5 0 1 0 13.7-1.6"/><path d="M18.7 15.2a14 14 0 1 0-13 1.2"/>',
  fluidProgress:
    '<circle cx="12" cy="12" r="8.5"/><path d="M5.5 13.5c2-1.2 4-1.2 6 0s4 1.2 6 0"/><path d="M5.5 15c2-1.2 4-1.2 6 0s4 1.2 6 0v4H5.5z"/>',
  gauge:
    '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17 15.5 9"/>',
  statTrend:
    '<rect x="4" y="3.5" width="16" height="17" rx="2"/><polyline points="6.5,15 10.5,10.5 13.5,13 18,8"/>',

  // ---------- 地图 ----------
  mapChina:
    '<path d="M10.5 5.2c1.8-1.4 4.4-1.2 5.9-.2 1.8 1.1 2.4 2.7 2.2 4.3-.2 1.5-1 2.6-1.5 3.7-.6 1.3-.1 2.8-.9 4.1-1 1.4-2.9 1.7-4.6 1.4-1.8-.3-3-.8-3.6-2.2-.7-1.5-.9-3.2-.4-4.8.5-1.5 1-3.1.6-4.4-.5-2-1.5-1.6 2.3-1.9z"/>',
  mapChinaBubble:
    '<path d="M10.5 5.2c1.8-1.4 4.4-1.2 5.9-.2 1.8 1.1 2.4 2.7 2.2 4.3-.2 1.5-1 2.6-1.5 3.7-.6 1.3-.1 2.8-.9 4.1-1 1.4-2.9 1.7-4.6 1.4-1.8-.3-3-.8-3.6-2.2-.7-1.5-.9-3.2-.4-4.8.5-1.5 1-3.1.6-4.4-.5-2-1.5-1.6 2.3-1.9z"/><circle cx="16.5" cy="8.5" r="2.2"/>',
  mapChinaSymbol:
    '<path d="M10.5 5.2c1.8-1.4 4.4-1.2 5.9-.2 1.8 1.1 2.4 2.7 2.2 4.3-.2 1.5-1 2.6-1.5 3.7-.6 1.3-.1 2.8-.9 4.1-1 1.4-2.9 1.7-4.6 1.4-1.8-.3-3-.8-3.6-2.2-.7-1.5-.9-3.2-.4-4.8.5-1.5 1-3.1.6-4.4-.5-2-1.5-1.6 2.3-1.9z"/><circle cx="7" cy="11" r="1.5"/><circle cx="18.5" cy="13.5" r="1.5"/>',
  mapWorld:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4.2" ry="9"/><ellipse cx="12" cy="12" rx="9" ry="4.2"/>',

  // ---------- 表格 ----------
  table:
    '<rect x="4" y="3.5" width="16" height="17" rx="1"/><path d="M4 8.5h16M4 13.5h16M10 3.5v17M15.5 3.5v17"/>',

  // ---------- 其他 ----------
  heatmap:
    '<rect x="4" y="4" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.35"/><rect x="9.2" y="4" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.9"/><rect x="14.4" y="4" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.55"/><rect x="19" y="4" width="2" height="3.8" rx="0.8" fill="currentColor" opacity="0.25"/><rect x="4" y="9.2" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.7"/><rect x="9.2" y="9.2" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.3"/><rect x="14.4" y="9.2" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.8"/><rect x="4" y="14.4" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.45"/><rect x="9.2" y="14.4" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.65"/><rect x="14.4" y="14.4" width="3.8" height="3.8" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="19" y="14.4" width="2" height="3.8" rx="0.8" fill="currentColor" opacity="0.3"/><rect x="4" y="19" width="3.8" height="1.5" rx="0.8" fill="currentColor" opacity="0.35"/><rect x="9.2" y="19" width="3.8" height="1.5" rx="0.8" fill="currentColor" opacity="0.5"/>',
  boxplot:
    '<rect x="8" y="7.5" width="8" height="9" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="3.5" x2="8" y2="7.5"/><path d="M4 3.5h8"/><line x1="16" y1="16.5" x2="16" y2="20.5"/><path d="M12 20.5h8"/>',
  radar:
    '<polygon points="12,4 19.5,8.8 16.7,17.4 7.3,17.4 4.5,8.8 12,4"/><polygon points="12,7.6 16,11 14,15 10,15 8,11 12,7.6"/>',
  polarBar:
    '<path d="M12 12 7.1 5.9a9 9 0 0 1 9.8 0z"/><path d="M12 12l6.5 5.6a9 9 0 0 1-6.5 3.1z"/><path d="M12 12 3.8 15.3a9 9 0 0 1 2.4-8.7z"/>',
  barBreakAxis:
    '<path d="M3 20V8h4v3h4v-6h4v4h3v11z"/><path d="M11.5 14.5l2 2M13.5 14.5l-2 2"/>',
  calendar:
    '<rect x="4" y="4.5" width="16" height="16" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4M8.5 13h3M8.5 17h3M13.5 13h3M13.5 17h3"/>',
  candlestick:
    '<line x1="8" y1="5" x2="8" y2="19"/><rect x="6.4" y="8" width="3.2" height="5" rx="0.6"/><line x1="15.5" y1="3.5" x2="15.5" y2="20.5"/><rect x="13.9" y="6.5" width="3.2" height="6" rx="0.6"/>',
  treemap:
    '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12.5h9M13 4v8.5M13 12.5v7.5M4 18.5h9"/>',
  sankey:
    '<rect x="3" y="5" width="4" height="5" rx="0.8"/><rect x="3" y="13" width="4" height="5" rx="0.8"/><rect x="17" y="4" width="4" height="5" rx="0.8"/><rect x="17" y="12" width="4" height="5" rx="0.8"/><path d="M7 7c4 0 3 3 10 1"/><path d="M7 15c4 0 6 2 10 0"/><path d="M7 14c2 0 2 1 10-1"/>',
  chord:
    '<circle cx="12" cy="12" r="9"/><path d="M7 5.6 17.8 18"/><path d="M19 9.5 5 11.8"/><path d="M16.5 5 9.5 19"/>',
}