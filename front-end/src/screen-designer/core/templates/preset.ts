export interface Template {
  id: string
  name: string
  description: string
  thumbnail: string
  config: {
    width: number
    height: number
    background: string
    layoutMode: 'adaptive' | 'fixed'
  }
  components: any[]
}

function makeComp(overrides: any) {
  return {
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    opacity: 100,
    props: {},
    style: { backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000', borderRadius: 0, boxShadowX: 0, boxShadowY: 0, boxShadowBlur: 0, boxShadowColor: 'rgba(0,0,0,0)' },
    data: { type: 'static', value: '', datasetId: null, categoryField: '', valueFields: [] },
    animation: { type: 'none', duration: 500, delay: 0 },
    interaction: {},
    ...overrides
  }
}

function t(id: string, x: number, y: number, w: number, h: number, props: any) {
  return makeComp({ id, type: 'static-text', name: '文本', x, y, width: w, height: h, props: { content: '', fontSize: 14, color: '#fff', fontWeight: 'normal', textAlign: 'center', ...props } })
}

function num(id: string, x: number, y: number, w: number, h: number, props: any) {
  return makeComp({ id, type: 'number-flip', name: '数字翻牌', x, y, width: w, height: h, props: { value: 0, prefix: '', suffix: '', fontSize: 36, color: '#00d4ff', fontWeight: 'bold', fontFamily: 'DIN Alternate', duration: 2000, ...props } })
}

function ch(id: string, type: string, name: string, x: number, y: number, w: number, h: number, props: any = {}) {
  return makeComp({ id, type, name, x, y, width: w, height: h, props })
}

function bd(id: string, type: string, name: string, x: number, y: number, w: number, h: number) {
  return makeComp({ id, type, name, x, y, width: w, height: h })
}

function deco(id: string, type: string, name: string, x: number, y: number, w: number, h: number) {
  return makeComp({ id, type, name, x, y, width: w, height: h })
}

export const presetTemplates: Template[] = [
  // ==================== 1. 智慧城市运营中心 (复杂专业版) ====================
  {
    id: 'smart-city-pro',
    name: '智慧城市运营中心',
    description: '40+组件 | 地图+指标+图表+装饰框 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 50% 0%, #0d2847 0%, #091c36 30%, #050e20 60%, #020812 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      // ========== 顶部装饰 ==========
      deco('glow1', 'deco-glow', '辉光', 860, -100, 200, 200),
      deco('corner-tl', 'deco-corner', '左上角', 0, 0, 80, 80),
      deco('corner-tr', 'deco-corner', '右上角', 1840, 0, 80, 80),
      deco('corner-bl', 'deco-corner', '左下角', 0, 1000, 80, 80),
      deco('corner-br', 'deco-corner', '右下角', 1840, 1000, 80, 80),

      // ========== 标题区域 ==========
      bd('title-border', 'border-11', '标题边框', 360, 8, 1200, 60),
      t('title', 380, 12, 1160, 52, { content: '智慧城市数据运营中心', fontSize: 32, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 8 }),
      deco('title-deco-l', 'deco-line', '标题装饰线', 360, 68, 200, 2),
      deco('title-deco-r', 'deco-line', '标题装饰线', 1360, 68, 200, 2),

      // 右上角时间
      bd('time-border', 'border-7', '时间边框', 1620, 18, 260, 42),
      t('time', 1630, 22, 240, 34, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左上角日期
      bd('date-border', 'border-7', '日期边框', 40, 18, 220, 42),
      t('date', 50, 22, 200, 34, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // ========== 左侧面板区域 (x: 30-470) ==========

      // --- 左上指标卡组 ---
      bd('lb1', 'border-9', '指标框1', 30, 85, 215, 140),
      num('ln1', 45, 100, 185, 50, { value: 1286520, fontSize: 30, color: '#00e5ff' }),
      t('ll1', 45, 155, 185, 24, { content: '城市总人口', fontSize: 12, color: '#5a8aaa' }),
      t('ll1v', 45, 178, 185, 24, { content: '较昨日 +1.2%', fontSize: 11, color: '#69f0ae' }),

      bd('lb2', 'border-9', '指标框2', 255, 85, 215, 140),
      num('ln2', 270, 100, 185, 50, { value: 98.7, suffix: '%', fontSize: 30, color: '#00e5ff' }),
      t('ll2', 270, 155, 185, 24, { content: '系统在线率', fontSize: 12, color: '#5a8aaa' }),
      t('ll2v', 270, 178, 185, 24, { content: '较上周 +0.3%', fontSize: 11, color: '#69f0ae' }),

      // --- 左中柱状图 ---
      bd('lbar-border', 'border-tech', '柱状图框', 30, 240, 440, 310),
      t('lbar-title', 50, 248, 200, 28, { content: '各区事件统计', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('lbar', 'bar-single', '柱状图', 40, 280, 420, 260, {}),

      // --- 左下饼图 ---
      bd('lpie-border', 'border-tech', '饼图框', 30, 565, 440, 290),
      t('lpie-title', 50, 573, 200, 28, { content: '事件类型分布', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('lpie', 'pie-doughnut', '环形图', 40, 600, 420, 240, {}),

      // --- 左下角装饰 ---
      bd('lbottom-border', 'border-4', '左下框', 30, 870, 440, 180),
      num('lbn1', 50, 890, 180, 40, { value: 3562, fontSize: 28, color: '#ffc107' }),
      t('lbl1', 50, 935, 180, 22, { content: '今日处理事件', fontSize: 12, color: '#5a8a7a' }),
      num('lbn2', 250, 890, 180, 40, { value: 23, fontSize: 28, color: '#ff5252' }),
      t('lbl2', 250, 935, 180, 22, { content: '待处理告警', fontSize: 12, color: '#5a8a7a' }),
      ch('lbar2', 'bar-single', '迷你柱图', 50, 960, 400, 70, {}),

      // ========== 中央区域 (x: 490-1430) ==========

      // --- 中央地图大框 ---
      bd('center-border', 'border-13', '中央大框', 490, 85, 940, 620),
      ch('cmap', 'map-china', '中国地图', 500, 95, 920, 600, {}),

      // --- 中央底部数据条 ---
      bd('cbottom-border', 'border-tech', '底部数据条', 490, 720, 940, 60),
      t('cb-label1', 520, 730, 150, 40, { content: '今日总访问量', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      num('cb-val1', 660, 728, 120, 40, { value: 528640, fontSize: 22, color: '#00e5ff' }),
      t('cb-label2', 820, 730, 150, 40, { content: '活跃用户', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      num('cb-val2', 940, 728, 120, 40, { value: 86520, fontSize: 22, color: '#00e5ff' }),
      t('cb-label3', 1100, 730, 150, 40, { content: '数据流量', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      num('cb-val3', 1220, 728, 120, 40, { value: 15.6, suffix: 'TB', fontSize: 22, color: '#00e5ff' }),

      // --- 中央左下面板 ---
      bd('cbl-border', 'border-9', '左下小面板', 490, 795, 460, 250),
      t('cbl-title', 510, 803, 200, 28, { content: '实时告警趋势', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cline', 'line-smooth', '折线图', 500, 830, 440, 200, {}),

      // --- 中央右下面板 ---
      bd('cbr-border', 'border-9', '右下小面板', 970, 795, 460, 250),
      t('cbr-title', 990, 803, 200, 28, { content: '资源使用情况', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cradar', 'radar', '雷达图', 980, 830, 440, 200, {}),

      // ========== 右侧面板区域 (x: 1450-1890) ==========

      // --- 右上指标卡组 ---
      bd('rb1', 'border-9', '指标框3', 1450, 85, 215, 140),
      num('rn1', 1465, 100, 185, 50, { value: 3280, fontSize: 30, color: '#ffc107' }),
      t('rl1', 1465, 155, 185, 24, { content: '今日订单量', fontSize: 12, color: '#5a8aaa' }),
      t('rl1v', 1465, 178, 185, 24, { content: '较昨日 +5.8%', fontSize: 11, color: '#69f0ae' }),

      bd('rb2', 'border-9', '指标框4', 1680, 85, 215, 140),
      num('rn2', 1695, 100, 185, 50, { value: 856, suffix: '万', fontSize: 30, color: '#b388ff' }),
      t('rl2', 1695, 155, 185, 24, { content: '本月GMV', fontSize: 12, color: '#5a8aaa' }),
      t('rl2v', 1695, 178, 185, 24, { content: '较上月 +12.3%', fontSize: 11, color: '#69f0ae' }),

      // --- 右中面积图 ---
      bd('rarea-border', 'border-tech', '面积图框', 1450, 240, 440, 310),
      t('rarea-title', 1470, 248, 200, 28, { content: '流量趋势分析', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('rarea', 'line-area', '面积图', 1460, 280, 420, 260, {}),

      // --- 右下仪表盘 ---
      bd('rgauge-border', 'border-tech', '仪表盘框', 1450, 565, 215, 290),
      t('rgauge-title', 1460, 573, 200, 28, { content: 'CPU使用率', fontSize: 13, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'center' }),
      ch('rgauge', 'gauge', '仪表盘', 1460, 600, 200, 240, {}),

      // --- 右下排名列表 ---
      bd('rrank-border', 'border-tech', '排名框', 1680, 565, 215, 290),
      t('rrank-title', 1690, 573, 200, 28, { content: '区域排名', fontSize: 13, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'center' }),
      ch('rrank', 'rank-list', '排名列表', 1690, 600, 200, 240, {}),

      // --- 右下角面板 ---
      bd('rbottom-border', 'border-4', '右下框', 1450, 870, 440, 180),
      t('rbottom-title', 1470, 878, 200, 28, { content: '近7日数据概览', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('rbar', 'bar-group', '分组柱状图', 1460, 905, 420, 130, {}),

      // ========== 底部装饰 ==========
      deco('bottom-line', 'deco-line', '底部装饰线', 30, 1060, 1860, 2),
    ]
  },

  // ==================== 2. 交通态势感知 (专业版) ====================
  {
    id: 'traffic-pro',
    name: '交通态势感知平台',
    description: '35+组件 | 实时路况+地图+指标 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(180deg, #041228 0%, #0a1e3d 30%, #081830 70%, #040e1c 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('tglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('t-title-border', 'border-11', '标题框', 360, 8, 1200, 60),
      t('t-title', 380, 14, 1160, 48, { content: '城市交通态势感知系统', fontSize: 30, color: '#c8e8ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('t-title-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('t-title-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('t-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('t-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左侧 - 4个指标卡 (2x2)
      bd('tlb1', 'border-5', '指标1', 30, 85, 220, 130),
      num('tln1', 45, 100, 190, 45, { value: 528640, fontSize: 28, color: '#3d9eff' }),
      t('tll1', 45, 150, 190, 22, { content: '今日车流量', fontSize: 12, color: '#5a7a9a' }),
      t('tll1v', 45, 172, 190, 22, { content: '↑ 8.2%', fontSize: 11, color: '#69f0ae' }),

      bd('tlb2', 'border-5', '指标2', 265, 85, 220, 130),
      num('tln2', 280, 100, 190, 45, { value: 18, fontSize: 28, color: '#ff5252' }),
      t('tll2', 280, 150, 190, 22, { content: '拥堵路段', fontSize: 12, color: '#5a7a9a' }),
      t('tll2v', 280, 172, 190, 22, { content: '↓ 3较昨日', fontSize: 11, color: '#69f0ae' }),

      bd('tlb3', 'border-5', '指标3', 30, 230, 220, 130),
      num('tln3', 45, 245, 190, 45, { value: 42, suffix: 'min', fontSize: 28, color: '#ffc107' }),
      t('tll3', 45, 295, 190, 22, { content: '平均通勤时间', fontSize: 12, color: '#5a7a9a' }),

      bd('tlb4', 'border-5', '指标4', 265, 230, 220, 130),
      num('tln4', 280, 245, 190, 45, { value: 96.2, suffix: '%', fontSize: 28, color: '#00e5ff' }),
      t('tll4', 280, 295, 190, 22, { content: '通行顺畅率', fontSize: 12, color: '#5a7a9a' }),

      // 左侧 - 柱状图
      bd('tlbar', 'border-tech', '柱状图', 30, 375, 455, 290),
      t('tlbar-t', 50, 383, 200, 28, { content: '路段拥堵指数', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tlbar-c', 'bar-single', '柱状图', 40, 415, 435, 240, {}),

      // 左侧 - 饼图
      bd('tlpie', 'border-tech', '饼图', 30, 680, 455, 270),
      t('tlpie-t', 50, 688, 200, 28, { content: '出行方式占比', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tlpie-c', 'pie-doughnut', '环形图', 40, 715, 435, 220, {}),

      // 左下 - 排名
      bd('tlrank', 'border-4', '排名', 30, 965, 455, 90),
      ch('tlrank-c', 'rank-list', '排名列表', 40, 970, 435, 80, {}),

      // 中央 - 地图
      bd('tcenter', 'border-13', '中央地图', 500, 85, 920, 620),
      ch('tmap', 'map-china', '中国地图', 510, 95, 900, 600, {}),

      // 中央底部 - 横向数据
      bd('tcb', 'border-tech', '数据条', 500, 720, 920, 60),
      t('tcb-l1', 530, 730, 140, 40, { content: '高速平均时速', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      num('tcb-v1', 660, 728, 100, 40, { value: 85, suffix: 'km/h', fontSize: 20, color: '#00e5ff' }),
      t('tcb-l2', 790, 730, 140, 40, { content: '公交准点率', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      num('tcb-v2', 920, 728, 100, 40, { value: 94.5, suffix: '%', fontSize: 20, color: '#00e5ff' }),
      t('tcb-l3', 1060, 730, 140, 40, { content: '地铁客流', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      num('tcb-v3', 1180, 728, 100, 40, { value: 285, suffix: '万', fontSize: 20, color: '#00e5ff' }),

      // 中央左下 - 折线图
      bd('tcbl', 'border-9', '折线图', 500, 795, 450, 250),
      t('tcbl-t', 520, 803, 200, 28, { content: '24小时流量趋势', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tcbl-c', 'line-smooth', '折线图', 510, 835, 430, 200, {}),

      // 中央右下 - 雷达图
      bd('tcbr', 'border-9', '雷达图', 970, 795, 450, 250),
      t('tcbr-t', 990, 803, 200, 28, { content: '交通综合评估', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tcbr-c', 'radar', '雷达图', 980, 835, 430, 200, {}),

      // 右侧 - 面积图
      bd('trarea', 'border-tech', '面积图', 1440, 85, 450, 310),
      t('trarea-t', 1460, 93, 200, 28, { content: '实时速度监控', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('trarea-c', 'line-area', '面积图', 1450, 125, 430, 260, {}),

      // 右侧 - 仪表盘
      bd('trgauge', 'border-tech', '仪表盘', 1440, 410, 220, 260),
      t('trgauge-t', 1450, 418, 200, 28, { content: '路网负载', fontSize: 13, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'center' }),
      ch('trgauge-c', 'gauge', '仪表盘', 1450, 445, 200, 210, {}),

      // 右侧 - 水球图
      bd('trwater', 'border-tech', '水球图', 1680, 410, 210, 260),
      t('trwater-t', 1690, 418, 200, 28, { content: '停车场饱和度', fontSize: 13, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'center' }),
      ch('trwater-c', 'water-ball', '水球图', 1690, 445, 190, 210, {}),

      // 右侧 - 排名列表
      bd('trrank', 'border-4', '排名', 1440, 685, 450, 270),
      t('trrank-t', 1460, 693, 200, 28, { content: '拥堵路段TOP10', fontSize: 14, color: '#8cc8ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('trrank-c', 'rank-list', '排名列表', 1450, 725, 430, 220, {}),

      // 右下角 - 柱状图
      bd('trbar', 'border-9', '柱状图', 1440, 970, 450, 85),
      ch('trbar-c', 'bar-single', '柱状图', 1450, 975, 430, 75, {}),

      deco('tbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  // ==================== 3. 电商数据大盘 (专业版) ====================
  {
    id: 'ecommerce-pro',
    name: '电商实时数据大盘',
    description: '38+组件 | GMV+订单+转化+排行 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 30% 20%, #1e0a3e 0%, #140830 30%, #0c0620 60%, #060312 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('esglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('es-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('es-title', 380, 14, 1160, 48, { content: '电商实时数据大盘', fontSize: 30, color: '#f0d0ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('es-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('es-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('es-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('es-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#c080ff' }),

      // 顶部4个KPI大卡
      bd('ekpi1', 'border-glow', 'KPI1', 30, 85, 440, 150),
      t('ekpi1-label', 50, 95, 200, 28, { content: '今日 GMV', fontSize: 14, color: '#8a6aaa', textAlign: 'left' }),
      num('ekpi1-val', 50, 125, 380, 55, { value: 8564200, prefix: '¥', fontSize: 36, color: '#ff80ab' }),
      t('ekpi1-change', 50, 185, 200, 22, { content: '较昨日 +15.2%', fontSize: 12, color: '#69f0ae' }),
      ch('ekpi1-spark', 'line-smooth', '迷你折线', 320, 130, 130, 80, {}),

      bd('ekpi2', 'border-glow', 'KPI2', 490, 85, 440, 150),
      t('ekpi2-label', 510, 95, 200, 28, { content: '今日订单数', fontSize: 14, color: '#8a6aaa', textAlign: 'left' }),
      num('ekpi2-val', 510, 125, 380, 55, { value: 45620, fontSize: 36, color: '#b388ff' }),
      t('ekpi2-change', 510, 185, 200, 22, { content: '较昨日 +8.6%', fontSize: 12, color: '#69f0ae' }),
      ch('ekpi2-spark', 'bar-single', '迷你柱图', 780, 130, 130, 80, {}),

      bd('ekpi3', 'border-glow', 'KPI3', 950, 85, 440, 150),
      t('ekpi3-label', 970, 95, 200, 28, { content: '转化率', fontSize: 14, color: '#8a6aaa', textAlign: 'left' }),
      num('ekpi3-val', 970, 125, 380, 55, { value: 3.82, suffix: '%', fontSize: 36, color: '#82b1ff' }),
      t('ekpi3-change', 970, 185, 200, 22, { content: '较上周 +0.5%', fontSize: 12, color: '#69f0ae' }),
      ch('ekpi3-spark', 'line-area', '迷你面积', 1240, 130, 130, 80, {}),

      bd('ekpi4', 'border-glow', 'KPI4', 1410, 85, 480, 150),
      t('ekpi4-label', 1430, 95, 200, 28, { content: '客单价', fontSize: 14, color: '#8a6aaa', textAlign: 'left' }),
      num('ekpi4-val', 1430, 125, 380, 55, { value: 268, suffix: '元', fontSize: 36, color: '#ffab40' }),
      t('ekpi4-change', 1430, 185, 200, 22, { content: '较昨日 +3.2%', fontSize: 12, color: '#69f0ae' }),

      // 左 - 柱状图
      bd('ebar-b', 'border-tech', '柱状图', 30, 250, 600, 360),
      t('ebar-t', 50, 258, 200, 28, { content: '品类销售排行', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('ebar-c', 'bar-single', '柱状图', 40, 290, 580, 310, {}),

      // 中 - 面积图
      bd('earea-b', 'border-tech', '面积图', 650, 250, 620, 360),
      t('earea-t', 670, 258, 200, 28, { content: '24小时订单趋势', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('earea-c', 'line-area', '面积图', 660, 290, 600, 310, {}),

      // 右 - 饼图
      bd('epie-b', 'border-tech', '饼图', 1290, 250, 600, 360),
      t('epie-t', 1310, 258, 200, 28, { content: '支付方式分布', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('epie-c', 'pie-doughnut', '环形图', 1300, 290, 580, 310, {}),

      // 左下 - 漏斗图
      bd('efunnel-b', 'border-9', '漏斗图', 30, 625, 400, 240),
      t('efunnel-t', 50, 633, 200, 28, { content: '转化漏斗', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('efunnel-c', 'funnel', '漏斗图', 40, 665, 380, 190, {}),

      // 左下2 - 散点图
      bd('escatter-b', 'border-9', '散点图', 30, 880, 400, 170),
      ch('escatter-c', 'scatter', '散点图', 40, 885, 380, 160, {}),

      // 中下 - 排名列表
      bd('erank-b', 'border-tech', '排名', 450, 625, 500, 425),
      t('erank-t', 470, 633, 200, 28, { content: '商品销售TOP10', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('erank-c', 'rank-list', '排名列表', 460, 665, 480, 375, {}),

      // 右下 - 桑基图
      bd('esankey-b', 'border-9', '桑基图', 970, 625, 450, 425),
      t('esankey-t', 990, 633, 200, 28, { content: '流量来源分析', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('esankey-c', 'sankey', '桑基图', 980, 665, 430, 375, {}),

      // 右下 - 日历图
      bd('ecal-b', 'border-4', '日历图', 1440, 625, 450, 425),
      t('ecal-t', 1460, 633, 200, 28, { content: '月度销售热力', fontSize: 14, color: '#c090ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('ecal-c', 'calendar', '日历图', 1450, 665, 430, 375, {}),

      deco('ebottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  // ==================== 4. 工业物联网监控 (专业版) ====================
  {
    id: 'iot-pro',
    name: '工业物联网监控平台',
    description: '35+组件 | 设备+产线+能耗+告警 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 50% 30%, #0a2a1a 0%, #061a10 40%, #030d08 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('isglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('is-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('is-title', 380, 14, 1160, 48, { content: '工业物联网监控平台', fontSize: 30, color: '#b8ffcc', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('is-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('is-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('is-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('is-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#4caf50' }),

      // 顶部6个KPI
      bd('ik1', 'border-5', 'KPI1', 30, 85, 290, 120),
      num('ik1v', 50, 100, 250, 40, { value: 1286, fontSize: 30, color: '#4caf50' }),
      t('ik1l', 50, 145, 250, 22, { content: '在线设备', fontSize: 12, color: '#5a8a6a' }),

      bd('ik2', 'border-5', 'KPI2', 335, 85, 290, 120),
      num('ik2v', 355, 100, 250, 40, { value: 98.5, suffix: '%', fontSize: 30, color: '#00e5ff' }),
      t('ik2l', 355, 145, 250, 22, { content: '设备稼动率', fontSize: 12, color: '#5a8a6a' }),

      bd('ik3', 'border-5', 'KPI3', 640, 85, 290, 120),
      num('ik3v', 660, 100, 250, 40, { value: 562, fontSize: 30, color: '#ffc107' }),
      t('ik3l', 660, 145, 250, 22, { content: '今日产量(件)', fontSize: 12, color: '#5a8a6a' }),

      bd('ik4', 'border-5', 'KPI4', 945, 85, 290, 120),
      num('ik4v', 965, 100, 250, 40, { value: 12.8, suffix: 'kWh', fontSize: 30, color: '#ff9800' }),
      t('ik4l', 965, 145, 250, 22, { content: '单位能耗', fontSize: 12, color: '#5a8a6a' }),

      bd('ik5', 'border-5', 'KPI5', 1250, 85, 290, 120),
      num('ik5v', 1270, 100, 250, 40, { value: 3, fontSize: 30, color: '#ff5252' }),
      t('ik5l', 1270, 145, 250, 22, { content: '告警设备', fontSize: 12, color: '#5a8a6a' }),

      bd('ik6', 'border-5', 'KPI6', 1555, 85, 340, 120),
      num('ik6v', 1575, 100, 300, 40, { value: 99.2, suffix: '%', fontSize: 30, color: '#00e5ff' }),
      t('ik6l', 1575, 145, 300, 22, { content: '良品率', fontSize: 12, color: '#5a8a6a' }),

      // 左 - 折线图
      bd('iline-b', 'border-tech', '折线图', 30, 220, 450, 320),
      t('iline-t', 50, 228, 200, 28, { content: '产线效率趋势', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('iline-c', 'line-smooth', '折线图', 40, 260, 430, 270, {}),

      // 左 - 仪表盘
      bd('igauge-b', 'border-tech', '仪表盘', 30, 555, 220, 260),
      t('igauge-t', 40, 563, 200, 28, { content: 'OEE综合效率', fontSize: 13, color: '#80ccaa', fontWeight: 'bold', textAlign: 'center' }),
      ch('igauge-c', 'gauge', '仪表盘', 40, 590, 200, 210, {}),

      // 左中 - 堆叠柱状图
      bd('istack-b', 'border-tech', '堆叠图', 265, 555, 215, 260),
      t('istack-t', 275, 563, 200, 28, { content: '各班次产量', fontSize: 13, color: '#80ccaa', fontWeight: 'bold', textAlign: 'center' }),
      ch('istack-c', 'bar-stack', '堆叠柱状图', 270, 590, 200, 210, {}),

      // 左下 - 饼图
      bd('ipie-b', 'border-4', '饼图', 30, 830, 450, 220),
      t('ipie-t', 50, 838, 200, 28, { content: '设备状态分布', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('ipie-c', 'pie-doughnut', '环形图', 40, 865, 430, 175, {}),

      // 中央 - 热力图
      bd('iheat-b', 'border-13', '热力图', 500, 220, 480, 380),
      t('iheat-t', 520, 228, 200, 28, { content: '设备温度分布', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('iheat-c', 'heatmap', '热力图', 510, 260, 460, 330, {}),

      // 中右 - 散点图
      bd('iscatter-b', 'border-tech', '散点图', 1000, 220, 430, 380),
      t('iscatter-t', 1020, 228, 200, 28, { content: '质量分布', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('iscatter-c', 'scatter', '散点图', 1010, 260, 410, 330, {}),

      // 中央底部 - 排名
      bd('irank-b', 'border-tech', '排名', 500, 615, 480, 200),
      t('irank-t', 520, 623, 200, 28, { content: '设备效率排名', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('irank-c', 'rank-list', '排名列表', 510, 655, 460, 150, {}),

      // 中央底右 - 漏斗图
      bd('ifunnel-b', 'border-tech', '漏斗图', 1000, 615, 430, 200),
      t('ifunnel-t', 1020, 623, 200, 28, { content: '生产流程转化', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('ifunnel-c', 'funnel', '漏斗图', 1010, 655, 410, 150, {}),

      // 右 - 柱状图
      bd('ibar-b', 'border-tech', '柱状图', 1450, 220, 440, 320),
      t('ibar-t', 1470, 228, 200, 28, { content: '能耗对比', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('ibar-c', 'bar-group', '分组柱状图', 1460, 260, 420, 270, {}),

      // 右 - 水球图
      bd('iwater-b', 'border-tech', '水球图', 1450, 555, 215, 260),
      t('iwater-t', 1460, 563, 200, 28, { content: '设备利用率', fontSize: 13, color: '#80ccaa', fontWeight: 'bold', textAlign: 'center' }),
      ch('iwater-c', 'water-ball', '水球图', 1460, 590, 195, 210, {}),

      // 右 - 仪表盘
      bd('igauge2-b', 'border-tech', '仪表盘', 1680, 555, 210, 260),
      t('igauge2-t', 1690, 563, 200, 28, { content: '安全指数', fontSize: 13, color: '#80ccaa', fontWeight: 'bold', textAlign: 'center' }),
      ch('igauge2-c', 'gauge', '仪表盘', 1690, 590, 190, 210, {}),

      // 右下 - 柱状图
      bd('ibar2-b', 'border-4', '柱状图', 1450, 830, 440, 220),
      t('ibar2-t', 1470, 838, 200, 28, { content: '周产量对比', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('ibar2-c', 'bar-single', '柱状图', 1460, 865, 420, 175, {}),

      // 中下 - 雷达图
      bd('iradar-b', 'border-9', '雷达图', 500, 830, 480, 220),
      t('iradar-t', 520, 838, 200, 28, { content: '多维度评估', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('iradar-c', 'radar', '雷达图', 510, 865, 460, 175, {}),

      // 中下右 - 日历图
      bd('ical-b', 'border-9', '日历图', 1000, 830, 430, 220),
      t('ical-t', 1020, 838, 200, 28, { content: '月度生产热力', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('ical-c', 'calendar', '日历图', 1010, 865, 410, 175, {}),

      deco('ibottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  // ==================== 5. 智慧能源管理 (专业版) ====================
  {
    id: 'energy-pro',
    name: '智慧能源管理平台',
    description: '35+组件 | 电水气+节能+趋势 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(160deg, #041e3c 0%, #0a3a5c 25%, #082e48 50%, #041a30 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('ensglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('en-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('en-title', 380, 14, 1160, 48, { content: '智慧能源管理平台', fontSize: 30, color: '#b8e8ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('en-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('en-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('en-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('en-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#4fc3f7' }),

      // 5个KPI
      bd('enk1', 'border-11', 'KPI1', 30, 85, 350, 140),
      num('enk1v', 50, 100, 310, 50, { value: 15680, suffix: 'kWh', fontSize: 32, color: '#ffd740' }),
      t('enk1l', 50, 155, 310, 22, { content: '本月用电量', fontSize: 12, color: '#6a8aaa' }),
      t('enk1c', 50, 178, 310, 22, { content: '较上月 -5.2%', fontSize: 11, color: '#69f0ae' }),

      bd('enk2', 'border-11', 'KPI2', 400, 85, 350, 140),
      num('enk2v', 420, 100, 310, 50, { value: 8230, suffix: 'm³', fontSize: 32, color: '#4fc3f7' }),
      t('enk2l', 420, 155, 310, 22, { content: '本月用水量', fontSize: 12, color: '#6a8aaa' }),
      t('enk2c', 420, 178, 310, 22, { content: '较上月 -3.1%', fontSize: 11, color: '#69f0ae' }),

      bd('enk3', 'border-11', 'KPI3', 770, 85, 350, 140),
      num('enk3v', 790, 100, 310, 50, { value: 3450, suffix: 'm³', fontSize: 32, color: '#ff7043' }),
      t('enk3l', 790, 155, 310, 22, { content: '本月用气量', fontSize: 12, color: '#6a8aaa' }),

      bd('enk4', 'border-11', 'KPI4', 1140, 85, 350, 140),
      num('enk4v', 1160, 100, 310, 50, { value: -8.5, suffix: '%', fontSize: 32, color: '#69f0ae' }),
      t('enk4l', 1160, 155, 310, 22, { content: '环比节能率', fontSize: 12, color: '#6a8aaa' }),

      bd('enk5', 'border-11', 'KPI5', 1510, 85, 380, 140),
      num('enk5v', 1530, 100, 340, 50, { value: 2.8, suffix: '元/㎡', fontSize: 32, color: '#ce93d8' }),
      t('enk5l', 1530, 155, 340, 22, { content: '单位面积能耗成本', fontSize: 12, color: '#6a8aaa' }),

      // 左 - 面积图
      bd('enarea-b', 'border-tech', '面积图', 30, 240, 620, 350),
      t('enarea-t', 50, 248, 200, 28, { content: '能耗趋势分析', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enarea-c', 'line-area', '面积图', 40, 280, 600, 300, {}),

      // 中 - 饼图
      bd('enpie-b', 'border-tech', '饼图', 670, 240, 320, 350),
      t('enpie-t', 690, 248, 200, 28, { content: '能源类型占比', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'center' }),
      ch('enpie-c', 'pie-doughnut', '环形图', 680, 280, 300, 300, {}),

      // 右 - 堆叠柱状图
      bd('enstack-b', 'border-tech', '堆叠图', 1010, 240, 440, 350),
      t('enstack-t', 1030, 248, 200, 28, { content: '各区域能耗对比', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enstack-c', 'bar-stack', '堆叠柱状图', 1020, 280, 420, 300, {}),

      // 最右 - 仪表盘
      bd('engauge-b', 'border-tech', '仪表盘', 1470, 240, 420, 350),
      t('engauge-t', 1490, 248, 200, 28, { content: '综合能效指数', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'center' }),
      ch('engauge-c', 'gauge', '仪表盘', 1480, 280, 400, 300, {}),

      // 左下 - 雷达图
      bd('enradar-b', 'border-9', '雷达图', 30, 605, 460, 220),
      t('enradar-t', 50, 613, 200, 28, { content: '多维能效评估', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enradar-c', 'radar', '雷达图', 40, 645, 440, 170, {}),

      // 中下 - 漏斗图
      bd('enfunnel-b', 'border-9', '漏斗图', 510, 605, 460, 220),
      t('enfunnel-t', 530, 613, 200, 28, { content: '能源流向分析', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enfunnel-c', 'funnel', '漏斗图', 520, 645, 440, 170, {}),

      // 中右下 - 桑基图
      bd('ensankey-b', 'border-9', '桑基图', 990, 605, 450, 220),
      t('ensankey-t', 1010, 613, 200, 28, { content: '能源分配流向', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('ensankey-c', 'sankey', '桑基图', 1000, 645, 430, 170, {}),

      // 右下 - 排名
      bd('enrank-b', 'border-9', '排名', 1460, 605, 430, 220),
      t('enrank-t', 1480, 613, 200, 28, { content: '部门能耗排名', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enrank-c', 'rank-list', '排名列表', 1470, 645, 410, 170, {}),

      // 左下角 - 迷你图组合
      bd('enmini-b', 'border-4', '迷你图', 30, 840, 460, 210),
      t('enmini-t', 50, 848, 200, 28, { content: '实时功率监控', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enmini-c', 'line-smooth', '折线图', 40, 880, 440, 160, {}),

      // 中下 - 柱状图
      bd('enbar-b', 'border-4', '柱状图', 510, 840, 460, 210),
      t('enbar-t', 530, 848, 200, 28, { content: '日均能耗统计', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enbar-c', 'bar-single', '柱状图', 520, 880, 440, 160, {}),

      // 中下右 - 散点图
      bd('enscatter-b', 'border-4', '散点图', 990, 840, 450, 210),
      t('enscatter-t', 1010, 848, 200, 28, { content: '能耗与产出关系', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'left' }),
      ch('enscatter-c', 'scatter', '散点图', 1000, 880, 430, 160, {}),

      // 右下 - 水球图
      bd('enwater-b', 'border-4', '水球图', 1460, 840, 430, 210),
      t('enwater-t', 1480, 848, 200, 28, { content: '节能目标完成率', fontSize: 14, color: '#80b8d8', fontWeight: 'bold', textAlign: 'center' }),
      ch('enwater-c', 'water-ball', '水球图', 1470, 880, 410, 160, {}),

      deco('enbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  // ==================== 6-10: 保留原有较简单版本，改为ID兼容 ====================
  // (复用之前已有的简化版模板作为第6-10个)
  {
    id: 'park-pro',
    name: '智慧园区运营平台',
    description: '30+组件 | 安防+能耗+人员+车辆 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 20% 80%, #1a0a3e 0%, #120830 35%, #0a0520 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('psglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('ps-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('ps-title', 380, 14, 1160, 48, { content: '智慧园区运营管理平台', fontSize: 30, color: '#e8d0ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('ps-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('ps-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('ps-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('ps-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#b388ff' }),

      // 6个KPI
      bd('psk1', 'border-5', 'KPI1', 30, 85, 290, 120),
      num('psk1v', 50, 100, 250, 40, { value: 1256, fontSize: 30, color: '#b388ff' }),
      t('psk1l', 50, 145, 250, 22, { content: '在园人数', fontSize: 12, color: '#7a6a9a' }),

      bd('psk2', 'border-5', 'KPI2', 335, 85, 290, 120),
      num('psk2v', 355, 100, 250, 40, { value: 328, fontSize: 30, color: '#82b1ff' }),
      t('psk2l', 355, 145, 250, 22, { content: '车辆进出', fontSize: 12, color: '#7a6a9a' }),

      bd('psk3', 'border-5', 'KPI3', 640, 85, 290, 120),
      num('psk3v', 660, 100, 250, 40, { value: 42, suffix: '°C', fontSize: 30, color: '#ff7043' }),
      t('psk3l', 660, 145, 250, 22, { content: '机房温度', fontSize: 12, color: '#7a6a9a' }),

      bd('psk4', 'border-5', 'KPI4', 945, 85, 290, 120),
      num('psk4v', 965, 100, 250, 40, { value: 98.5, suffix: '%', fontSize: 30, color: '#69f0ae' }),
      t('psk4l', 965, 145, 250, 22, { content: '安防覆盖率', fontSize: 12, color: '#7a6a9a' }),

      bd('psk5', 'border-5', 'KPI5', 1250, 85, 290, 120),
      num('psk5v', 1270, 100, 250, 40, { value: 15.6, suffix: 'kWh', fontSize: 30, color: '#ffd740' }),
      t('psk5l', 1270, 145, 250, 22, { content: '今日能耗', fontSize: 12, color: '#7a6a9a' }),

      bd('psk6', 'border-5', 'KPI6', 1555, 85, 340, 120),
      num('psk6v', 1575, 100, 300, 40, { value: 6, fontSize: 30, color: '#ff5252' }),
      t('psk6l', 1575, 145, 300, 22, { content: '待处理工单', fontSize: 12, color: '#7a6a9a' }),

      // 左 - 折线图
      bd('psline-b', 'border-tech', '折线图', 30, 220, 450, 350),
      t('psline-t', 50, 228, 200, 28, { content: '人流车流趋势', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('psline-c', 'line-smooth', '折线图', 40, 260, 430, 300, {}),

      // 左 - 雷达图
      bd('psradar-b', 'border-tech', '雷达图', 30, 585, 220, 270),
      t('psradar-t', 40, 593, 200, 28, { content: '安全评估', fontSize: 13, color: '#b090dd', fontWeight: 'bold', textAlign: 'center' }),
      ch('psradar-c', 'radar', '雷达图', 40, 625, 200, 220, {}),

      // 左中 - 仪表盘
      bd('psgauge-b', 'border-tech', '仪表盘', 265, 585, 215, 270),
      t('psgauge-t', 275, 593, 200, 28, { content: '园区健康度', fontSize: 13, color: '#b090dd', fontWeight: 'bold', textAlign: 'center' }),
      ch('psgauge-c', 'gauge', '仪表盘', 270, 625, 200, 220, {}),

      // 中 - 地图
      bd('psmap-b', 'border-13', '地图', 500, 220, 480, 420),
      ch('psmap-c', 'map-china', '中国地图', 510, 230, 460, 400, {}),

      // 中右 - 饼图
      bd('pspie-b', 'border-tech', '饼图', 1000, 220, 430, 420),
      t('pspie-t', 1020, 228, 200, 28, { content: '能耗类型分布', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('pspie-c', 'pie-doughnut', '环形图', 1010, 260, 410, 370, {}),

      // 右 - 分组柱状图
      bd('psbar-b', 'border-tech', '柱状图', 1450, 220, 440, 420),
      t('psbar-t', 1470, 228, 200, 28, { content: '楼栋能耗对比', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('psbar-c', 'bar-group', '分组柱状图', 1460, 260, 420, 370, {}),

      // 中下 - 排名
      bd('psrank-b', 'border-9', '排名', 500, 655, 480, 190),
      t('psrank-t', 520, 663, 200, 28, { content: '设备运行排名', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('psrank-c', 'rank-list', '排名列表', 510, 695, 460, 140, {}),

      // 中下右 - 面积图
      bd('psarea-b', 'border-9', '面积图', 1000, 655, 430, 190),
      t('psarea-t', 1020, 663, 200, 28, { content: '24小时能耗', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('psarea-c', 'line-area', '面积图', 1010, 695, 410, 140, {}),

      // 左下 - 日历图
      bd('pscal-b', 'border-4', '日历图', 30, 870, 450, 180),
      t('pscal-t', 50, 878, 200, 28, { content: '月度工单热力', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('pscal-c', 'calendar', '日历图', 40, 910, 430, 130, {}),

      // 中下 - 柱状图
      bd('psbar2-b', 'border-4', '柱状图', 500, 870, 480, 180),
      t('psbar2-t', 520, 878, 200, 28, { content: '周能耗趋势', fontSize: 14, color: '#b090dd', fontWeight: 'bold', textAlign: 'left' }),
      ch('psbar2-c', 'bar-single', '柱状图', 510, 910, 460, 130, {}),

      // 右下 - 水球图+漏斗
      bd('pswater-b', 'border-9', '水球图', 1000, 870, 210, 180),
      t('pswater-t', 1010, 878, 200, 28, { content: '安防覆盖率', fontSize: 13, color: '#b090dd', fontWeight: 'bold', textAlign: 'center' }),
      ch('pswater-c', 'water-ball', '水球图', 1010, 910, 190, 130, {}),

      bd('psfunnel-b', 'border-9', '漏斗图', 1230, 870, 210, 180),
      t('psfunnel-t', 1240, 878, 200, 28, { content: '工单处理', fontSize: 13, color: '#b090dd', fontWeight: 'bold', textAlign: 'center' }),
      ch('psfunnel-c', 'funnel', '漏斗图', 1240, 910, 190, 130, {}),

      bd('psgauge2-b', 'border-9', '仪表盘', 1460, 870, 210, 180),
      t('psgauge2-t', 1470, 878, 200, 28, { content: '设备在线率', fontSize: 13, color: '#b090dd', fontWeight: 'bold', textAlign: 'center' }),
      ch('psgauge2-c', 'gauge', '仪表盘', 1470, 910, 190, 130, {}),

      bd('psscatter-b', 'border-9', '散点图', 1690, 870, 200, 180),
      ch('psscatter-c', 'scatter', '散点图', 1695, 880, 190, 160, {}),

      deco('psbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  // 简化版保留作为 fallback
  {
    id: 'health-pro',
    name: '智慧医疗数据中心',
    description: '30+组件 | 门诊+住院+设备+床位 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 80% 20%, #042828 0%, #031a1a 40%, #010f0f 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('hsglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('h-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('h-title', 380, 14, 1160, 48, { content: '智慧医疗数据中心', fontSize: 30, color: '#b8fffc', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('h-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('h-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('h-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('h-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#26c6da' }),

      // 5个KPI
      bd('hk1', 'border-4', 'KPI1', 30, 85, 350, 140),
      num('hk1v', 50, 100, 310, 50, { value: 2856, fontSize: 32, color: '#26c6da' }),
      t('hk1l', 50, 155, 310, 22, { content: '今日门诊量', fontSize: 12, color: '#5a8a8a' }),

      bd('hk2', 'border-4', 'KPI2', 400, 85, 350, 140),
      num('hk2v', 420, 100, 310, 50, { value: 1280, fontSize: 32, color: '#80cbc4' }),
      t('hk2l', 420, 155, 310, 22, { content: '住院患者', fontSize: 12, color: '#5a8a8a' }),

      bd('hk3', 'border-4', 'KPI3', 770, 85, 350, 140),
      num('hk3v', 790, 100, 310, 50, { value: 85.6, suffix: '%', fontSize: 32, color: '#ffc107' }),
      t('hk3l', 790, 155, 310, 22, { content: '床位使用率', fontSize: 12, color: '#5a8a8a' }),

      bd('hk4', 'border-4', 'KPI4', 1140, 85, 350, 140),
      num('hk4v', 1160, 100, 310, 50, { value: 99.8, suffix: '%', fontSize: 32, color: '#69f0ae' }),
      t('hk4l', 1160, 155, 310, 22, { content: '设备正常率', fontSize: 12, color: '#5a8a8a' }),

      bd('hk5', 'border-4', 'KPI5', 1510, 85, 380, 140),
      num('hk5v', 1530, 100, 340, 50, { value: 12, fontSize: 32, color: '#ff5252' }),
      t('hk5l', 1530, 155, 340, 22, { content: '手术进行中', fontSize: 12, color: '#5a8a8a' }),

      // 左 - 折线图
      bd('hline-b', 'border-tech', '折线图', 30, 240, 620, 350),
      t('hline-t', 50, 248, 200, 28, { content: '门诊量趋势', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hline-c', 'line-smooth', '折线图', 40, 280, 600, 300, {}),

      // 中 - 饼图
      bd('hpie-b', 'border-tech', '饼图', 670, 240, 320, 350),
      t('hpie-t', 690, 248, 200, 28, { content: '科室分布', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'center' }),
      ch('hpie-c', 'pie-doughnut', '环形图', 680, 280, 300, 300, {}),

      // 右 - 分组柱状图
      bd('hbar-b', 'border-tech', '柱状图', 1010, 240, 440, 350),
      t('hbar-t', 1030, 248, 200, 28, { content: '科室床位使用', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hbar-c', 'bar-group', '分组柱状图', 1020, 280, 420, 300, {}),

      // 最右 - 雷达图
      bd('hradar-b', 'border-tech', '雷达图', 1470, 240, 420, 350),
      t('hradar-t', 1490, 248, 200, 28, { content: '医疗质量评估', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'center' }),
      ch('hradar-c', 'radar', '雷达图', 1480, 280, 400, 300, {}),

      // 左下 - 桑基图
      bd('hsankey-b', 'border-9', '桑基图', 30, 605, 460, 220),
      t('hsankey-t', 50, 613, 200, 28, { content: '患者流转分析', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hsankey-c', 'sankey', '桑基图', 40, 645, 440, 170, {}),

      // 中下 - 排名
      bd('hrank-b', 'border-9', '排名', 510, 605, 460, 220),
      t('hrank-t', 530, 613, 200, 28, { content: '科室绩效排名', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hrank-c', 'rank-list', '排名列表', 520, 645, 440, 170, {}),

      // 中右下 - 漏斗图
      bd('hfunnel-b', 'border-9', '漏斗图', 990, 605, 450, 220),
      t('hfunnel-t', 1010, 613, 200, 28, { content: '就诊流程转化', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hfunnel-c', 'funnel', '漏斗图', 1000, 645, 430, 170, {}),

      // 右下 - 仪表盘+水球
      bd('hgauge-b', 'border-9', '仪表盘', 1460, 605, 210, 220),
      t('hgauge-t', 1470, 613, 200, 28, { content: '医疗效率', fontSize: 13, color: '#80cccc', fontWeight: 'bold', textAlign: 'center' }),
      ch('hgauge-c', 'gauge', '仪表盘', 1470, 645, 190, 170, {}),

      bd('hwater-b', 'border-9', '水球图', 1690, 605, 200, 220),
      t('hwater-t', 1700, 613, 200, 28, { content: '满意度', fontSize: 13, color: '#80cccc', fontWeight: 'bold', textAlign: 'center' }),
      ch('hwater-c', 'water-ball', '水球图', 1700, 645, 180, 170, {}),

      // 底部 - 面积图+散点+日历
      bd('harea-b', 'border-4', '面积图', 30, 840, 460, 210),
      t('harea-t', 50, 848, 200, 28, { content: '住院趋势', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('harea-c', 'line-area', '面积图', 40, 880, 440, 160, {}),

      bd('hscatter-b', 'border-4', '散点图', 510, 840, 460, 210),
      t('hscatter-t', 530, 848, 200, 28, { content: '费用分布', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hscatter-c', 'scatter', '散点图', 520, 880, 440, 160, {}),

      bd('hcal-b', 'border-4', '日历图', 990, 840, 450, 210),
      t('hcal-t', 1010, 848, 200, 28, { content: '月度就诊热力', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hcal-c', 'calendar', '日历图', 1000, 880, 430, 160, {}),

      bd('hbar2-b', 'border-4', '柱状图', 1460, 840, 430, 210),
      t('hbar2-t', 1480, 848, 200, 28, { content: '周门诊对比', fontSize: 14, color: '#80cccc', fontWeight: 'bold', textAlign: 'left' }),
      ch('hbar2-c', 'bar-single', '柱状图', 1470, 880, 410, 160, {}),

      deco('hbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  {
    id: 'education-pro',
    name: '智慧教育校园平台',
    description: '30+组件 | 师生+课程+成绩+设备 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 40% 60%, #1a1008 0%, #140c06 35%, #0a0704 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('edsglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('ed-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('ed-title', 380, 14, 1160, 48, { content: '智慧校园管理平台', fontSize: 30, color: '#ffe0b2', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('ed-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('ed-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('ed-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('ed-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#ffb74d' }),

      bd('edk1', 'border-9', 'KPI1', 30, 85, 350, 140),
      num('edk1v', 50, 100, 310, 50, { value: 3286, fontSize: 32, color: '#ffb74d' }),
      t('edk1l', 50, 155, 310, 22, { content: '在校师生', fontSize: 12, color: '#8a7a5a' }),

      bd('edk2', 'border-9', 'KPI2', 400, 85, 350, 140),
      num('edk2v', 420, 100, 310, 50, { value: 86, fontSize: 32, color: '#ff8a65' }),
      t('edk2l', 420, 155, 310, 22, { content: '今日课程数', fontSize: 12, color: '#8a7a5a' }),

      bd('edk3', 'border-9', 'KPI3', 770, 85, 350, 140),
      num('edk3v', 790, 100, 310, 50, { value: 92.3, suffix: '%', fontSize: 32, color: '#69f0ae' }),
      t('edk3l', 790, 155, 310, 22, { content: '出勤率', fontSize: 12, color: '#8a7a5a' }),

      bd('edk4', 'border-9', 'KPI4', 1140, 85, 350, 140),
      num('edk4v', 1160, 100, 310, 50, { value: 98.5, suffix: '%', fontSize: 32, color: '#26c6da' }),
      t('edk4l', 1160, 155, 310, 22, { content: '设备在线率', fontSize: 12, color: '#8a7a5a' }),

      bd('edk5', 'border-9', 'KPI5', 1510, 85, 380, 140),
      num('edk5v', 1530, 100, 340, 50, { value: 45, fontSize: 32, color: '#ff5252' }),
      t('edk5l', 1530, 155, 340, 22, { content: '待处理报修', fontSize: 12, color: '#8a7a5a' }),

      bd('edbar-b', 'border-tech', '柱状图', 30, 240, 620, 350),
      t('edbar-t', 50, 248, 200, 28, { content: '各年级成绩分布', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edbar-c', 'bar-single', '柱状图', 40, 280, 600, 300, {}),

      bd('edline-b', 'border-tech', '折线图', 670, 240, 320, 350),
      t('edline-t', 690, 248, 200, 28, { content: '出勤趋势', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('edline-c', 'line-smooth', '折线图', 680, 280, 300, 300, {}),

      bd('edpie-b', 'border-tech', '饼图', 1010, 240, 440, 350),
      t('edpie-t', 1030, 248, 200, 28, { content: '课程类型分布', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edpie-c', 'pie-doughnut', '环形图', 1020, 280, 420, 300, {}),

      bd('edgauge-b', 'border-tech', '仪表盘', 1470, 240, 420, 350),
      t('edgauge-t', 1490, 248, 200, 28, { content: '教学满意度', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('edgauge-c', 'gauge', '仪表盘', 1480, 280, 400, 300, {}),

      bd('edradar-b', 'border-9', '雷达图', 30, 605, 460, 220),
      t('edradar-t', 50, 613, 200, 28, { content: '综合素质评估', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edradar-c', 'radar', '雷达图', 40, 645, 440, 170, {}),

      bd('edscatter-b', 'border-9', '散点图', 510, 605, 460, 220),
      t('edscatter-t', 530, 613, 200, 28, { content: '成绩与出勤关系', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edscatter-c', 'scatter', '散点图', 520, 645, 440, 170, {}),

      bd('edrank-b', 'border-9', '排名', 990, 605, 450, 220),
      t('edrank-t', 1010, 613, 200, 28, { content: '班级排名', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edrank-c', 'rank-list', '排名列表', 1000, 645, 430, 170, {}),

      bd('edwater-b', 'border-9', '水球图', 1460, 605, 210, 220),
      t('edwater-t', 1470, 613, 200, 28, { content: '升学率', fontSize: 13, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('edwater-c', 'water-ball', '水球图', 1470, 645, 190, 170, {}),

      bd('edfunnel-b', 'border-9', '漏斗图', 1690, 605, 200, 220),
      t('edfunnel-t', 1700, 613, 200, 28, { content: '报名转化', fontSize: 13, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('edfunnel-c', 'funnel', '漏斗图', 1700, 645, 180, 170, {}),

      bd('edarea-b', 'border-4', '面积图', 30, 840, 460, 210),
      t('edarea-t', 50, 848, 200, 28, { content: '月度出勤趋势', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edarea-c', 'line-area', '面积图', 40, 880, 440, 160, {}),

      bd('edbar2-b', 'border-4', '柱状图', 510, 840, 460, 210),
      t('edbar2-t', 530, 848, 200, 28, { content: '学科成绩对比', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edbar2-c', 'bar-group', '分组柱状图', 520, 880, 440, 160, {}),

      bd('edcal-b', 'border-4', '日历图', 990, 840, 450, 210),
      t('edcal-t', 1010, 848, 200, 28, { content: '学期日历', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('edcal-c', 'calendar', '日历图', 1000, 880, 430, 160, {}),

      bd('edgauge2-b', 'border-4', '仪表盘', 1460, 840, 430, 210),
      t('edgauge2-t', 1480, 848, 200, 28, { content: '设备健康度', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('edgauge2-c', 'gauge', '仪表盘', 1470, 880, 410, 160, {}),

      deco('edbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  {
    id: 'logistics-pro',
    name: '智慧物流调度中心',
    description: '30+组件 | 运输+签收+时效+排名 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(150deg, #061a12 0%, #0a2e1e 25%, #081e14 50%, #04100a 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('lgsglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('lg-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('lg-title', 380, 14, 1160, 48, { content: '智慧物流调度中心', fontSize: 30, color: '#b8ffcc', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('lg-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('lg-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('lg-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('lg-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#66bb6a' }),

      bd('lgk1', 'border-6', 'KPI1', 30, 85, 350, 140),
      num('lgk1v', 50, 100, 310, 50, { value: 52860, fontSize: 32, color: '#66bb6a' }),
      t('lgk1l', 50, 155, 310, 22, { content: '今日运单数', fontSize: 12, color: '#5a8a6a' }),

      bd('lgk2', 'border-6', 'KPI2', 400, 85, 350, 140),
      num('lgk2v', 420, 100, 310, 50, { value: 97.8, suffix: '%', fontSize: 32, color: '#81c784' }),
      t('lgk2l', 420, 155, 310, 22, { content: '签收率', fontSize: 12, color: '#5a8a6a' }),

      bd('lgk3', 'border-6', 'KPI3', 770, 85, 350, 140),
      num('lgk3v', 790, 100, 310, 50, { value: 2.3, suffix: '天', fontSize: 32, color: '#ffc107' }),
      t('lgk3l', 790, 155, 310, 22, { content: '平均时效', fontSize: 12, color: '#5a8a6a' }),

      bd('lgk4', 'border-6', 'KPI4', 1140, 85, 350, 140),
      num('lgk4v', 1160, 100, 310, 50, { value: 156, fontSize: 32, color: '#ff7043' }),
      t('lgk4l', 1160, 155, 310, 22, { content: '异常件数', fontSize: 12, color: '#5a8a6a' }),

      bd('lgk5', 'border-6', 'KPI5', 1510, 85, 380, 140),
      num('lgk5v', 1530, 100, 340, 50, { value: 2860, fontSize: 32, color: '#26c6da' }),
      t('lgk5l', 1530, 155, 340, 22, { content: '在途车辆', fontSize: 12, color: '#5a8a6a' }),

      bd('lgmap-b', 'border-13', '地图', 500, 220, 480, 420),
      ch('lgmap-c', 'map-china', '中国地图', 510, 230, 460, 400, {}),

      bd('lgbar-b', 'border-tech', '柱状图', 30, 240, 450, 350),
      t('lgbar-t', 50, 248, 200, 28, { content: '各线路运量', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgbar-c', 'bar-single', '柱状图', 40, 280, 430, 300, {}),

      bd('lgpie-b', 'border-tech', '饼图', 30, 605, 450, 220),
      t('lgpie-t', 50, 613, 200, 28, { content: '运输方式占比', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgpie-c', 'pie-doughnut', '环形图', 40, 645, 430, 170, {}),

      bd('lgline-b', 'border-tech', '折线图', 1000, 220, 430, 420),
      t('lgline-t', 1020, 228, 200, 28, { content: '签收率趋势', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgline-c', 'line-smooth', '折线图', 1010, 260, 410, 370, {}),

      bd('lgrank-b', 'border-tech', '排名', 1450, 220, 440, 420),
      t('lgrank-t', 1470, 228, 200, 28, { content: '线路效率排名', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgrank-c', 'rank-list', '排名列表', 1460, 260, 420, 370, {}),

      bd('lgarea-b', 'border-9', '面积图', 500, 655, 480, 190),
      t('lgarea-t', 520, 663, 200, 28, { content: '24小时运力', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgarea-c', 'line-area', '面积图', 510, 695, 460, 140, {}),

      bd('lgfunnel-b', 'border-9', '漏斗图', 1000, 655, 430, 190),
      t('lgfunnel-t', 1020, 663, 200, 28, { content: '订单处理漏斗', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgfunnel-c', 'funnel', '漏斗图', 1010, 695, 410, 140, {}),

      bd('lgwater-b', 'border-9', '水球图', 1450, 655, 210, 190),
      t('lgwater-t', 1460, 663, 200, 28, { content: '仓储饱和度', fontSize: 13, color: '#80ccaa', fontWeight: 'bold', textAlign: 'center' }),
      ch('lgwater-c', 'water-ball', '水球图', 1460, 695, 190, 140, {}),

      bd('lggauge-b', 'border-9', '仪表盘', 1680, 655, 210, 190),
      t('lggauge-t', 1690, 663, 200, 28, { content: '配送准时率', fontSize: 13, color: '#80ccaa', fontWeight: 'bold', textAlign: 'center' }),
      ch('lggauge-c', 'gauge', '仪表盘', 1690, 695, 190, 140, {}),

      bd('lgbar2-b', 'border-4', '柱状图', 30, 840, 450, 210),
      t('lgbar2-t', 50, 848, 200, 28, { content: '周运量对比', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgbar2-c', 'bar-group', '分组柱状图', 40, 880, 430, 160, {}),

      bd('lgradar-b', 'border-4', '雷达图', 500, 840, 480, 210),
      t('lgradar-t', 520, 848, 200, 28, { content: '服务质量评估', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgradar-c', 'radar', '雷达图', 510, 880, 460, 160, {}),

      bd('lgcal-b', 'border-4', '日历图', 1000, 840, 430, 210),
      t('lgcal-t', 1020, 848, 200, 28, { content: '月度运力热力', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgcal-c', 'calendar', '日历图', 1010, 880, 410, 160, {}),

      bd('lgscatter-b', 'border-4', '散点图', 1450, 840, 440, 210),
      t('lgscatter-t', 1470, 848, 200, 28, { content: '时效与成本关系', fontSize: 14, color: '#80ccaa', fontWeight: 'bold', textAlign: 'left' }),
      ch('lgscatter-c', 'scatter', '散点图', 1460, 880, 420, 160, {}),

      deco('lgbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  {
    id: 'business-pro',
    name: '企业经营驾驶舱',
    description: '30+组件 | 营收+利润+人效+增长 | 专业级',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'radial-gradient(ellipse at 60% 40%, #1a1408 0%, #120e06 35%, #0a0804 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('bsglow', 'deco-glow', '辉光', 860, -80, 180, 180),

      bd('bs-title-b', 'border-11', '标题框', 360, 8, 1200, 60),
      t('bs-title', 380, 14, 1160, 48, { content: '企业经营驾驶舱', fontSize: 30, color: '#ffe0b2', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('bs-dl', 'deco-line', '装饰线', 360, 68, 200, 2),
      deco('bs-dr', 'deco-line', '装饰线', 1360, 68, 200, 2),

      bd('bs-time', 'border-7', '时间', 1640, 18, 240, 42),
      t('bs-time-v', 1650, 24, 220, 30, { content: '', fontSize: 14, color: '#ffb74d' }),

      bd('bsk1', 'border-10', 'KPI1', 30, 85, 450, 150),
      t('bsk1-label', 50, 95, 200, 28, { content: '本月营收（万元）', fontSize: 14, color: '#8a7a5a', textAlign: 'left' }),
      num('bsk1v', 50, 125, 380, 50, { value: 5286, prefix: '¥', fontSize: 36, color: '#ffd740' }),
      t('bsk1c', 50, 180, 200, 22, { content: '↑ 12.8% 同比增长', fontSize: 12, color: '#69f0ae' }),

      bd('bsk2', 'border-10', 'KPI2', 500, 85, 450, 150),
      t('bsk2-label', 520, 95, 200, 28, { content: '本月净利润', fontSize: 14, color: '#8a7a5a', textAlign: 'left' }),
      num('bsk2v', 520, 125, 380, 50, { value: 1286, prefix: '¥', fontSize: 36, color: '#69f0ae' }),
      t('bsk2c', 520, 180, 200, 22, { content: '↑ 8.5% 同比增长', fontSize: 12, color: '#69f0ae' }),

      bd('bsk3', 'border-10', 'KPI3', 970, 85, 450, 150),
      t('bsk3-label', 990, 95, 200, 28, { content: '同比增长率', fontSize: 14, color: '#8a7a5a', textAlign: 'left' }),
      num('bsk3v', 990, 125, 380, 50, { value: 12.8, suffix: '%', fontSize: 36, color: '#82b1ff' }),
      t('bsk3c', 990, 180, 200, 22, { content: '超出目标 +3.2%', fontSize: 12, color: '#69f0ae' }),

      bd('bsk4', 'border-10', 'KPI4', 1440, 85, 450, 150),
      t('bsk4-label', 1460, 95, 200, 28, { content: '目标完成率', fontSize: 14, color: '#8a7a5a', textAlign: 'left' }),
      num('bsk4v', 1460, 125, 380, 50, { value: 85.6, suffix: '%', fontSize: 36, color: '#ce93d8' }),
      t('bsk4c', 1460, 180, 200, 22, { content: '距离目标还差14.4%', fontSize: 12, color: '#ffc107' }),

      bd('bsarea-b', 'border-tech', '面积图', 30, 250, 620, 360),
      t('bsarea-t', 50, 258, 200, 28, { content: '营收利润趋势', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bsarea-c', 'line-area', '面积图', 40, 290, 600, 310, {}),

      bd('bsbar-b', 'border-tech', '分组柱状图', 670, 250, 320, 360),
      t('bsbar-t', 690, 258, 200, 28, { content: '部门业绩', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('bsbar-c', 'bar-group', '分组柱状图', 680, 290, 300, 310, {}),

      bd('bspie-b', 'border-tech', '饼图', 1010, 250, 440, 360),
      t('bspie-t', 1030, 258, 200, 28, { content: '收入结构', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bspie-c', 'pie-doughnut', '环形图', 1020, 290, 420, 310, {}),

      bd('bsgauge-b', 'border-tech', '仪表盘', 1470, 250, 420, 360),
      t('bsgauge-t', 1490, 258, 200, 28, { content: '综合经营指数', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('bsgauge-c', 'gauge', '仪表盘', 1480, 290, 400, 310, {}),

      bd('bsradar-b', 'border-9', '雷达图', 30, 625, 460, 210),
      t('bsradar-t', 50, 633, 200, 28, { content: '多维能力评估', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bsradar-c', 'radar', '雷达图', 40, 665, 440, 160, {}),

      bd('bsscatter-b', 'border-9', '散点图', 510, 625, 460, 210),
      t('bsscatter-t', 530, 633, 200, 28, { content: '投入产出分析', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bsscatter-c', 'scatter', '散点图', 520, 665, 440, 160, {}),

      bd('bsrank-b', 'border-9', '排名', 990, 625, 450, 210),
      t('bsrank-t', 1010, 633, 200, 28, { content: '产品销售排名', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bsrank-c', 'rank-list', '排名列表', 1000, 665, 430, 160, {}),

      bd('bswater-b', 'border-9', '水球图', 1460, 625, 210, 210),
      t('bswater-t', 1470, 633, 200, 28, { content: '回款率', fontSize: 13, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('bswater-c', 'water-ball', '水球图', 1470, 665, 190, 160, {}),

      bd('bsfunnel-b', 'border-9', '漏斗图', 1690, 625, 200, 210),
      t('bsfunnel-t', 1700, 633, 200, 28, { content: '销售漏斗', fontSize: 13, color: '#ccaa78', fontWeight: 'bold', textAlign: 'center' }),
      ch('bsfunnel-c', 'funnel', '漏斗图', 1700, 665, 180, 160, {}),

      bd('bsline-b', 'border-4', '折线图', 30, 850, 460, 200),
      t('bsline-t', 50, 858, 200, 28, { content: '现金流趋势', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bsline-c', 'line-smooth', '折线图', 40, 890, 440, 150, {}),

      bd('bsstack-b', 'border-4', '堆叠图', 510, 850, 460, 200),
      t('bsstack-t', 530, 858, 200, 28, { content: '成本构成', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bsstack-c', 'bar-stack', '堆叠柱状图', 520, 890, 440, 150, {}),

      bd('bscal-b', 'border-4', '日历图', 990, 850, 450, 200),
      t('bscal-t', 1010, 858, 200, 28, { content: '月度营收热力', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bscal-c', 'calendar', '日历图', 1000, 890, 430, 150, {}),

      bd('bssankey-b', 'border-4', '桑基图', 1460, 850, 430, 200),
      t('bssankey-t', 1480, 858, 200, 28, { content: '资金流向', fontSize: 14, color: '#ccaa78', fontWeight: 'bold', textAlign: 'left' }),
      ch('bssankey-c', 'sankey', '桑基图', 1470, 890, 410, 150, {}),

      deco('bsbottom', 'deco-line', '底线', 30, 1065, 1860, 2),
    ]
  },

  // ==================== 11. 智慧交通信号控制 ====================
  {
    id: 'traffic-signal',
    name: '智慧交通信号控制',
    description: '信号灯+路口实时+车流分析+拥堵指数',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(180deg, #0a1628 0%, #0d2137 40%, #091a2a 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('tss-glow', 'deco-glow', '辉光', 860, -80, 200, 200),
      deco('tss-ct', 'deco-corner', '左上角', 0, 0, 60, 60),
      deco('tss-ctr', 'deco-corner', '右上角', 1860, 0, 60, 60),
      deco('tss-cb', 'deco-corner', '左下角', 0, 1020, 60, 60),
      deco('tss-cbr', 'deco-corner', '右下角', 1860, 1020, 60, 60),

      bd('tss-tb', 'border-11', '标题框', 360, 8, 1200, 56),
      t('tss-title', 380, 14, 1160, 44, { content: '智慧交通信号控制中心', fontSize: 30, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('tss-tdl', 'deco-line', '左装饰线', 360, 64, 200, 2),
      deco('tss-tdr', 'deco-line', '右装饰线', 1360, 64, 200, 2),

      bd('tss-time', 'border-7', '时间', 1650, 16, 240, 38),
      t('tss-time-v', 1660, 20, 220, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      bd('tss-date', 'border-7', '日期', 30, 16, 220, 38),
      t('tss-date-v', 40, 20, 200, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左侧：信号灯状态
      bd('tss-sig-b', 'border-9', '信号灯组', 30, 80, 280, 400),
      t('tss-sig-t', 50, 88, 200, 28, { content: '信号灯实时状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig1', 60, 130, 200, 40, { content: '东西主路 ● 绿灯', fontSize: 16, color: '#69f0ae', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig2', 60, 180, 200, 40, { content: '南北主路 ● 红灯', fontSize: 16, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig3', 60, 230, 200, 40, { content: '东西左转 ● 红灯', fontSize: 16, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig4', 60, 280, 200, 40, { content: '南北左转 ● 绿灯', fontSize: 16, color: '#69f0ae', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig5', 60, 330, 200, 40, { content: '行人东西 ● 红灯', fontSize: 16, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig6', 60, 380, 200, 40, { content: '行人南北 ● 绿灯', fontSize: 16, color: '#69f0ae', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-sig7', 60, 430, 200, 24, { content: '当前周期: 120秒', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),

      // 左下：路口实时监控
      bd('tss-cam-b', 'border-tech', '路口监控', 30, 495, 280, 280),
      t('tss-cam-t', 50, 503, 200, 28, { content: '路口实时画面', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-cam', 'custom-chart', '监控画面', 40, 535, 260, 230, {}),

      // 左下：排队长度
      bd('tss-queue-b', 'border-4', '排队长度', 30, 790, 280, 260),
      t('tss-queue-t', 50, 798, 200, 28, { content: '各方向排队长度', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-queue', 'bar-horizontal', '横向柱图', 40, 830, 260, 210, {}),

      // 中央：路口俯视图
      bd('tss-map-b', 'border-13', '路口俯视图', 330, 80, 620, 580),
      ch('tss-map', 'custom-chart', '路口示意图', 340, 110, 600, 520, {}),

      // 中下：车流量趋势
      bd('tss-flow-b', 'border-tech', '车流趋势', 330, 675, 620, 190),
      t('tss-flow-t', 350, 683, 200, 28, { content: '24小时车流量趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-flow', 'area-stack', '面积图', 340, 715, 600, 140, {}),

      // 中下：信号配时方案
      bd('tss-plan-b', 'border-4', '配时方案', 330, 880, 620, 170),
      t('tss-plan-t', 350, 888, 200, 28, { content: '当前配时方案', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-plan1', 350, 925, 180, 24, { content: '东西直行: 45s', fontSize: 13, color: '#69f0ae', textAlign: 'left' }),
      t('tss-plan2', 350, 955, 180, 24, { content: '东西左转: 20s', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
      t('tss-plan3', 560, 925, 180, 24, { content: '南北直行: 40s', fontSize: 13, color: '#69f0ae', textAlign: 'left' }),
      t('tss-plan4', 560, 955, 180, 24, { content: '南北左转: 15s', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
      t('tss-plan5', 770, 925, 180, 24, { content: '行人通行: 30s', fontSize: 13, color: '#5eb8ff', textAlign: 'left' }),
      t('tss-plan6', 770, 955, 180, 24, { content: '全红清空: 3s', fontSize: 13, color: '#ff5252', textAlign: 'left' }),

      // 右上：拥堵指数
      bd('tss-cong-b', 'border-9', '拥堵指数', 970, 80, 210, 180),
      t('tss-cong-t', 985, 88, 180, 28, { content: '拥堵指数', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      ch('tss-cong', 'gauge', '仪表盘', 980, 115, 190, 130, {}),

      // 右上：平均车速
      bd('tss-speed-b', 'border-9', '平均车速', 1195, 80, 210, 180),
      t('tss-speed-t', 1210, 88, 180, 28, { content: '平均车速', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('tss-speed-v', 1210, 120, 180, 50, { value: 38.5, suffix: 'km/h', fontSize: 28, color: '#ffc107', fontWeight: 'bold' }),
      t('tss-speed-d', 1210, 175, 180, 24, { content: '较昨日 -5.2%', fontSize: 11, color: '#ff5252', textAlign: 'center' }),

      // 右上：今日过车量
      bd('tss-total-b', 'border-9', '过车量', 1420, 80, 210, 180),
      t('tss-total-t', 1435, 88, 180, 28, { content: '今日过车量', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('tss-total-v', 1435, 120, 180, 50, { value: 52864, fontSize: 28, color: '#00e5ff', fontWeight: 'bold' }),
      t('tss-total-d', 1435, 175, 180, 24, { content: '较昨日 +3.1%', fontSize: 11, color: '#69f0ae', textAlign: 'center' }),

      // 右上：饱和度
      bd('tss-sat-b', 'border-9', '饱和度', 1650, 80, 240, 180),
      t('tss-sat-t', 1665, 88, 210, 28, { content: '车道饱和度', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      ch('tss-sat', 'gauge', '饱和度', 1660, 115, 220, 130, {}),

      // 右中：各车道流量
      bd('tss-lane-b', 'border-tech', '车道流量', 970, 275, 440, 280),
      t('tss-lane-t', 990, 283, 200, 28, { content: '各车道实时流量', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-lane', 'bar-single', '柱状图', 980, 315, 420, 230, {}),

      // 右中：排队长度排行
      bd('tss-rank-b', 'border-tech', '排队排行', 1425, 275, 465, 280),
      t('tss-rank-t', 1445, 283, 200, 28, { content: '各方向排队排行', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-rank', 'rank-list', '排名', 1435, 315, 445, 230, {}),

      // 右下：事件列表
      bd('tss-event-b', 'border-9', '事件列表', 970, 570, 440, 250),
      t('tss-event-t', 990, 578, 200, 28, { content: '交通事件', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('tss-ev1', 990, 615, 400, 24, { content: '14:32 东西主路追尾事故', fontSize: 12, color: '#ff5252', textAlign: 'left' }),
      t('tss-ev2', 990, 645, 400, 24, { content: '14:15 南向北违停已处理', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      t('tss-ev3', 990, 675, 400, 24, { content: '13:58 信号灯故障已恢复', fontSize: 12, color: '#ffc107', textAlign: 'left' }),
      t('tss-ev4', 990, 705, 400, 24, { content: '13:42 行人闯红灯提醒', fontSize: 12, color: '#5eb8ff', textAlign: 'left' }),
      t('tss-ev5', 990, 735, 400, 24, { content: '13:20 东西左转优化完成', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),

      // 右下：绿波分析
      bd('tss-wave-b', 'border-9', '绿波分析', 1425, 570, 465, 250),
      t('tss-wave-t', 1445, 578, 200, 28, { content: '绿波带分析', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-wave', 'line-smooth', '折线图', 1435, 610, 445, 200, {}),

      // 底部：路口列表
      bd('tss-list-b', 'border-4', '路口列表', 970, 835, 920, 220),
      t('tss-list-t', 990, 843, 200, 28, { content: '区域路口状态概览', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('tss-list', 'rank-list', '路口列表', 980, 875, 900, 170, {}),
    ]
  },

  // ==================== 12. 应急指挥中心 ====================
  {
    id: 'emergency',
    name: '应急指挥中心',
    description: '事件监测+资源调度+预案管理+态势分析',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(180deg, #1a0a0a 0%, #2d1515 30%, #0a0e1a 70%, #050810 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('emg-glow', 'deco-glow', '辉光', 860, -80, 200, 200),
      deco('emg-ct', 'deco-corner', '左上角', 0, 0, 60, 60),
      deco('emg-ctr', 'deco-corner', '右上角', 1860, 0, 60, 60),

      bd('emg-tb', 'border-11', '标题框', 360, 8, 1200, 56),
      t('emg-title', 380, 14, 1160, 44, { content: '应急指挥调度中心', fontSize: 30, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('emg-tdl', 'deco-line', '左装饰线', 360, 64, 200, 2),
      deco('emg-tdr', 'deco-line', '右装饰线', 1360, 64, 200, 2),

      bd('emg-time', 'border-7', '时间', 1650, 16, 240, 38),
      t('emg-time-v', 1660, 20, 220, 30, { content: '', fontSize: 14, color: '#ff8a8a' }),

      // 左上：事件总览
      bd('emg-total-b', 'border-9', '事件总览', 30, 80, 280, 180),
      t('emg-total-t', 50, 88, 200, 28, { content: '事件总览', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      num('emg-n1', 50, 120, 120, 40, { value: 23, fontSize: 28, color: '#ff5252', fontWeight: 'bold' }),
      t('emg-l1', 50, 165, 120, 24, { content: '待处理', fontSize: 12, color: '#ff8a8a', textAlign: 'center' }),
      num('emg-n2', 180, 120, 120, 40, { value: 8, fontSize: 28, color: '#ffc107', fontWeight: 'bold' }),
      t('emg-l2', 180, 165, 120, 24, { content: '处理中', fontSize: 12, color: '#ffc107', textAlign: 'center' }),
      num('emg-n3', 50, 205, 120, 40, { value: 156, fontSize: 28, color: '#69f0ae', fontWeight: 'bold' }),
      t('emg-l3', 50, 250, 120, 24, { content: '已结案', fontSize: 12, color: '#69f0ae', textAlign: 'center' }),
      num('emg-n4', 180, 205, 120, 40, { value: 98.2, suffix: '%', fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('emg-l4', 180, 250, 120, 24, { content: '结案率', fontSize: 12, color: '#5eb8ff', textAlign: 'center' }),

      // 左中：事件类型分布
      bd('emg-type-b', 'border-tech', '事件类型', 30, 275, 280, 280),
      t('emg-type-t', 50, 283, 200, 28, { content: '事件类型分布', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      ch('emg-type', 'pie-doughnut', '环形图', 40, 315, 260, 230, {}),

      // 左中下：预警等级
      bd('emg-level-b', 'border-9', '预警等级', 30, 570, 280, 230),
      t('emg-level-t', 50, 578, 200, 28, { content: '预警等级统计', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      ch('emg-level', 'bar-single', '柱状图', 40, 610, 260, 180, {}),

      // 左下：资源分布
      bd('emg-res-b', 'border-4', '资源分布', 30, 815, 280, 235),
      t('emg-res-t', 50, 823, 200, 28, { content: '应急资源分布', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      num('emg-r1', 50, 860, 120, 40, { value: 12, fontSize: 26, color: '#00e5ff', fontWeight: 'bold' }),
      t('emg-rl1', 50, 905, 120, 22, { content: '消防队', fontSize: 12, color: '#ff8a8a', textAlign: 'center' }),
      num('emg-r2', 180, 860, 120, 40, { value: 8, fontSize: 26, color: '#ffc107', fontWeight: 'bold' }),
      t('emg-rl2', 180, 905, 120, 22, { content: '救护车', fontSize: 12, color: '#ffc107', textAlign: 'center' }),
      num('emg-r3', 50, 940, 120, 40, { value: 5, fontSize: 26, color: '#69f0ae', fontWeight: 'bold' }),
      t('emg-rl3', 50, 985, 120, 22, { content: '物资储备', fontSize: 12, color: '#69f0ae', textAlign: 'center' }),
      num('emg-r4', 180, 940, 120, 40, { value: 3, fontSize: 26, color: '#ff5252', fontWeight: 'bold' }),
      t('emg-rl4', 180, 985, 120, 22, { content: '避难场所', fontSize: 12, color: '#ff5252', textAlign: 'center' }),

      // 中央：事件地图
      bd('emg-map-b', 'border-13', '事件地图', 330, 80, 960, 580),
      ch('emg-map', 'map-china', '地图', 340, 110, 940, 540, {}),

      // 中下：响应时间趋势
      bd('emg-time-b', 'border-tech', '响应时间', 330, 675, 470, 180),
      t('emg-time-t', 350, 683, 200, 28, { content: '响应时间趋势', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      ch('emg-time-c', 'line-smooth', '折线图', 340, 715, 450, 130, {}),

      // 中下：处理效率
      bd('emg-eff-b', 'border-tech', '处理效率', 330, 870, 470, 180),
      t('emg-eff-t', 350, 878, 200, 28, { content: '事件处理效率', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      ch('emg-eff', 'gauge', '仪表盘', 340, 905, 450, 140, {}),

      // 右上：实时告警
      bd('emg-alert-b', 'border-9', '实时告警', 1310, 80, 580, 280),
      t('emg-alert-t', 1330, 88, 200, 28, { content: '实时告警列表', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      t('emg-a1', 1330, 125, 540, 24, { content: '🔴 14:32 某化工厂气体泄漏 - 一级响应', fontSize: 13, color: '#ff5252', textAlign: 'left' }),
      t('emg-a2', 1330, 155, 540, 24, { content: '🟡 14:15 城区暴雨积水预警 - 二级响应', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
      t('emg-a3', 1330, 185, 540, 24, { content: '🟡 13:58 高速路段团雾预警', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
      t('emg-a4', 1330, 215, 540, 24, { content: '🟢 13:42 建筑工地安全检查完成', fontSize: 13, color: '#69f0ae', textAlign: 'left' }),
      t('emg-a5', 1330, 245, 540, 24, { content: '🟢 13:20 消防演练已结束', fontSize: 13, color: '#69f0ae', textAlign: 'left' }),
      t('emg-a6', 1330, 275, 540, 24, { content: '🔴 13:05 地铁站人群聚集预警', fontSize: 13, color: '#ff5252', textAlign: 'left' }),
      t('emg-a7', 1330, 305, 540, 24, { content: '🟡 12:48 危化品运输车辆偏离路线', fontSize: 13, color: '#ffc107', textAlign: 'left' }),

      // 右中：预案列表
      bd('emg-plan-b', 'border-tech', '预案列表', 1310, 375, 580, 280),
      t('emg-plan-t', 1330, 383, 200, 28, { content: '应急预案管理', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      ch('emg-plan', 'rank-list', '预案列表', 1320, 415, 560, 230, {}),

      // 右下：处置流程
      bd('emg-flow-b', 'border-9', '处置流程', 1310, 670, 580, 190),
      t('emg-flow-t', 1330, 678, 200, 28, { content: '事件处置流程', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      ch('emg-flow', 'funnel', '漏斗图', 1320, 710, 560, 140, {}),

      // 右下：值班人员
      bd('emg-duty-b', 'border-4', '值班人员', 1310, 875, 580, 175),
      t('emg-duty-t', 1330, 883, 200, 28, { content: '当前值班人员', fontSize: 14, color: '#ff6b6b', fontWeight: 'bold', textAlign: 'left' }),
      t('emg-duty1', 1330, 920, 180, 24, { content: '指挥长: 张明', fontSize: 13, color: '#ff8a8a', textAlign: 'left' }),
      t('emg-duty2', 1330, 950, 180, 24, { content: '联络员: 李华', fontSize: 13, color: '#ff8a8a', textAlign: 'left' }),
      t('emg-duty3', 1330, 980, 180, 24, { content: '技术员: 王强', fontSize: 13, color: '#ff8a8a', textAlign: 'left' }),
      t('emg-duty4', 1530, 920, 180, 24, { content: '消防队长: 赵刚', fontSize: 13, color: '#ff8a8a', textAlign: 'left' }),
      t('emg-duty5', 1530, 950, 180, 24, { content: '医疗组长: 陈静', fontSize: 13, color: '#ff8a8a', textAlign: 'left' }),
      t('emg-duty6', 1530, 980, 180, 24, { content: '后勤组长: 刘伟', fontSize: 13, color: '#ff8a8a', textAlign: 'left' }),
    ]
  },

  // ==================== 13. 智慧社区管理 ====================
  {
    id: 'smart-community',
    name: '智慧社区管理平台',
    description: '人口管理+安防监控+物业服务+社区活动',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(135deg, #0a1628 0%, #0d2847 50%, #091c36 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('cm-glow', 'deco-glow', '辉光', 860, -80, 200, 200),
      deco('cm-ct', 'deco-corner', '左上角', 0, 0, 60, 60),
      deco('cm-ctr', 'deco-corner', '右上角', 1860, 0, 60, 60),
      deco('cm-cb', 'deco-corner', '左下角', 0, 1020, 60, 60),
      deco('cm-cbr', 'deco-corner', '右下角', 1860, 1020, 60, 60),

      bd('cm-tb', 'border-11', '标题框', 360, 8, 1200, 56),
      t('cm-title', 380, 14, 1160, 44, { content: '智慧社区管理服务平台', fontSize: 30, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('cm-tdl', 'deco-line', '左装饰线', 360, 64, 200, 2),
      deco('cm-tdr', 'deco-line', '右装饰线', 1360, 64, 200, 2),

      bd('cm-time', 'border-7', '时间', 1650, 16, 240, 38),
      t('cm-time-v', 1660, 20, 220, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左上：人口概览
      bd('cm-pop-b', 'border-9', '人口概览', 30, 80, 280, 200),
      t('cm-pop-t', 50, 88, 200, 28, { content: '社区人口概览', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('cm-p1', 50, 125, 120, 40, { value: 12860, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('cm-pl1', 50, 170, 120, 22, { content: '总人口', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-p2', 180, 125, 120, 40, { value: 4520, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('cm-pl2', 180, 170, 120, 22, { content: '常住人口', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-p3', 50, 210, 120, 40, { value: 328, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('cm-pl3', 50, 255, 120, 22, { content: '今日新增', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-p4', 180, 210, 120, 40, { value: 98.5, suffix: '%', fontSize: 22, color: '#00e5ff', fontWeight: 'bold' }),
      t('cm-pl4', 180, 255, 120, 22, { content: '登记率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 左中：楼栋分布
      bd('cm-build-b', 'border-tech', '楼栋分布', 30, 295, 280, 280),
      t('cm-build-t', 50, 303, 200, 28, { content: '楼栋分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-build', 'bar-single', '柱状图', 40, 335, 260, 230, {}),

      // 左中下：人口年龄结构
      bd('cm-age-b', 'border-9', '年龄结构', 30, 590, 280, 240),
      t('cm-age-t', 50, 598, 200, 28, { content: '人口年龄结构', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-age', 'pie-doughnut', '环形图', 40, 630, 260, 190, {}),

      // 左下：车位使用
      bd('cm-park-b', 'border-4', '车位使用', 30, 845, 280, 205),
      t('cm-park-t', 50, 853, 200, 28, { content: '车位使用情况', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('cm-pk1', 50, 890, 120, 40, { value: 856, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('cm-pkl1', 50, 935, 120, 22, { content: '总车位', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-pk2', 180, 890, 120, 40, { value: 723, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('cm-pkl2', 180, 935, 120, 22, { content: '已使用', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      ch('cm-pk-gauge', 'gauge', '使用率', 50, 955, 240, 80, {}),

      // 中央：社区地图
      bd('cm-map-b', 'border-13', '社区地图', 330, 80, 620, 580),
      ch('cm-map', 'map-china', '社区地图', 340, 110, 600, 540, {}),

      // 中下：事件趋势
      bd('cm-event-b', 'border-tech', '事件趋势', 330, 675, 620, 180),
      t('cm-event-t', 350, 683, 200, 28, { content: '近7日事件趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-event', 'area-stack', '面积图', 340, 715, 600, 130, {}),

      // 中下：服务评分
      bd('cm-score-b', 'border-4', '服务评分', 330, 870, 620, 180),
      t('cm-score-t', 350, 878, 200, 28, { content: '物业服务评分', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-score', 'radar', '雷达图', 340, 905, 600, 140, {}),

      // 右上：安防状态
      bd('cm-safe-b', 'border-9', '安防状态', 970, 80, 210, 200),
      t('cm-safe-t', 985, 88, 180, 28, { content: '安防状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('cm-s1', 985, 125, 180, 40, { value: 128, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('cm-sl1', 985, 170, 180, 22, { content: '监控摄像头', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-s2', 985, 200, 180, 40, { value: 126, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('cm-sl2', 985, 245, 180, 22, { content: '正常运行', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：门禁状态
      bd('cm-door-b', 'border-9', '门禁状态', 1195, 80, 210, 200),
      t('cm-door-t', 1210, 88, 180, 28, { content: '门禁系统', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('cm-d1', 1210, 125, 180, 40, { value: 45, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('cm-dl1', 1210, 170, 180, 22, { content: '门禁点位', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-d2', 1210, 200, 180, 40, { value: 44, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('cm-dl2', 1210, 245, 180, 22, { content: '正常运行', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：今日出入
      bd('cm-inout-b', 'border-9', '今日出入', 1420, 80, 210, 200),
      t('cm-inout-t', 1435, 88, 180, 28, { content: '今日出入', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('cm-io1', 1435, 125, 180, 40, { value: 3280, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('cm-iol1', 1435, 170, 180, 22, { content: '进入人次', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-io2', 1435, 200, 180, 40, { value: 3150, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('cm-iol2', 1435, 245, 180, 22, { content: '离开人次', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：访客登记
      bd('cm-visit-b', 'border-9', '访客登记', 1650, 80, 240, 200),
      t('cm-visit-t', 1665, 88, 210, 28, { content: '今日访客登记', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('cm-v1', 1665, 125, 210, 40, { value: 186, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('cm-vl1', 1665, 170, 210, 22, { content: '已登记', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('cm-v2', 1665, 200, 210, 40, { value: 12, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('cm-vl2', 1665, 245, 210, 22, { content: '待审核', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右中：事件类型
      bd('cm-etype-b', 'border-tech', '事件类型', 970, 295, 440, 280),
      t('cm-etype-t', 990, 303, 200, 28, { content: '事件类型分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-etype', 'funnel', '漏斗图', 980, 335, 420, 230, {}),

      // 右中：处理效率
      bd('cm-eff-b', 'border-tech', '处理效率', 1425, 295, 465, 280),
      t('cm-eff-t', 1445, 303, 200, 28, { content: '事件处理效率', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-eff', 'line-smooth', '折线图', 1435, 335, 445, 230, {}),

      // 右下：公告通知
      bd('cm-notice-b', 'border-9', '公告通知', 970, 590, 440, 230),
      t('cm-notice-t', 990, 598, 200, 28, { content: '社区公告', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('cm-n1', 990, 635, 400, 24, { content: '📢 关于春节期间安全注意事项', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),
      t('cm-n2', 990, 665, 400, 24, { content: '📢 小区绿化改造方案公示', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),
      t('cm-n3', 990, 695, 400, 24, { content: '📢 停水通知（2月15日）', fontSize: 12, color: '#ffc107', textAlign: 'left' }),
      t('cm-n4', 990, 725, 400, 24, { content: '📢 社区义诊活动报名', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),
      t('cm-n5', 990, 755, 400, 24, { content: '📢 电梯维保通知', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      t('cm-n6', 990, 785, 400, 24, { content: '📢 垃圾分类宣传', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),

      // 右下：投诉建议
      bd('cm-complain-b', 'border-9', '投诉建议', 1425, 590, 465, 230),
      t('cm-complain-t', 1445, 598, 200, 28, { content: '投诉建议统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('cm-complain', 'bar-horizontal', '横向柱图', 1435, 630, 445, 180, {}),

      // 右下：社区活动
      bd('cm-activity-b', 'border-4', '社区活动', 970, 835, 920, 215),
      t('cm-activity-t', 990, 843, 200, 28, { content: '近期社区活动', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('cm-act1', 990, 880, 280, 24, { content: '2/18 春节联欢晚会', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
      t('cm-act2', 990, 910, 280, 24, { content: '2/20 社区义诊', fontSize: 13, color: '#69f0ae', textAlign: 'left' }),
      t('cm-act3', 990, 940, 280, 24, { content: '2/22 健身操课', fontSize: 13, color: '#5eb8ff', textAlign: 'left' }),
      t('cm-act4', 1290, 880, 280, 24, { content: '2/25 亲子阅读', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
      t('cm-act5', 1290, 910, 280, 24, { content: '2/28 消防演练', fontSize: 13, color: '#ff5252', textAlign: 'left' }),
      t('cm-act6', 1290, 940, 280, 24, { content: '3/1 植树活动', fontSize: 13, color: '#69f0ae', textAlign: 'left' }),
      t('cm-act7', 1590, 880, 280, 24, { content: '3/3 法律咨询', fontSize: 13, color: '#5eb8ff', textAlign: 'left' }),
      t('cm-act8', 1590, 910, 280, 24, { content: '3/5 学雷锋志愿', fontSize: 13, color: '#ffc107', textAlign: 'left' }),
    ]
  },

  // ==================== 14. 智慧停车管理 ====================
  {
    id: 'smart-parking',
    name: '智慧停车管理平台',
    description: '车位监控+停车引导+收入统计+车流分析',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(180deg, #0a1628 0%, #0d2847 40%, #091c36 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('pk-glow', 'deco-glow', '辉光', 860, -80, 200, 200),
      deco('pk-ct', 'deco-corner', '左上角', 0, 0, 60, 60),
      deco('pk-ctr', 'deco-corner', '右上角', 1860, 0, 60, 60),
      deco('pk-cb', 'deco-corner', '左下角', 0, 1020, 60, 60),
      deco('pk-cbr', 'deco-corner', '右下角', 1860, 1020, 60, 60),

      bd('pk-tb', 'border-11', '标题框', 360, 8, 1200, 56),
      t('pk-title', 380, 14, 1160, 44, { content: '智慧停车管理平台', fontSize: 30, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('pk-tdl', 'deco-line', '左装饰线', 360, 64, 200, 2),
      deco('pk-tdr', 'deco-line', '右装饰线', 1360, 64, 200, 2),

      bd('pk-time', 'border-7', '时间', 1650, 16, 240, 38),
      t('pk-time-v', 1660, 20, 220, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左上：总车位
      bd('pk-total-b', 'border-9', '总车位', 30, 80, 280, 180),
      t('pk-total-t', 50, 88, 200, 28, { content: '车位总览', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('pk-n1', 50, 125, 120, 40, { value: 2400, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('pk-l1', 50, 170, 120, 22, { content: '总车位', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-n2', 180, 125, 120, 40, { value: 1856, fontSize: 24, color: '#ff5252', fontWeight: 'bold' }),
      t('pk-l2', 180, 170, 120, 22, { content: '已占用', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-n3', 50, 210, 120, 40, { value: 544, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('pk-l3', 50, 255, 120, 22, { content: '空闲车位', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-n4', 180, 210, 120, 40, { value: 77.3, suffix: '%', fontSize: 22, color: '#ffc107', fontWeight: 'bold' }),
      t('pk-l4', 180, 255, 120, 22, { content: '占用率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 左中：区域车位
      bd('pk-area-b', 'border-tech', '区域车位', 30, 275, 280, 280),
      t('pk-area-t', 50, 283, 200, 28, { content: '各区域车位状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-area', 'bar-single', '柱状图', 40, 315, 260, 230, {}),

      // 左中下：车位类型
      bd('pk-type-b', 'border-9', '车位类型', 30, 570, 280, 230),
      t('pk-type-t', 50, 578, 200, 28, { content: '车位类型分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-type', 'pie-doughnut', '环形图', 40, 610, 260, 180, {}),

      // 左下：充电车位
      bd('pk-ev-b', 'border-4', '充电车位', 30, 815, 280, 235),
      t('pk-ev-t', 50, 823, 200, 28, { content: '充电桩状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('pk-ev1', 50, 860, 120, 40, { value: 48, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('pk-evl1', 50, 905, 120, 22, { content: '充电桩', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-ev2', 180, 860, 120, 40, { value: 32, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('pk-evl2', 180, 905, 120, 22, { content: '使用中', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      ch('pk-ev-gauge', 'gauge', '使用率', 50, 925, 240, 110, {}),

      // 中央：停车场地图
      bd('pk-map-b', 'border-13', '停车场地图', 330, 80, 620, 580),
      ch('pk-map', 'map-china', '停车场地图', 340, 110, 600, 540, {}),

      // 中下：车流趋势
      bd('pk-flow-b', 'border-tech', '车流趋势', 330, 675, 620, 180),
      t('pk-flow-t', 350, 683, 200, 28, { content: '24小时车流趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-flow', 'area-stack', '面积图', 340, 715, 600, 130, {}),

      // 中下：收入统计
      bd('pk-income-b', 'border-4', '收入统计', 330, 870, 620, 180),
      t('pk-income-t', 350, 878, 200, 28, { content: '本月收入统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-income', 'bar-stack', '堆叠柱图', 340, 905, 600, 140, {}),

      // 右上：实时停车
      bd('pk-real-b', 'border-9', '实时停车', 970, 80, 210, 200),
      t('pk-real-t', 985, 88, 180, 28, { content: '实时停车信息', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('pk-r1', 985, 125, 180, 40, { value: 286, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('pk-rl1', 985, 170, 180, 22, { content: '当前在场', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-r2', 985, 200, 180, 40, { value: 42, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('pk-rl2', 985, 245, 180, 22, { content: '今日入场', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：平均时长
      bd('pk-dur-b', 'border-9', '平均时长', 1195, 80, 210, 200),
      t('pk-dur-t', 1210, 88, 180, 28, { content: '平均停车时长', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('pk-d1', 1210, 125, 180, 40, { value: 3.2, suffix: 'h', fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('pk-dl1', 1210, 170, 180, 22, { content: '平均时长', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-d2', 1210, 200, 180, 40, { value: 15.6, suffix: '元', fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('pk-dl2', 1210, 245, 180, 22, { content: '平均收费', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：今日收入
      bd('pk-money-b', 'border-9', '今日收入', 1420, 80, 210, 200),
      t('pk-money-t', 1435, 88, 180, 28, { content: '今日收入', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('pk-m1', 1435, 125, 180, 40, { value: 4526, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('pk-ml1', 1435, 170, 180, 22, { content: '总收入（元）', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-m2', 1435, 200, 180, 40, { value: 12.5, suffix: '%', fontSize: 22, color: '#69f0ae', fontWeight: 'bold' }),
      t('pk-ml2', 1435, 245, 180, 22, { content: '较昨日', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：月收入
      bd('pk-month-b', 'border-9', '月收入', 1650, 80, 240, 200),
      t('pk-month-t', 1665, 88, 210, 28, { content: '本月累计收入', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('pk-mo1', 1665, 125, 210, 40, { value: 98520, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('pk-mol1', 1665, 170, 210, 22, { content: '本月总收入（元）', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('pk-mo2', 1665, 200, 210, 40, { value: 8.3, suffix: '%', fontSize: 22, color: '#69f0ae', fontWeight: 'bold' }),
      t('pk-mol2', 1665, 245, 210, 22, { content: '较上月', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右中：车位排行
      bd('pk-rank-b', 'border-tech', '车位排行', 970, 295, 440, 280),
      t('pk-rank-t', 990, 303, 200, 28, { content: '各区域车位使用排行', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-rank', 'rank-list', '排名', 980, 335, 420, 230, {}),

      // 右中：支付方式
      bd('pk-pay-b', 'border-tech', '支付方式', 1425, 295, 465, 280),
      t('pk-pay-t', 1445, 303, 200, 28, { content: '支付方式分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-pay', 'pie-doughnut', '环形图', 1435, 335, 445, 230, {}),

      // 右下：月度趋势
      bd('pk-month-trend-b', 'border-9', '月度趋势', 970, 590, 440, 230),
      t('pk-month-trend-t', 990, 598, 200, 28, { content: '月度收入趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-month-trend', 'line-smooth', '折线图', 980, 630, 420, 180, {}),

      // 右下：逃费统计
      bd('pk-escape-b', 'border-9', '逃费统计', 1425, 590, 465, 230),
      t('pk-escape-t', 1445, 598, 200, 28, { content: '逃费车辆统计', fontSize: 14, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-escape', 'bar-horizontal', '横向柱图', 1435, 630, 445, 180, {}),

      // 右下：最近停车记录
      bd('pk-record-b', 'border-4', '停车记录', 970, 835, 920, 215),
      t('pk-record-t', 990, 843, 200, 28, { content: '最近停车记录', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('pk-record', 'rank-list', '记录列表', 980, 875, 900, 170, {}),
    ]
  },

  // ==================== 15. 数字孪生可视化 ====================
  {
    id: 'digital-twin',
    name: '数字孪生可视化平台',
    description: '3D场景+设备监控+能耗分析+环境感知',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(180deg, #050a15 0%, #0a1628 40%, #0d2137 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('dt-glow', 'deco-glow', '辉光', 860, -80, 200, 200),
      deco('dt-ct', 'deco-corner', '左上角', 0, 0, 60, 60),
      deco('dt-ctr', 'deco-corner', '右上角', 1860, 0, 60, 60),

      bd('dt-tb', 'border-11', '标题框', 360, 8, 1200, 56),
      t('dt-title', 380, 14, 1160, 44, { content: '数字孪生可视化平台', fontSize: 30, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('dt-tdl', 'deco-line', '左装饰线', 360, 64, 200, 2),
      deco('dt-tdr', 'deco-line', '右装饰线', 1360, 64, 200, 2),

      bd('dt-time', 'border-7', '时间', 1650, 16, 240, 38),
      t('dt-time-v', 1660, 20, 220, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左上：设备总览
      bd('dt-dev-b', 'border-9', '设备总览', 30, 80, 280, 180),
      t('dt-dev-t', 50, 88, 200, 28, { content: '设备总览', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('dt-d1', 50, 125, 120, 40, { value: 1286, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('dt-dl1', 50, 170, 120, 22, { content: '设备总数', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-d2', 180, 125, 120, 40, { value: 1245, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('dt-dl2', 180, 170, 120, 22, { content: '在线设备', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-d3', 50, 210, 120, 40, { value: 96.8, suffix: '%', fontSize: 22, color: '#ffc107', fontWeight: 'bold' }),
      t('dt-dl3', 50, 255, 120, 22, { content: '在线率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-d4', 180, 210, 120, 40, { value: 41, fontSize: 24, color: '#ff5252', fontWeight: 'bold' }),
      t('dt-dl4', 180, 255, 120, 22, { content: '告警设备', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 左中：设备类型
      bd('dt-type-b', 'border-tech', '设备类型', 30, 275, 280, 280),
      t('dt-type-t', 50, 283, 200, 28, { content: '设备类型分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-type', 'pie-doughnut', '环形图', 40, 315, 260, 230, {}),

      // 左中下：能耗分析
      bd('dt-energy-b', 'border-9', '能耗分析', 30, 570, 280, 240),
      t('dt-energy-t', 50, 578, 200, 28, { content: '能耗实时监测', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('dt-e1', 50, 615, 120, 40, { value: 2856, fontSize: 22, color: '#ffc107', fontWeight: 'bold' }),
      t('dt-el1', 50, 660, 120, 22, { content: '电(kWh)', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-e2', 180, 615, 120, 40, { value: 156, fontSize: 22, color: '#5eb8ff', fontWeight: 'bold' }),
      t('dt-el2', 180, 660, 120, 22, { content: '水(m³)', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      ch('dt-energy-gauge', 'gauge', '能耗指数', 50, 690, 240, 100, {}),

      // 左下：环境监测
      bd('dt-env-b', 'border-4', '环境监测', 30, 825, 280, 225),
      t('dt-env-t', 50, 833, 200, 28, { content: '环境监测', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('dt-env1', 50, 870, 120, 40, { value: 24.5, suffix: '°C', fontSize: 22, color: '#ffc107', fontWeight: 'bold' }),
      t('dt-envl1', 50, 915, 120, 22, { content: '温度', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-env2', 180, 870, 120, 40, { value: 65, suffix: '%', fontSize: 22, color: '#5eb8ff', fontWeight: 'bold' }),
      t('dt-envl2', 180, 915, 120, 22, { content: '湿度', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-env3', 50, 950, 120, 40, { value: 42, fontSize: 22, color: '#69f0ae', fontWeight: 'bold' }),
      t('dt-envl3', 50, 995, 120, 22, { content: 'PM2.5', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-env4', 180, 950, 120, 40, { value: 98, fontSize: 22, color: '#00e5ff', fontWeight: 'bold' }),
      t('dt-envl4', 180, 995, 120, 22, { content: 'CO₂(ppm)', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 中央：3D场景
      bd('dt-3d-b', 'border-13', '3D场景', 330, 80, 620, 580),
      ch('dt-3d', 'custom-chart', '3D场景', 340, 110, 600, 540, {}),

      // 中下：能耗趋势
      bd('dt-trend-b', 'border-tech', '能耗趋势', 330, 675, 620, 180),
      t('dt-trend-t', 350, 683, 200, 28, { content: '24小时能耗趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-trend', 'area-stack', '面积图', 340, 715, 600, 130, {}),

      // 中下：告警统计
      bd('dt-alert-b', 'border-4', '告警统计', 330, 870, 620, 180),
      t('dt-alert-t', 350, 878, 200, 28, { content: '本月告警统计', fontSize: 14, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-alert', 'bar-stack', '堆叠柱图', 340, 905, 600, 140, {}),

      // 右上：系统状态
      bd('dt-sys-b', 'border-9', '系统状态', 970, 80, 210, 200),
      t('dt-sys-t', 985, 88, 180, 28, { content: '系统运行状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('dt-s1', 985, 125, 180, 40, { value: 99.9, suffix: '%', fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('dt-sl1', 985, 170, 180, 22, { content: '系统可用率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-s2', 985, 200, 180, 40, { value: 12, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('dt-sl2', 985, 245, 180, 22, { content: '今日告警', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：数据延迟
      bd('dt-delay-b', 'border-9', '数据延迟', 1195, 80, 210, 200),
      t('dt-delay-t', 1210, 88, 180, 28, { content: '数据采集延迟', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('dt-dl1', 1210, 125, 180, 40, { value: 128, suffix: 'ms', fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('dt-dll1', 1210, 170, 180, 22, { content: '平均延迟', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-dl2', 1210, 200, 180, 40, { value: 50000, fontSize: 22, color: '#69f0ae', fontWeight: 'bold' }),
      t('dt-dll2', 1210, 245, 180, 22, { content: '采集频率/日', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：存储状态
      bd('dt-store-b', 'border-9', '存储状态', 1420, 80, 210, 200),
      t('dt-store-t', 1435, 88, 180, 28, { content: '存储使用状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('dt-st1', 1435, 125, 180, 40, { value: 2.8, suffix: 'TB', fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('dt-stl1', 1435, 170, 180, 22, { content: '已使用', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-st2', 1435, 200, 180, 40, { value: 72, suffix: '%', fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('dt-stl2', 1435, 245, 180, 22, { content: '使用率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：网络状态
      bd('dt-net-b', 'border-9', '网络状态', 1650, 80, 240, 200),
      t('dt-net-t', 1665, 88, 210, 28, { content: '网络连接状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('dt-n1', 1665, 125, 210, 40, { value: 1286, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('dt-nl1', 1665, 170, 210, 22, { content: '在线设备', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('dt-n2', 1665, 200, 210, 40, { value: 98.5, suffix: '%', fontSize: 22, color: '#00e5ff', fontWeight: 'bold' }),
      t('dt-nl2', 1665, 245, 210, 22, { content: '连接成功率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右中：设备告警排行
      bd('dt-alarm-b', 'border-tech', '告警排行', 970, 295, 440, 280),
      t('dt-alarm-t', 990, 303, 200, 28, { content: '设备告警排行', fontSize: 14, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-alarm', 'rank-list', '排名', 980, 335, 420, 230, {}),

      // 右中：能耗排行
      bd('dt-erank-b', 'border-tech', '能耗排行', 1425, 295, 465, 280),
      t('dt-erank-t', 1445, 303, 200, 28, { content: '区域能耗排行', fontSize: 14, color: '#ffc107', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-erank', 'bar-horizontal', '横向柱图', 1435, 335, 445, 230, {}),

      // 右下：运维工单
      bd('dt-work-b', 'border-9', '运维工单', 970, 590, 440, 230),
      t('dt-work-t', 990, 598, 200, 28, { content: '运维工单统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-work', 'funnel', '漏斗图', 980, 630, 420, 180, {}),

      // 右下：预测维护
      bd('dt-predict-b', 'border-9', '预测维护', 1425, 590, 465, 230),
      t('dt-predict-t', 1445, 598, 200, 28, { content: '设备预测维护', fontSize: 14, color: '#ffc107', fontWeight: 'bold', textAlign: 'left' }),
      ch('dt-predict', 'line-smooth', '折线图', 1435, 630, 445, 180, {}),

      // 右下：实时日志
      bd('dt-log-b', 'border-4', '实时日志', 970, 835, 920, 215),
      t('dt-log-t', 990, 843, 200, 28, { content: '系统实时日志', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('dt-log1', 990, 880, 400, 24, { content: '14:32:15 设备DT-001 数据采集完成', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      t('dt-log2', 990, 910, 400, 24, { content: '14:32:10 告警设备DT-045 已恢复', fontSize: 12, color: '#ffc107', textAlign: 'left' }),
      t('dt-log3', 990, 940, 400, 24, { content: '14:32:05 系统健康检查通过', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      t('dt-log4', 1400, 880, 400, 24, { content: '14:31:58 数据同步完成', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      t('dt-log5', 1400, 910, 400, 24, { content: '14:31:52 网络延迟正常', fontSize: 12, color: '#5eb8ff', textAlign: 'left' }),
      t('dt-log6', 1400, 940, 400, 24, { content: '14:31:45 存储空间充足', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
    ]
  },

  // ==================== 16. 政务服务大屏 ====================
  {
    id: 'government',
    name: '政务服务数据大屏',
    description: '办事大厅+窗口服务+满意度+效能分析',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: 'linear-gradient(135deg, #0a1628 0%, #0d2847 50%, #091c36 100%)',
      layoutMode: 'adaptive'
    },
    components: [
      deco('gv-glow', 'deco-glow', '辉光', 860, -80, 200, 200),
      deco('gv-ct', 'deco-corner', '左上角', 0, 0, 60, 60),
      deco('gv-ctr', 'deco-corner', '右上角', 1860, 0, 60, 60),
      deco('gv-cb', 'deco-corner', '左下角', 0, 1020, 60, 60),
      deco('gv-cbr', 'deco-corner', '右下角', 1860, 1020, 60, 60),

      bd('gv-tb', 'border-11', '标题框', 360, 8, 1200, 56),
      t('gv-title', 380, 14, 1160, 44, { content: '政务服务数据监控平台', fontSize: 30, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 6 }),
      deco('gv-tdl', 'deco-line', '左装饰线', 360, 64, 200, 2),
      deco('gv-tdr', 'deco-line', '右装饰线', 1360, 64, 200, 2),

      bd('gv-time', 'border-7', '时间', 1650, 16, 240, 38),
      t('gv-time-v', 1660, 20, 220, 30, { content: '', fontSize: 14, color: '#5eb8ff' }),

      // 左上：今日办理
      bd('gv-today-b', 'border-9', '今日办理', 30, 80, 280, 180),
      t('gv-today-t', 50, 88, 200, 28, { content: '今日办理概况', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('gv-d1', 50, 125, 120, 40, { value: 1856, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('gv-dl1', 50, 170, 120, 22, { content: '总办件量', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-d2', 180, 125, 120, 40, { value: 1780, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('gv-dl2', 180, 170, 120, 22, { content: '已办结', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-d3', 50, 210, 120, 40, { value: 76, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('gv-dl3', 50, 255, 120, 22, { content: '办理中', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-d4', 180, 210, 120, 40, { value: 95.9, suffix: '%', fontSize: 22, color: '#69f0ae', fontWeight: 'bold' }),
      t('gv-dl4', 180, 255, 120, 22, { content: '办结率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 左中：窗口服务
      bd('gv-window-b', 'border-tech', '窗口服务', 30, 275, 280, 280),
      t('gv-window-t', 50, 283, 200, 28, { content: '窗口服务状态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-window', 'bar-single', '柱状图', 40, 315, 260, 230, {}),

      // 左中下：排队统计
      bd('gv-queue-b', 'border-9', '排队统计', 30, 570, 280, 240),
      t('gv-queue-t', 50, 578, 200, 28, { content: '排队等候统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      num('gv-q1', 50, 615, 120, 40, { value: 32, fontSize: 22, color: '#ffc107', fontWeight: 'bold' }),
      t('gv-ql1', 50, 660, 120, 22, { content: '当前排队', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-q2', 180, 615, 120, 40, { value: 8.5, suffix: 'min', fontSize: 22, color: '#00e5ff', fontWeight: 'bold' }),
      t('gv-ql2', 180, 660, 120, 22, { content: '平均等候', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      ch('gv-queue-gauge', 'gauge', '等候指数', 50, 690, 240, 100, {}),

      // 左下：满意度
      bd('gv-satis-b', 'border-4', '满意度', 30, 825, 280, 225),
      t('gv-satis-t', 50, 833, 200, 28, { content: '服务满意度', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-satis', 'gauge', '满意度', 50, 865, 260, 180, {}),

      // 中央：区域地图
      bd('gv-map-b', 'border-13', '区域地图', 330, 80, 620, 580),
      ch('gv-map', 'map-china', '区域地图', 340, 110, 600, 540, {}),

      // 中下：办件趋势
      bd('gv-trend-b', 'border-tech', '办件趋势', 330, 675, 620, 180),
      t('gv-trend-t', 350, 683, 200, 28, { content: '近7日办件趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-trend', 'area-stack', '面积图', 340, 715, 600, 130, {}),

      // 中下：效能分析
      bd('gv-eff-b', 'border-4', '效能分析', 330, 870, 620, 180),
      t('gv-eff-t', 350, 878, 200, 28, { content: '窗口效能分析', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-eff', 'radar', '雷达图', 340, 905, 600, 140, {}),

      // 右上：业务类型
      bd('gv-biz-b', 'border-9', '业务类型', 970, 80, 210, 200),
      t('gv-biz-t', 985, 88, 180, 28, { content: '业务类型分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('gv-b1', 985, 125, 180, 40, { value: 680, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('gv-bl1', 985, 170, 180, 22, { content: '社保类', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-b2', 985, 200, 180, 40, { value: 520, fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('gv-bl2', 985, 245, 180, 22, { content: '户籍类', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：办理渠道
      bd('gv-channel-b', 'border-9', '办理渠道', 1195, 80, 210, 200),
      t('gv-channel-t', 1210, 88, 180, 28, { content: '办理渠道统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('gv-c1', 1210, 125, 180, 40, { value: 1200, fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }),
      t('gv-cl1', 1210, 170, 180, 22, { content: '窗口办理', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-c2', 1210, 200, 180, 40, { value: 656, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('gv-cl2', 1210, 245, 180, 22, { content: '网上办理', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：好评率
      bd('gv-good-b', 'border-9', '好评率', 1420, 80, 210, 200),
      t('gv-good-t', 1435, 88, 180, 28, { content: '好评率统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      num('gv-g1', 1435, 125, 180, 40, { value: 98.2, suffix: '%', fontSize: 24, color: '#69f0ae', fontWeight: 'bold' }),
      t('gv-gl1', 1435, 170, 180, 22, { content: '好评率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-g2', 1435, 200, 180, 40, { value: 15, fontSize: 24, color: '#ff5252', fontWeight: 'bold' }),
      t('gv-gl2', 1435, 245, 180, 22, { content: '投诉件数', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右上：超时预警
      bd('gv-overtime-b', 'border-9', '超时预警', 1650, 80, 240, 200),
      t('gv-overtime-t', 1665, 88, 210, 28, { content: '超时预警', fontSize: 14, color: '#ff5252', fontWeight: 'bold', textAlign: 'center' }),
      num('gv-o1', 1665, 125, 210, 40, { value: 8, fontSize: 24, color: '#ff5252', fontWeight: 'bold' }),
      t('gv-ol1', 1665, 170, 210, 22, { content: '即将超时', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('gv-o2', 1665, 200, 210, 40, { value: 3, fontSize: 24, color: '#ffc107', fontWeight: 'bold' }),
      t('gv-ol2', 1665, 245, 210, 22, { content: '已超时', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 右中：窗口排名
      bd('gv-rank-b', 'border-tech', '窗口排名', 970, 295, 440, 280),
      t('gv-rank-t', 990, 303, 200, 28, { content: '窗口办理效率排名', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-rank', 'rank-list', '排名', 980, 335, 420, 230, {}),

      // 右中：业务趋势
      bd('gv-biz-trend-b', 'border-tech', '业务趋势', 1425, 295, 465, 280),
      t('gv-biz-trend-t', 1445, 303, 200, 28, { content: '业务办理趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-biz-trend', 'line-smooth', '折线图', 1435, 335, 445, 230, {}),

      // 右下：评价统计
      bd('gv-eval-b', 'border-9', '评价统计', 970, 590, 440, 230),
      t('gv-eval-t', 990, 598, 200, 28, { content: '服务评价统计', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-eval', 'pie-doughnut', '环形图', 980, 630, 420, 180, {}),

      // 右下：投诉分析
      bd('gv-complain-b', 'border-9', '投诉分析', 1425, 590, 465, 230),
      t('gv-complain-t', 1445, 598, 200, 28, { content: '投诉类型分析', fontSize: 14, color: '#ff5252', fontWeight: 'bold', textAlign: 'left' }),
      ch('gv-complain', 'bar-horizontal', '横向柱图', 1435, 630, 445, 180, {}),

      // 右下：通知公告
      bd('gv-notice-b', 'border-4', '通知公告', 970, 835, 920, 215),
      t('gv-notice-t', 990, 843, 200, 28, { content: '政务通知公告', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      t('gv-n1', 990, 880, 400, 24, { content: '📢 关于优化政务服务流程的通知', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),
      t('gv-n2', 990, 910, 400, 24, { content: '📢 春节期间政务服务时间调整', fontSize: 12, color: '#ffc107', textAlign: 'left' }),
      t('gv-n3', 990, 940, 400, 24, { content: '📢 新增网上办事事项公告', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      t('gv-n4', 1400, 880, 400, 24, { content: '📢 政务服务满意度调查', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),
      t('gv-n5', 1400, 910, 400, 24, { content: '📢 窗口人员培训通知', fontSize: 12, color: '#5eb8ff', textAlign: 'left' }),
      t('gv-n6', 1400, 940, 400, 24, { content: '📢 便民服务升级公告', fontSize: 12, color: '#e0f4ff', textAlign: 'left' }),
    ]
  },

  // ==================== DataV施工养护综合数据 (忠实还原) ====================
  {
    id: 'datav-construction',
    name: '施工养护综合数据',
    description: 'DataV风格 | 数字翻牌+排行+玫瑰图+水位图+滚动表 | 施工养护',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: '#030409',
      layoutMode: 'adaptive'
    },
    components: [
      // ========== 背景与装饰 ==========

      // ========== 顶部标题区域 (0-80px) ==========
      bd('dc-tb', 'border-11', '标题框', 300, 8, 1320, 64),
      deco('dc-tb-deco-l', 'deco-5', '标题左侧装饰', 310, 12, 60, 56),
      deco('dc-tb-deco-r', 'deco-5', '标题右侧装饰', 1550, 12, 60, 56),
      t('dc-title', 380, 16, 1160, 48, { content: '施工养护综合数据', fontSize: 32, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 8 }),
      deco('dc-tb-line-l', 'deco-1', '标题下线左', 300, 72, 660, 2),
      deco('dc-tb-line-r', 'deco-1', '标题下线右', 960, 72, 660, 2),

      // ========== 左栏: 4个数字翻牌统计卡 (0-400px, 80-1080px) ==========
      // 左上大卡1
      bd('dc-df1-b', 'border-1', '数字卡1', 20, 85, 370, 235),
      t('dc-df1-label', 40, 95, 330, 28, { content: '工程总量', fontSize: 14, color: '#5eb8ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dc-df1-dl', 'deco-5', '标签装饰1', 120, 99, 30, 20),
      num('dc-df1-val', 40, 130, 330, 70, { value: 1234567, fontSize: 42, color: '#00d4ff', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-df1-unit', 40, 210, 330, 24, { content: '单位：项', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      t('dc-df1-change', 40, 240, 330, 22, { content: '较上月 +12.3%', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      ch('dc-df1-spark', 'line-smooth', '迷你折线', 200, 230, 170, 80, {}),

      // 左上大卡2
      bd('dc-df2-b', 'border-1', '数字卡2', 20, 335, 370, 235),
      t('dc-df2-label', 40, 345, 330, 28, { content: '完成率', fontSize: 14, color: '#5eb8ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dc-df2-dl', 'deco-5', '标签装饰2', 90, 349, 30, 20),
      num('dc-df2-val', 40, 380, 330, 70, { value: 89.2, suffix: '%', fontSize: 42, color: '#00d4ff', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-df2-unit', 40, 460, 330, 24, { content: '目标：95%', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      t('dc-df2-change', 40, 490, 330, 22, { content: '较上月 +5.8%', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      ch('dc-df2-spark', 'line-smooth', '迷你折线', 200, 480, 170, 80, {}),

      // 左下大卡3
      bd('dc-df3-b', 'border-1', '数字卡3', 20, 585, 370, 235),
      t('dc-df3-label', 40, 595, 330, 28, { content: '投资额', fontSize: 14, color: '#5eb8ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dc-df3-dl', 'deco-5', '标签装饰3', 90, 599, 30, 20),
      num('dc-df3-val', 40, 630, 330, 70, { value: 567890, suffix: '万', fontSize: 42, color: '#00d4ff', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-df3-unit', 40, 710, 330, 24, { content: '本年度累计', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      t('dc-df3-change', 40, 740, 330, 22, { content: '较上月 +8.1%', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),
      ch('dc-df3-spark', 'line-smooth', '迷你折线', 200, 730, 170, 80, {}),

      // 左下大卡4
      bd('dc-df4-b', 'border-1', '数字卡4', 20, 835, 370, 215),
      t('dc-df4-label', 40, 845, 330, 28, { content: '施工人员', fontSize: 14, color: '#5eb8ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dc-df4-dl', 'deco-5', '标签装饰4', 120, 849, 30, 20),
      num('dc-df4-val', 40, 880, 330, 70, { value: 12345, fontSize: 42, color: '#00d4ff', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-df4-unit', 40, 960, 330, 24, { content: '在岗人数', fontSize: 12, color: '#5a8aaa', textAlign: 'left' }),
      t('dc-df4-change', 40, 990, 330, 22, { content: '较昨日 +156人', fontSize: 12, color: '#69f0ae', textAlign: 'left' }),

      // ========== 中栏: 排行榜 (400-1000px, 80-1080px) ==========
      bd('dc-rank-b', 'border-10', '排行榜', 400, 85, 600, 965),
      t('dc-rank-title', 420, 95, 200, 28, { content: '工程进度排行', fontSize: 16, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dc-rank-dl', 'deco-5', '排行标题装饰', 540, 99, 30, 20),
      deco('dc-rank-sep', 'deco-1', '分隔线', 420, 130, 560, 2),
      ch('dc-rank-list', 'rank-list', '排名列表', 410, 140, 580, 900, {}),

      // ========== 右上: 3个图表并排 (1000-1920px, 80-500px) ==========
      // 玫瑰图 (1000-1300)
      bd('dc-rose-b', 'border-1', '玫瑰图', 1010, 85, 290, 410),
      t('dc-rose-t', 1020, 95, 270, 28, { content: '工程类型分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      deco('dc-rose-dl', 'deco-5', '玫瑰图装饰', 1020, 99, 20, 20),
      ch('dc-rose-c', 'pie-rose', '玫瑰图', 1020, 130, 270, 355, {}),

      // 水位图 (1310-1600)
      bd('dc-water-b', 'border-1', '水位图', 1310, 85, 290, 410),
      t('dc-water-t', 1320, 95, 270, 28, { content: '水位监测', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      deco('dc-water-dl', 'deco-5', '水位装饰', 1320, 99, 20, 20),
      ch('dc-water-c', 'water-ball', '水位图', 1320, 130, 270, 355, {}),

      // 滚动表格 (1610-1910)
      bd('dc-scroll-b', 'border-1', '滚动表', 1610, 85, 290, 410),
      t('dc-scroll-t', 1620, 95, 270, 28, { content: '施工动态', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'center' }),
      deco('dc-scroll-dl', 'deco-5', '滚动表装饰', 1620, 99, 20, 20),
      ch('dc-scroll-c', 'carousel-list', '滚动列表', 1620, 130, 270, 355, {}),

      // ========== 右下: 4个带图标的统计卡 (1000-1920px, 500-1080px) ==========
      // 卡片1
      bd('dc-card1-b', 'border-1', '统计卡1', 1010, 510, 220, 265),
      t('dc-card1-icon', 1085, 525, 70, 50, { content: '📋', fontSize: 32, color: '#00d4ff', textAlign: 'center' }),
      num('dc-card1-val', 1020, 580, 200, 50, { value: 356, fontSize: 30, color: '#00d4ff', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-card1-label', 1020, 640, 200, 24, { content: '在建工程', fontSize: 13, color: '#5eb8ff', textAlign: 'center' }),
      t('dc-card1-sub', 1020, 670, 200, 22, { content: '较上月 +23', fontSize: 11, color: '#69f0ae', textAlign: 'center' }),

      // 卡片2
      bd('dc-card2-b', 'border-1', '统计卡2', 1240, 510, 220, 265),
      t('dc-card2-icon', 1315, 525, 70, 50, { content: '✅', fontSize: 32, color: '#69f0ae', textAlign: 'center' }),
      num('dc-card2-val', 1250, 580, 200, 50, { value: 128, fontSize: 30, color: '#69f0ae', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-card2-label', 1250, 640, 200, 24, { content: '已完工', fontSize: 13, color: '#5eb8ff', textAlign: 'center' }),
      t('dc-card2-sub', 1250, 670, 200, 22, { content: '完成率 89.2%', fontSize: 11, color: '#69f0ae', textAlign: 'center' }),

      // 卡片3
      bd('dc-card3-b', 'border-1', '统计卡3', 1470, 510, 220, 265),
      t('dc-card3-icon', 1545, 525, 70, 50, { content: '⚠️', fontSize: 32, color: '#ffc107', textAlign: 'center' }),
      num('dc-card3-val', 1480, 580, 200, 50, { value: 45, fontSize: 30, color: '#ffc107', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-card3-label', 1480, 640, 200, 24, { content: '待验收', fontSize: 13, color: '#5eb8ff', textAlign: 'center' }),
      t('dc-card3-sub', 1480, 670, 200, 22, { content: '较上月 -8', fontSize: 11, color: '#69f0ae', textAlign: 'center' }),

      // 卡片4
      bd('dc-card4-b', 'border-1', '统计卡4', 1700, 510, 200, 265),
      t('dc-card4-icon', 1770, 525, 70, 50, { content: '🚨', fontSize: 32, color: '#ff5252', textAlign: 'center' }),
      num('dc-card4-val', 1710, 580, 180, 50, { value: 12, fontSize: 30, color: '#ff5252', fontWeight: 'bold', fontFamily: 'DIN Alternate' }),
      t('dc-card4-label', 1710, 640, 180, 24, { content: '质量预警', fontSize: 13, color: '#5eb8ff', textAlign: 'center' }),
      t('dc-card4-sub', 1710, 670, 180, 22, { content: '较上月 -3', fontSize: 11, color: '#69f0ae', textAlign: 'center' }),

      // 右下底部：投资进度条
      bd('dc-inv-b', 'border-1', '投资进度', 1010, 790, 890, 260),
      t('dc-inv-t', 1030, 800, 200, 28, { content: '投资进度', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dc-inv-dl', 'deco-5', '投资装饰', 1110, 804, 20, 20),
      t('dc-inv-l1', 1030, 840, 200, 24, { content: '路基工程', fontSize: 13, color: '#8cc8ff', textAlign: 'left' }),
      ch('dc-inv-p1', 'progress', '进度条', 1250, 843, 620, 18, {}),
      t('dc-inv-l2', 1030, 875, 200, 24, { content: '桥梁工程', fontSize: 13, color: '#8cc8ff', textAlign: 'left' }),
      ch('dc-inv-p2', 'progress', '进度条', 1250, 878, 620, 18, {}),
      t('dc-inv-l3', 1030, 910, 200, 24, { content: '隧道工程', fontSize: 13, color: '#8cc8ff', textAlign: 'left' }),
      ch('dc-inv-p3', 'progress', '进度条', 1250, 913, 620, 18, {}),
      t('dc-inv-l4', 1030, 945, 200, 24, { content: '交安工程', fontSize: 13, color: '#8cc8ff', textAlign: 'left' }),
      ch('dc-inv-p4', 'progress', '进度条', 1250, 948, 620, 18, {}),
      t('dc-inv-l5', 1030, 980, 200, 24, { content: '绿化工程', fontSize: 13, color: '#8cc8ff', textAlign: 'left' }),
      ch('dc-inv-p5', 'progress', '进度条', 1250, 983, 620, 18, {}),

      deco('dc-bottom', 'deco-line', '底线', 20, 1065, 1880, 2),
    ]
  },

  // ==================== DataV机电运维管理台 (忠实还原) ====================
  {
    id: 'datav-manage-desk',
    name: '机电运维管理台',
    description: 'DataV风格 | 设备状态+工单管理+系统负载 | 运维管理',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: '#030409',
      layoutMode: 'adaptive'
    },
    components: [
      // ========== 背景与装饰 ==========

      // ========== 顶部标题区域 ==========
      bd('dm-tb', 'border-11', '标题框', 300, 8, 1320, 64),
      deco('dm-tb-deco-l', 'deco-5', '标题左侧装饰', 310, 12, 60, 56),
      deco('dm-tb-deco-r', 'deco-5', '标题右侧装饰', 1550, 12, 60, 56),
      t('dm-title', 380, 16, 1160, 48, { content: '机电运维管理台', fontSize: 32, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 8 }),
      deco('dm-tb-line-l', 'deco-1', '标题下线左', 300, 72, 660, 2),
      deco('dm-tb-line-r', 'deco-1', '标题下线右', 960, 72, 660, 2),

      // ========== 左栏: 设备状态面板 (0-400px) ==========
      // 设备在线率
      bd('dm-online-b', 'border-1', '在线率', 20, 85, 370, 220),
      t('dm-online-t', 40, 95, 330, 28, { content: '设备在线率', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-online-dl', 'deco-5', '装饰', 140, 99, 20, 20),
      ch('dm-online-c', 'gauge', '仪表盘', 40, 130, 180, 160, {}),
      num('dm-online-v', 230, 160, 140, 50, { value: 98.5, suffix: '%', fontSize: 32, color: '#69f0ae', fontWeight: 'bold' }),
      t('dm-online-l', 230, 215, 140, 24, { content: '在线设备', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 设备状态分布
      bd('dm-status-b', 'border-1', '状态分布', 20, 320, 370, 230),
      t('dm-status-t', 40, 330, 330, 28, { content: '设备状态分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-status-dl', 'deco-5', '装饰', 160, 334, 20, 20),
      ch('dm-status-c', 'pie-doughnut', '环形图', 30, 365, 350, 175, {}),

      // 故障类型分布
      bd('dm-fault-b', 'border-1', '故障类型', 20, 565, 370, 230),
      t('dm-fault-t', 40, 575, 330, 28, { content: '故障类型分布', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-fault-dl', 'deco-5', '装饰', 160, 579, 20, 20),
      ch('dm-fault-c', 'bar-single', '柱状图', 30, 610, 350, 175, {}),

      // 巡检完成率
      bd('dm-inspect-b', 'border-1', '巡检完成率', 20, 810, 370, 240),
      t('dm-inspect-t', 40, 820, 330, 28, { content: '巡检完成率', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-inspect-dl', 'deco-5', '装饰', 140, 824, 20, 20),
      t('dm-insp-l1', 40, 860, 200, 24, { content: '电梯系统', fontSize: 12, color: '#8cc8ff', textAlign: 'left' }),
      ch('dm-insp-p1', 'progress', '进度条', 180, 863, 190, 16, {}),
      t('dm-insp-l2', 40, 890, 200, 24, { content: '空调系统', fontSize: 12, color: '#8cc8ff', textAlign: 'left' }),
      ch('dm-insp-p2', 'progress', '进度条', 180, 893, 190, 16, {}),
      t('dm-insp-l3', 40, 920, 200, 24, { content: '给排水', fontSize: 12, color: '#8cc8ff', textAlign: 'left' }),
      ch('dm-insp-p3', 'progress', '进度条', 180, 923, 190, 16, {}),
      t('dm-insp-l4', 40, 950, 200, 24, { content: '消防系统', fontSize: 12, color: '#8cc8ff', textAlign: 'left' }),
      ch('dm-insp-p4', 'progress', '进度条', 180, 953, 190, 16, {}),
      t('dm-insp-l5', 40, 980, 200, 24, { content: '配电系统', fontSize: 12, color: '#8cc8ff', textAlign: 'left' }),
      ch('dm-insp-p5', 'progress', '进度条', 180, 983, 190, 16, {}),

      // ========== 中栏: 工单管理 (400-1000px) ==========
      // 工单统计
      bd('dm-order-b', 'border-10', '工单统计', 400, 85, 600, 200),
      t('dm-order-t', 420, 95, 200, 28, { content: '工单统计', fontSize: 16, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-order-dl', 'deco-5', '装饰', 510, 99, 20, 20),

      bd('dm-o1', 'border-5', '工单1', 420, 130, 130, 130),
      num('dm-o1v', 430, 145, 110, 40, { value: 256, fontSize: 28, color: '#00e5ff', fontWeight: 'bold' }),
      t('dm-o1l', 430, 190, 110, 22, { content: '今日工单', fontSize: 11, color: '#5a8aaa', textAlign: 'center' }),

      bd('dm-o2', 'border-5', '工单2', 565, 130, 130, 130),
      num('dm-o2v', 575, 145, 110, 40, { value: 18, fontSize: 28, color: '#ff5252', fontWeight: 'bold' }),
      t('dm-o2l', 575, 190, 110, 22, { content: '紧急工单', fontSize: 11, color: '#5a8aaa', textAlign: 'center' }),

      bd('dm-o3', 'border-5', '工单3', 710, 130, 130, 130),
      num('dm-o3v', 720, 145, 110, 40, { value: 89, fontSize: 28, color: '#ffc107', fontWeight: 'bold' }),
      t('dm-o3l', 720, 190, 110, 22, { content: '处理中', fontSize: 11, color: '#5a8aaa', textAlign: 'center' }),

      bd('dm-o4', 'border-5', '工单4', 855, 130, 130, 130),
      num('dm-o4v', 865, 145, 110, 40, { value: 149, fontSize: 28, color: '#69f0ae', fontWeight: 'bold' }),
      t('dm-o4l', 865, 190, 110, 22, { content: '已完结', fontSize: 11, color: '#5a8aaa', textAlign: 'center' }),

      // 工单趋势
      bd('dm-trend-b', 'border-1', '工单趋势', 400, 300, 600, 340),
      t('dm-trend-t', 420, 310, 200, 28, { content: '工单趋势', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-trend-dl', 'deco-5', '装饰', 510, 314, 20, 20),
      ch('dm-trend-c', 'line-smooth', '折线图', 410, 345, 580, 285, {}),

      // 工单排行
      bd('dm-rank-b', 'border-1', '工单排行', 400, 655, 600, 395),
      t('dm-rank-t', 420, 665, 200, 28, { content: '部门工单排行', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-rank-dl', 'deco-5', '装饰', 560, 669, 20, 20),
      ch('dm-rank-c', 'rank-list', '排名列表', 410, 700, 580, 340, {}),

      // ========== 右栏: 系统监控 (1000-1920px) ==========
      // 系统负载4卡片
      bd('dm-sys-b', 'border-10', '系统负载', 1010, 85, 890, 200),
      t('dm-sys-t', 1030, 95, 200, 28, { content: '系统负载', fontSize: 16, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-sys-dl', 'deco-5', '装饰', 1110, 99, 20, 20),

      bd('dm-s1', 'border-5', 'CPU', 1030, 130, 200, 130),
      ch('dm-s1g', 'gauge', 'CPU', 1040, 140, 80, 80, {}),
      num('dm-s1v', 1130, 155, 80, 30, { value: 68, suffix: '%', fontSize: 20, color: '#00e5ff', fontWeight: 'bold' }),
      t('dm-s1l', 1030, 230, 200, 22, { content: 'CPU使用率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      bd('dm-s2', 'border-5', '内存', 1250, 130, 200, 130),
      ch('dm-s2g', 'gauge', '内存', 1260, 140, 80, 80, {}),
      num('dm-s2v', 1350, 155, 80, 30, { value: 72, suffix: '%', fontSize: 20, color: '#ffc107', fontWeight: 'bold' }),
      t('dm-s2l', 1250, 230, 200, 22, { content: '内存使用率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      bd('dm-s3', 'border-5', '磁盘', 1470, 130, 200, 130),
      ch('dm-s3g', 'gauge', '磁盘', 1480, 140, 80, 80, {}),
      num('dm-s3v', 1570, 155, 80, 30, { value: 56, suffix: '%', fontSize: 20, color: '#69f0ae', fontWeight: 'bold' }),
      t('dm-s3l', 1470, 230, 200, 22, { content: '磁盘使用率', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      bd('dm-s4', 'border-5', '网络', 1690, 130, 200, 130),
      ch('dm-s4g', 'gauge', '网络', 1700, 140, 80, 80, {}),
      num('dm-s4v', 1790, 155, 80, 30, { value: 45, suffix: '%', fontSize: 20, color: '#00e5ff', fontWeight: 'bold' }),
      t('dm-s4l', 1690, 230, 200, 22, { content: '网络负载', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 告警列表
      bd('dm-alert-b', 'border-1', '告警列表', 1010, 300, 890, 340),
      t('dm-alert-t', 1030, 310, 200, 28, { content: '实时告警', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-alert-dl', 'deco-5', '装饰', 1120, 314, 20, 20),
      ch('dm-alert-c', 'carousel-list', '告警列表', 1020, 345, 870, 285, {}),

      // 故障处理效率
      bd('dm-eff-b', 'border-1', '处理效率', 1010, 655, 440, 395),
      t('dm-eff-t', 1030, 665, 200, 28, { content: '故障处理效率', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-eff-dl', 'deco-5', '装饰', 1170, 669, 20, 20),
      ch('dm-eff-c', 'funnel', '漏斗图', 1020, 700, 420, 340, {}),

      // 设备维护日历
      bd('dm-cal-b', 'border-1', '维护日历', 1460, 655, 440, 395),
      t('dm-cal-t', 1480, 665, 200, 28, { content: '维护日历', fontSize: 14, color: '#00d4ff', fontWeight: 'bold', textAlign: 'left' }),
      deco('dm-cal-dl', 'deco-5', '装饰', 1580, 669, 20, 20),
      ch('dm-cal-c', 'calendar', '日历图', 1470, 700, 420, 340, {}),

      deco('dm-bottom', 'deco-line', '底线', 20, 1065, 1880, 2),
    ]
  },

  // ==================== DataV机电设备电子档案 (忠实还原) ====================
  {
    id: 'datav-electronic-file',
    name: '机电设备电子档案',
    description: 'DataV风格 | 设备列表+类型分布+状态监测 | 电子档案',
    thumbnail: '',
    config: {
      width: 1920,
      height: 1080,
      background: '#030409',
      layoutMode: 'adaptive'
    },
    components: [
      // ========== 背景与装饰 ==========

      // ========== 顶部标题区域 ==========
      bd('de-tb', 'border-11', '标题框', 300, 8, 1320, 64),
      deco('de-tb-deco-l', 'deco-5', '标题左侧装饰', 310, 12, 60, 56),
      deco('de-tb-deco-r', 'deco-5', '标题右侧装饰', 1550, 12, 60, 56),
      t('de-title', 380, 16, 1160, 48, { content: '机电设备电子档案', fontSize: 32, color: '#e0f4ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: 8 }),
      deco('de-tb-line-l', 'deco-1', '标题下线左', 300, 72, 660, 2),
      deco('de-tb-line-r', 'deco-1', '标题下线右', 960, 72, 660, 2),

      // ========== 左栏: 设备类型分布 (0-400px) ==========
      // 设备类型环形图
      bd('de-type-b', 'border-1', '设备类型', 20, 85, 370, 280),
      t('de-type-t', 40, 95, 330, 28, { content: '设备类型分布', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-type-dl', 'deco-5', '装饰', 150, 99, 20, 20),
      ch('de-type-c', 'pie-doughnut', '环形图', 30, 130, 350, 225, {}),

      // 设备总数统计
      bd('de-total-b', 'border-1', '设备总数', 20, 380, 370, 180),
      t('de-total-t', 40, 390, 330, 28, { content: '设备总数', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-total-dl', 'deco-5', '装饰', 120, 394, 20, 20),
      num('de-total-v', 40, 425, 170, 50, { value: 2856, fontSize: 36, color: '#00e5ff', fontWeight: 'bold' }),
      t('de-total-l', 40, 480, 170, 22, { content: '总设备数', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),
      num('de-total-add', 220, 425, 150, 50, { value: 128, fontSize: 30, color: '#69f0ae', fontWeight: 'bold' }),
      t('de-total-addl', 220, 480, 150, 22, { content: '本月新增', fontSize: 12, color: '#5a8aaa', textAlign: 'center' }),

      // 设备状态柱状图
      bd('de-state-b', 'border-1', '状态分布', 20, 575, 370, 230),
      t('de-state-t', 40, 585, 330, 28, { content: '设备状态分布', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-state-dl', 'deco-5', '装饰', 160, 589, 20, 20),
      ch('de-state-c', 'bar-single', '柱状图', 30, 620, 350, 175, {}),

      // 使用年限分布
      bd('de-age-b', 'border-1', '使用年限', 20, 820, 370, 230),
      t('de-age-t', 40, 830, 330, 28, { content: '使用年限分布', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-age-dl', 'deco-5', '装饰', 160, 834, 20, 20),
      ch('de-age-c', 'bar-single', '柱状图', 30, 865, 350, 175, {}),

      // ========== 中栏: 设备列表 (400-1000px) ==========
      // 设备列表表格
      bd('de-list-b', 'border-10', '设备列表', 400, 85, 600, 620),
      t('de-list-t', 420, 95, 200, 28, { content: '设备档案列表', fontSize: 16, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-list-dl', 'deco-5', '装饰', 560, 99, 20, 20),
      ch('de-list-c', 'table-normal', '设备表格', 410, 130, 580, 565, {}),

      // 设备搜索统计
      bd('de-search-b', 'border-1', '搜索统计', 400, 720, 600, 330),
      t('de-search-t', 420, 730, 200, 28, { content: '设备搜索热度', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-search-dl', 'deco-5', '装饰', 570, 734, 20, 20),
      ch('de-search-c', 'bar-horizontal', '横向柱图', 410, 765, 580, 275, {}),

      // ========== 右栏: 状态监测 (1000-1920px) ==========
      // 设备状态监测雷达
      bd('de-radar-b', 'border-1', '状态监测', 1010, 85, 440, 350),
      t('de-radar-t', 1030, 95, 200, 28, { content: '设备状态监测', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-radar-dl', 'deco-5', '装饰', 1180, 99, 20, 20),
      ch('de-radar-c', 'radar', '雷达图', 1020, 130, 420, 295, {}),

      // 综合评分仪表盘
      bd('de-score-b', 'border-1', '综合评分', 1460, 85, 440, 350),
      t('de-score-t', 1480, 95, 200, 28, { content: '综合健康评分', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-score-dl', 'deco-5', '装饰', 1620, 99, 20, 20),
      ch('de-score-c', 'gauge-multi', '多仪表盘', 1470, 130, 420, 295, {}),

      // 故障趋势
      bd('de-trend-b', 'border-1', '故障趋势', 1010, 450, 440, 300),
      t('de-trend-t', 1030, 460, 200, 28, { content: '故障趋势', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-trend-dl', 'deco-5', '装饰', 1130, 464, 20, 20),
      ch('de-trend-c', 'line-smooth', '折线图', 1020, 495, 420, 245, {}),

      // 维修记录
      bd('de-repair-b', 'border-1', '维修记录', 1460, 450, 440, 300),
      t('de-repair-t', 1480, 460, 200, 28, { content: '维修记录', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-repair-dl', 'deco-5', '装饰', 1590, 464, 20, 20),
      ch('de-repair-c', 'rank-list', '排名列表', 1470, 495, 420, 245, {}),

      // 巡检完成率
      bd('de-insp-b', 'border-1', '巡检完成率', 1010, 765, 890, 285),
      t('de-insp-t', 1030, 775, 200, 28, { content: '巡检完成率', fontSize: 14, color: '#26c6da', fontWeight: 'bold', textAlign: 'left' }),
      deco('de-insp-dl', 'deco-5', '装饰', 1160, 779, 20, 20),
      t('de-insp-l1', 1030, 815, 180, 24, { content: '电梯系统', fontSize: 12, color: '#80cccc', textAlign: 'left' }),
      ch('de-insp-p1', 'progress', '进度条', 1220, 818, 650, 16, {}),
      t('de-insp-l2', 1030, 848, 180, 24, { content: '空调系统', fontSize: 12, color: '#80cccc', textAlign: 'left' }),
      ch('de-insp-p2', 'progress', '进度条', 1220, 851, 650, 16, {}),
      t('de-insp-l3', 1030, 881, 180, 24, { content: '给排水', fontSize: 12, color: '#80cccc', textAlign: 'left' }),
      ch('de-insp-p3', 'progress', '进度条', 1220, 884, 650, 16, {}),
      t('de-insp-l4', 1030, 914, 180, 24, { content: '消防系统', fontSize: 12, color: '#80cccc', textAlign: 'left' }),
      ch('de-insp-p4', 'progress', '进度条', 1220, 917, 650, 16, {}),
      t('de-insp-l5', 1030, 947, 180, 24, { content: '配电系统', fontSize: 12, color: '#80cccc', textAlign: 'left' }),
      ch('de-insp-p5', 'progress', '进度条', 1220, 950, 650, 16, {}),
      t('de-insp-l6', 1030, 980, 180, 24, { content: '弱电网络', fontSize: 12, color: '#80cccc', textAlign: 'left' }),
      ch('de-insp-p6', 'progress', '进度条', 1220, 983, 650, 16, {}),

      deco('de-bottom', 'deco-line', '底线', 20, 1065, 1880, 2),
    ]
  }
]

export const getTemplate = (id: string): Template | undefined => {
  return presetTemplates.find(t => t.id === id)
}
