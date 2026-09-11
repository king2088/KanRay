// 图表类型 SVG 图标（专业彩色风格）
// 统一风格：24×24 viewBox，填充色 + 细节线条，色板固定：
//   蓝 #409EFF / 深蓝 #2E6BE6 / 浅蓝 #79BBFF；青 #36CFC9；橙 #F7BA2A/#E6A23C
//   绿 #67C23A；红 #F56C6C/#E4555B；紫 #826AF9；浅底 #F7F9FC/#EFF3F8；轨道灰 #E8EEF6
// 相邻色块间用白色分隔线，避免中心空白的描边风格
export const CHART_ICON_PATHS = {
  // ---------- 柱形图 ----------
  bar:
    '<rect x="3.5" y="9" width="5" height="10" rx="1.3" fill="#409EFF"/><rect x="9.8" y="4" width="5" height="15" rx="1.3" fill="#67C23A"/><rect x="16.1" y="12" width="4.4" height="7" rx="1.3" fill="#F7BA2A"/>',
  barClustered:
    '<rect x="2.6" y="9" width="4" height="10" rx="1.2" fill="#409EFF"/><rect x="6.7" y="5" width="4" height="14" rx="1.2" fill="#79BBFF"/><rect x="13.3" y="11" width="4" height="8" rx="1.2" fill="#E6A23C"/><rect x="17.4" y="7" width="3.9" height="12" rx="1.2" fill="#F7BA2A"/>',
  barStacked:
    '<rect x="8" y="2.5" width="8" height="5.2" rx="1.2" fill="#409EFF"/><rect x="8" y="8" width="8" height="5.2" rx="1.2" fill="#36CFC9"/><rect x="8" y="13.5" width="8" height="5.7" rx="1.2" fill="#F7BA2A"/>',
  barPercentStacked:
    '<rect x="8" y="2.5" width="8" height="5.2" rx="1.2" fill="#409EFF"/><rect x="8" y="8" width="8" height="5.2" rx="1.2" fill="#36CFC9" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/><rect x="8" y="13.5" width="8" height="5.7" rx="1.2" fill="#F7BA2A"/>',
  barGroupStacked:
    '<rect x="3.5" y="5" width="3.2" height="13" rx="1.2" fill="#409EFF"/><rect x="7" y="9" width="3.2" height="9" rx="1.2" fill="#36CFC9"/><rect x="13.8" y="3" width="3.2" height="15" rx="1.2" fill="#E6A23C"/><rect x="17.3" y="7.5" width="3.2" height="10.5" rx="1.2" fill="#F7BA2A"/>',
  barLine:
    '<rect x="3" y="9" width="4" height="9" rx="1.2" fill="#409EFF"/><rect x="9" y="5" width="4" height="13" rx="1.2" fill="#79BBFF"/><polyline points="3,12 10,8 17,11 21,6" fill="none" stroke="#F56C6C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  barPictorial:
    '<rect x="3" y="9" width="4" height="9" rx="1.2" fill="#409EFF"/><rect x="9" y="5" width="4" height="13" rx="1.2" fill="#79BBFF"/><circle cx="16.6" cy="5.8" r="2.6" fill="#F7BA2A"/>',
  barStackedLine:
    '<rect x="8" y="2.5" width="8" height="5.2" rx="1.2" fill="#409EFF"/><rect x="8" y="8" width="8" height="5.2" rx="1.2" fill="#36CFC9"/><rect x="8" y="13.5" width="8" height="5.7" rx="1.2" fill="#F7BA2A"/><polyline points="2,12 9,7 14,10 22,5" fill="none" stroke="#F56C6C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  barStackedPictorial:
    '<rect x="8" y="2.5" width="8" height="5.2" rx="1.2" fill="#409EFF"/><rect x="8" y="8" width="8" height="5.2" rx="1.2" fill="#36CFC9"/><rect x="8" y="13.5" width="8" height="5.7" rx="1.2" fill="#F7BA2A"/><circle cx="12" cy="2.5" r="1.9" fill="#826AF9"/>',
  bullet:
    '<rect x="3" y="5" width="10" height="4" rx="1.2" fill="#409EFF"/><rect x="3" y="13" width="16" height="4" rx="1.2" fill="#F7BA2A"/><line x1="17" y1="3" x2="17" y2="21" stroke="#2E6BE6" stroke-width="2.4" stroke-linecap="round"/>',
  waterfall:
    '<rect x="3" y="9" width="5" height="10" rx="1.2" fill="#409EFF"/><rect x="9.5" y="11" width="5" height="8" rx="1.2" fill="#36CFC9"/><rect x="16" y="5" width="5" height="14" rx="1.2" fill="#F56C6C"/><path d="M2.5 19.5h19" stroke="#5B6B7F" stroke-width="1.6" stroke-linecap="round"/>',
  pareto:
    '<rect x="3" y="11" width="4" height="9" rx="1.2" fill="#79BBFF"/><rect x="8" y="7" width="4" height="13" rx="1.2" fill="#409EFF"/><rect x="13" y="4" width="4" height="16" rx="1.2" fill="#2E6BE6"/><polyline points="3,11 10,7 17,4 21,10" fill="none" stroke="#E6A23C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',

  // ---------- 条形图 ----------
  horizontalBar:
    '<rect x="3" y="3" width="15" height="4" rx="1.2" fill="#409EFF"/><rect x="3" y="10" width="10" height="4" rx="1.2" fill="#67C23A"/><rect x="3" y="17" width="18" height="4" rx="1.2" fill="#F7BA2A"/>',
  horizontalBarClustered:
    '<rect x="3" y="3" width="14" height="3" rx="1" fill="#409EFF"/><rect x="3" y="7" width="7" height="3" rx="1" fill="#79BBFF"/><rect x="3" y="13" width="12" height="3" rx="1" fill="#E6A23C"/><rect x="3" y="17" width="6" height="3" rx="1" fill="#F7BA2A"/>',
  horizontalBarStacked:
    '<rect x="3" y="6" width="8" height="5" rx="1.2" fill="#409EFF"/><rect x="11.3" y="6" width="5" height="5" rx="1.2" fill="#36CFC9"/><rect x="16.6" y="6" width="4.5" height="5" rx="1.2" fill="#F7BA2A"/>',
  horizontalBarPercentStacked:
    '<rect x="3" y="6" width="8" height="5" rx="1.2" fill="#409EFF"/><rect x="11.3" y="6" width="5" height="5" rx="1.2" fill="#36CFC9" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/><rect x="16.6" y="6" width="4.5" height="5" rx="1.2" fill="#F7BA2A"/>',
  horizontalBarGroupStacked:
    '<rect x="3" y="4" width="6" height="4" rx="1.2" fill="#409EFF"/><rect x="9.3" y="4" width="11" height="4" rx="1.2" fill="#36CFC9"/><rect x="3" y="14" width="10" height="4" rx="1.2" fill="#E6A23C"/><rect x="13.3" y="14" width="7" height="4" rx="1.2" fill="#F7BA2A"/>',
  horizontalBullet:
    '<rect x="3" y="5" width="10" height="4" rx="1.2" fill="#409EFF"/><rect x="3" y="13" width="16" height="4" rx="1.2" fill="#F7BA2A"/><line x1="18" y1="2.5" x2="18" y2="21.5" stroke="#2E6BE6" stroke-width="2.4" stroke-linecap="round"/>',
  butterfly:
    '<rect x="3" y="3" width="8" height="4" rx="1.2" fill="#409EFF"/><rect x="13" y="3" width="8" height="4" rx="1.2" fill="#F56C6C"/><rect x="3" y="9" width="5" height="4" rx="1.2" fill="#79BBFF"/><rect x="16" y="9" width="5" height="4" rx="1.2" fill="#F9A3A3"/><rect x="3" y="15" width="11" height="4" rx="1.2" fill="#2E6BE6"/><rect x="10" y="15" width="11" height="4" rx="1.2" fill="#E4555B"/>',

  // ---------- 折线图与面积图 ----------
  line:
    '<polyline points="3,16 8,11 13,14 21,6" fill="none" stroke="#409EFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3" cy="16" r="1.6" fill="#409EFF"/><circle cx="21" cy="6" r="2.2" fill="#F7BA2A"/>',
  lineMulti:
    '<polyline points="3,17 8,11 13,14 21,7" fill="none" stroke="#409EFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="3,20.5 8,7.5 13,11.5 21,16" fill="none" stroke="#F56C6C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.5" fill="#409EFF"/>',
  areaStacked:
    '<path d="M3 17.5 8 12 13 15 21 7.5V17.5Z" fill="#2E6BE6"/><path d="M3 17.5 8 15 13 17 21 12V17.5Z" fill="#F7BA2A"/>',
  areaPercentStacked:
    '<path d="M3 17.5 8 12 13 15 21 7.5V17.5Z" fill="#2E6BE6"/><path d="M3 17.5 8 15 13 17 21 12V17.5Z" fill="#F7BA2A" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/>',

  // ---------- 饼图与漏斗图 ----------
  pie:
    '<circle cx="12" cy="12" r="9" fill="#EFF4FA"/><path d="M12 12 12 3.5A8.5 8.5 0 0 1 20.5 12Z" fill="#409EFF" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 12 20.5 12A8.5 8.5 0 0 1 9.1 20Z" fill="#F7BA2A" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>',
  doughnut:
    '<circle cx="12" cy="12" r="8.5" fill="none" stroke="#E8EEF6" stroke-width="4.6"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="#409EFF" stroke-width="4.6" stroke-linecap="round"/><path d="M12 12h2.6a2.6 2.6 0 1 0-.9-2" fill="none" stroke="#F7BA2A" stroke-width="1.4"/>',
  sunburst:
    '<circle cx="12" cy="12" r="9.2" fill="#409EFF"/><circle cx="12" cy="12" r="5.8" fill="#36CFC9"/><circle cx="12" cy="12" r="2.4" fill="#F7BA2A"/>',
  nightingale:
    '<path d="M12 12 12 3.5A9 9 0 0 1 19.79 16.5Z" fill="#409EFF" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 12 19.79 16.5A6.5 6.5 0 0 1 6.37 15.25Z" fill="#F7BA2A" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 12 6.37 15.25A8.6 8.6 0 0 1 12 3.5Z" fill="#36CFC9" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>',
  funnel:
    '<path d="M4 3.5h16l-3.2 5.4H7.2z" fill="#409EFF" stroke="#fff" stroke-width="1" stroke-linejoin="round"/><path d="M6.7 8.9h10.6l-2.7 5.4H9.4z" fill="#36CFC9" stroke="#fff" stroke-width="1" stroke-linejoin="round"/><path d="M9 14.3h6l-3 6z" fill="#F7BA2A" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>',
  funnelHorizontal:
    '<rect x="3" y="4" width="17" height="4" rx="1.2" fill="#409EFF"/><rect x="3" y="9.6" width="13" height="4" rx="1.2" fill="#36CFC9"/><rect x="3" y="15.2" width="9" height="4" rx="1.2" fill="#F7BA2A"/>',

  // ---------- 散点与气泡 ----------
  scatter:
    '<circle cx="5.5" cy="6" r="2.4" fill="#409EFF"/><circle cx="13.5" cy="11" r="2.4" fill="#F56C6C"/><circle cx="18.5" cy="16" r="2.4" fill="#36CFC9"/><circle cx="9" cy="17.5" r="1.8" fill="#E6A23C"/><circle cx="16.5" cy="4.6" r="1.8" fill="#826AF9"/>',
  bubble:
    '<circle cx="8" cy="14.5" r="6" fill="#409EFF"/><circle cx="16.5" cy="7.5" r="4.4" fill="#F56C6C"/><circle cx="18.2" cy="15.5" r="2.7" fill="#36CFC9"/><circle cx="8" cy="14.5" r="6" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="6.6" cy="12.4" r="1.2" fill="#fff" opacity=".85"/><circle cx="15.7" cy="5.8" r="1" fill="#fff" opacity=".85"/>',

  // ---------- 指标与进度 ----------
  stat:
    '<rect x="4" y="4" width="16" height="16" rx="2.4" fill="#F7F9FC"/><rect x="4" y="4" width="16" height="6" rx="2.4" fill="#409EFF"/><rect x="7" y="13" width="10" height="3.4" rx="1.7" fill="#36CFC9"/><rect x="7" y="18" width="6.5" height="2" rx="1" fill="#C0C4CC"/>',
  progressBar:
    '<rect x="4" y="9" width="16" height="6" rx="3" fill="#E8EEF6"/><rect x="5.5" y="10.4" width="11" height="3.2" rx="1.6" fill="#67C23A"/><circle cx="16.8" cy="12" r="2.5" fill="#F7BA2A"/>',
  circularProgress:
    '<circle cx="12" cy="12" r="8.4" fill="#E8EEF6"/><path d="M12 3.6a8.4 8.4 0 0 1 8.4 8.4" fill="none" stroke="#409EFF" stroke-width="3.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.8" fill="#409EFF"/>',
  multiRingProgress:
    '<circle cx="12" cy="12" r="9" fill="#E8EEF6"/><circle cx="12" cy="12" r="9" fill="none" stroke="#409EFF" stroke-width="3" stroke-dasharray="16 13" stroke-linecap="round"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#36CFC9" stroke-width="3" stroke-dasharray="11 8" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="#F7BA2A"/>',
  fluidProgress:
    '<circle cx="12" cy="12" r="8.5" fill="#EAF6FF" stroke="#409EFF" stroke-width="1.4"/><path d="M4.5 14c2.2-1.3 4.2-1.3 6.4 0s4.2 1.3 6.4 0" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M4.5 15.4c2.2-1.3 4.2-1.3 6.4 0s4.2 1.3 6.4 0v4.1H4.5z" fill="#409EFF"/>',
  gauge:
    '<path d="M4 18a8 8 0 0 1 16 0Z" fill="#EFF3F8"/><path d="M7.2 18a4.8 4.8 0 0 1 9.6 0Z" fill="#F7BA2A"/><path d="M12 18V7.2" stroke="#5B6B7F" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="18" r="2.4" fill="#409EFF"/>',
  statTrend:
    '<rect x="4" y="4" width="16" height="16" rx="2.4" fill="#F7F9FC"/><polyline points="6.5,15 10.5,10.8 13.5,13.6 18,8" fill="none" stroke="#409EFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="8" r="2.2" fill="#67C23A"/>',

  // ---------- 地图 ----------
  mapChina:
    '<path d="M10.5 5.2c1.8-1.4 4.4-1.2 5.9-.2 1.8 1.1 2.4 2.7 2.2 4.3-.2 1.5-1 2.6-1.5 3.7-.6 1.3-.1 2.8-.9 4.1-1 1.4-2.9 1.7-4.6 1.4-1.8-.3-3-.8-3.6-2.2-.7-1.5-.9-3.2-.4-4.8.5-1.5 1-3.1.6-4.4-.5-2-1.5-1.6 2.3-1.9z" fill="#E8F1FF" stroke="#3A7BD5" stroke-width="1.4" stroke-linejoin="round"/><rect x="9" y="7.5" width="4" height="3" rx="1" fill="#409EFF"/><rect x="12.5" y="11.5" width="3.6" height="2.8" rx="1" fill="#F56C6C"/><rect x="8.3" y="12.6" width="3" height="2.6" rx="1" fill="#36CFC9"/>',
  mapChinaBubble:
    '<path d="M10.5 5.2c1.8-1.4 4.4-1.2 5.9-.2 1.8 1.1 2.4 2.7 2.2 4.3-.2 1.5-1 2.6-1.5 3.7-.6 1.3-.1 2.8-.9 4.1-1 1.4-2.9 1.7-4.6 1.4-1.8-.3-3-.8-3.6-2.2-.7-1.5-.9-3.2-.4-4.8.5-1.5 1-3.1.6-4.4-.5-2-1.5-1.6 2.3-1.9z" fill="#E8F1FF" stroke="#3A7BD5" stroke-width="1.4" stroke-linejoin="round"/><circle cx="16.5" cy="7.5" r="2.6" fill="#F56C6C"/><circle cx="7.5" cy="13" r="1.7" fill="#36CFC9"/>',
  mapChinaSymbol:
    '<path d="M10.5 5.2c1.8-1.4 4.4-1.2 5.9-.2 1.8 1.1 2.4 2.7 2.2 4.3-.2 1.5-1 2.6-1.5 3.7-.6 1.3-.1 2.8-.9 4.1-1 1.4-2.9 1.7-4.6 1.4-1.8-.3-3-.8-3.6-2.2-.7-1.5-.9-3.2-.4-4.8.5-1.5 1-3.1.6-4.4-.5-2-1.5-1.6 2.3-1.9z" fill="#E8F1FF" stroke="#3A7BD5" stroke-width="1.4" stroke-linejoin="round"/><path d="M11.8 9.5h1l.3 2.9 2.6-1.3-.5 1.3-2.7.6 2.7.6.5 1.3-2.6-1.3-.3 2.9h-1l-.3-2.9-2.6 1.3.5-1.3 2.7-.6-2.7-.6-.5-1.3 2.6 1.3z" fill="#F56C6C"/>',
  mapWorld:
    '<circle cx="12" cy="12" r="9" fill="#D8EFFF"/><circle cx="8.6" cy="9.3" r="2.5" fill="#8FCE7B"/><ellipse cx="17" cy="8.2" rx="2.3" ry="1.8" fill="#6FBF98" transform="rotate(15 17 8.2)"/><ellipse cx="12.4" cy="15" rx="2.9" ry="2.1" fill="#4FA06D" transform="rotate(-10 12.4 15)"/><ellipse cx="12" cy="12" rx="4.1" ry="9" fill="none" stroke="#fff" stroke-width="1"/><ellipse cx="12" cy="12" rx="9" ry="4.1" fill="none" stroke="#fff" stroke-width="1"/>',

  // ---------- 表格 ----------
  table:
    '<rect x="4" y="3.5" width="16" height="17" rx="1.6" fill="#F7F9FC"/><rect x="4" y="3.5" width="16" height="4.4" rx="1.6" fill="#409EFF"/><rect x="4" y="7.9" width="3.2" height="12.6" fill="#E8F1FF"/><path d="M4 12.7h16M4 16.3h16" stroke="#D8E2EE" stroke-width="1"/>',

  // ---------- 其他 ----------
  heatmap:
    '<rect x="4" y="4" width="3.8" height="3.8" rx="0.9" fill="#E8F1FF"/><rect x="9.2" y="4" width="3.8" height="3.8" rx="0.9" fill="#7EB5FF"/><rect x="14.4" y="4" width="3.8" height="3.8" rx="0.9" fill="#409EFF"/><rect x="19.6" y="4" width="1.4" height="3.8" rx="0.9" fill="#2E6BE6"/><rect x="4" y="9.2" width="3.8" height="3.8" rx="0.9" fill="#79BBFF"/><rect x="9.2" y="9.2" width="3.8" height="3.8" rx="0.9" fill="#F7BA2A"/><rect x="14.4" y="9.2" width="3.8" height="3.8" rx="0.9" fill="#E8445B"/><rect x="19.6" y="9.2" width="1.4" height="3.8" rx="0.9" fill="#F56C6C"/><rect x="4" y="14.4" width="3.8" height="3.8" rx="0.9" fill="#BBD8FF"/><rect x="9.2" y="14.4" width="3.8" height="3.8" rx="0.9" fill="#E6A23C"/><rect x="14.4" y="14.4" width="3.8" height="3.8" rx="0.9" fill="#B9E2A8"/><rect x="19.6" y="14.4" width="1.4" height="3.8" rx="0.9" fill="#67C23A"/><rect x="4" y="19.6" width="11.4" height="1.4" rx="0.9" fill="#C0C4CC"/><rect x="17.4" y="19.6" width="3.6" height="1.4" rx="0.9" fill="#A0A8B6"/>',
  boxplot:
    '<rect x="8" y="7.5" width="8" height="9" rx="1.4" fill="#fff" stroke="#409EFF" stroke-width="1.6"/><line x1="8" y1="12" x2="16" y2="12" stroke="#409EFF" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="3.5" x2="8" y2="7.5" stroke="#F56C6C" stroke-width="1.6"/><path d="M4 3.5h8" stroke="#F56C6C" stroke-width="1.6" stroke-linecap="round"/><line x1="16" y1="16.5" x2="16" y2="20.5" stroke="#F56C6C" stroke-width="1.6"/><path d="M12 20.5h8" stroke="#F56C6C" stroke-width="1.6" stroke-linecap="round"/>',
  radar:
    '<polygon points="12,4 19.5,8.8 16.7,17.4 7.3,17.4 4.5,8.8 12,4" fill="#BBD4FF" opacity=".55" stroke="#409EFF" stroke-width="1.6" stroke-linejoin="round"/><polygon points="12,7.6 16,11 14,15 10,15 8,11 12,7.6" fill="#F7BA2A" opacity=".6" stroke="#E6A23C" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="4" r="1" fill="#409EFF"/>',
  polarBar:
    '<path d="M12 12 7.3 6.1a8.8 8.8 0 0 1 9.4 0z" fill="#409EFF" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 12l6.4 5.9a8.8 8.8 0 0 1-6.4 3.2z" fill="#F7BA2A" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 12 3.9 15.2a8.8 8.8 0 0 1 2.6-8.5z" fill="#36CFC9" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>',
  barBreakAxis:
    '<rect x="3" y="8" width="4" height="12" rx="1.2" fill="#409EFF"/><rect x="8.8" y="11" width="4" height="9" rx="1.2" fill="#36CFC9"/><rect x="14.6" y="4" width="4" height="16" rx="1.2" fill="#F7BA2A"/><path d="M9.4 18.2l2-2.4 2 2.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  calendar:
    '<rect x="4" y="4.5" width="16" height="16" rx="2" fill="#F7F9FC"/><rect x="4" y="4.5" width="16" height="5" rx="2" fill="#F56C6C"/><rect x="6" y="11.5" width="3.4" height="2.8" rx="0.8" fill="#409EFF"/><rect x="10.6" y="11.5" width="3.4" height="2.8" rx="0.8" fill="#79BBFF"/><rect x="15.2" y="11.5" width="3.4" height="2.8" rx="0.8" fill="#BBD8FF"/><rect x="6" y="15.8" width="3.4" height="2.8" rx="0.8" fill="#36CFC9"/><rect x="10.6" y="15.8" width="3.4" height="2.8" rx="0.8" fill="#E6A23C"/>',
  candlestick:
    '<line x1="8" y1="5" x2="8" y2="19" stroke="#67C23A" stroke-width="1.8"/><rect x="6.4" y="8.5" width="3.2" height="5" rx="0.8" fill="#67C23A"/><line x1="15.8" y1="3.5" x2="15.8" y2="20.5" stroke="#F56C6C" stroke-width="1.8"/><rect x="14.2" y="6.5" width="3.2" height="6" rx="0.8" fill="#F56C6C"/>',
  treemap:
    '<rect x="4" y="4" width="16" height="16" rx="1.4" fill="#F7F9FC"/><rect x="6.4" y="6.4" width="8.6" height="7" rx="1.2" fill="#409EFF"/><rect x="6.4" y="14.6" width="4" height="3.5" rx="1.2" fill="#36CFC9"/><rect x="11.6" y="14.6" width="6" height="3.5" rx="1.2" fill="#F7BA2A"/>',
  sankey:
    '<rect x="3" y="5" width="3.6" height="5" rx="1" fill="#409EFF"/><rect x="3" y="12.5" width="3.6" height="5" rx="1" fill="#2E6BE6"/><rect x="17.4" y="4" width="3.6" height="5" rx="1" fill="#E6A23C"/><rect x="17.4" y="12.5" width="3.6" height="5" rx="1" fill="#F7BA2A"/><path d="M6.6 7c3.2 0 3.8 2 10.8.4M6.6 15c3.2 0 5 1.6 10.8 0M6.6 8.8c2 0 2.4.4 10.8-1" fill="none" stroke="#36CFC9" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>',
  chord:
    '<circle cx="12" cy="12" r="9" fill="#EFF5FF"/><circle cx="12" cy="3" r="2.2" fill="#409EFF"/><circle cx="20.5" cy="12" r="2.2" fill="#F7BA2A"/><circle cx="12" cy="21" r="2.2" fill="#67C23A"/><circle cx="3.5" cy="13" r="2.2" fill="#826AF9"/><path d="M14 5.2 17 17" stroke="#7B8A9B" stroke-width="1.8" stroke-linecap="round"/><path d="M18.6 10.6 8.4 19.4" stroke="#7B8A9B" stroke-width="1.8" stroke-linecap="round"/>',
}