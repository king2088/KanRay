// 中文残留校验。
// 1) i18n 内核文件（flatten/locale-util/index）不得含中文文案
// 2) en-US 词典不得含中文
// 3) SCAN_PATHS 由各国际化计划逐步追加已迁移完成的源文件
// 例外：constants.js 的 LOCALE_OPTIONS 用语言母语名（'中文' / 'English'），
//       刻意保留中文，因此不纳入 SCAN_PATHS，改为单独断言其完整性。
// 行级豁免：仅用于「后端下发的枚举值原样比较」这类**不可翻译**的字面量。
//       每条豁免必须写明原因，且代码若已改动（豁免失配）会直接失败，
//       避免留下永不生效的僵尸配置。展示文案一律不允许豁免。
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { LOCALE_OPTIONS, SUPPORT_LOCALES } from '../src/i18n/constants.js'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const CJK = /[一-鿿]/

// 追加式清单：计划 2 起把已迁移的目录加进来
const SCAN_PATHS = [
  'i18n/flatten.js',
  'i18n/locale-util.js',
  'i18n/index.js',
  'i18n/translate.js',
  'components/layout',
  'router/menu.js',
  'views/Login.vue',
  'views/Register.vue',
  // 计划 3：图表与看板域
  'config/chart-configs.js',
  'config/chart-types.js',
  'config/color-palettes.js',
  'utils/chart-utils.js',
  'utils/catalog.js',
  'utils/field-type-label.js',
  'components/charts',
  'components/dashboard',
  'views/ChartList.vue',
  'views/ChartBuilder.vue',
  'views/DashboardList.vue',
  'views/DashboardEditor.vue',
  'views/DashboardView.vue',
  'views/ShareBoardView.vue',
  // 计划 4：数据源 / 数据集 / 三种构建器
  'utils/dataset-type.js',
  'utils/etl-nodes.js',
  'views/DataSourceList.vue',
  'views/DataSourceFormDialog.vue',
  'views/DataSourceUploadDialog.vue',
  'views/DataSourceDetail.vue',
  'views/DatasetList.vue',
  'views/DatasetDetail.vue',
  'views/DataSourceBuilder.vue',
  'components/builder',
  // 计划 5：表单域与管理后台
  'views/forms',
  'views/admin',
  'views/open',
  'components/form',
  'utils/form-meta.js',
  // 计划 6：大屏设计器内核（RightPanel 属计划 7、widgets 属计划 8，尚未迁移故不在此列）
  'views/BigScreenList.vue',
  'screen-designer/views',
  'screen-designer/stores/canvas.ts',
  'screen-designer/utils/storage.ts',
  'screen-designer/core/components/registry.ts',
  'screen-designer/core/templates/thumbnail.ts',
  'screen-designer/core/templates/preset.ts',
  'screen-designer/core/components/defaultData.ts',
  'screen-designer/components/Canvas',
  'screen-designer/components/TopToolbar',
  'screen-designer/components/StatusBar',
  'screen-designer/components/LeftPanel',
  'screen-designer/components/CodeEditor',
  'screen-designer/components/ScreenIcon.vue',
  // 计划 7：右侧配置面板（RightPanel + DatasetQueryDialog + 18 个 configs 专属配置组件）
  'screen-designer/components/RightPanel',
  // 计划 8：大屏 widget（33 个图表 + 9 个非图表组件）
  'screen-designer/widgets',
  // api 目录：3 个公开分享模块各自 axios.create()，不经过 http.js 拦截器，
  // 曾在里面硬编码 '请求失败' / '网络错误' 作兜底——英文界面直接弹中文。
  'api',
]

// 行级豁免清单：file + 代码片段 + 原因
const CJK_EXEMPTIONS = [
  {
    file: 'views/DataSourceFormDialog.vue',
    match: "category === '文件'",
    reason:
      "后端 datasources 驱动的 category 枚举值为中文「文件」，此处是与后端返回值的枚举比较而非展示文案；" +
      '计划 9 统一后端枚举后删除本条豁免。',
  },
  {
    file: 'views/forms/FormDesigner.vue',
    match: "const KEY_SEED = '字段'",
    reason:
      'KEY_SEED 是生成表单字段入库列名的种子，keyFor 会剥掉非 ASCII 字符后稳定回退为 field_*；' +
      '它必须与界面语言无关，否则切换语言会改变已落库到后端的列名，属于不可翻译的字面量。',
  },
  {
    file: 'screen-designer/core/templates/preset.ts',
    fileScoped: true,
    reason:
      '整文件是 19 个预置大屏模板的数据定义（画布尺寸、组件清单与组件内的文案/指标/图例），' +
      '不含任何界面框架文案；这些内容会随模板复制进用户画布并由用户自行编辑，属于用户数据，' +
      '若随界面语言切换，用户保存的模板会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/core/components/defaultData.ts',
    fileScoped: true,
    reason:
      '整文件是预置的新画布种子图表数据（系列名、类目名、数值），不含界面框架文案；' +
      '落库后即用户数据，与 preset.ts 同理不随界面语言切换。',
  },
  {
    file: 'screen-designer/components/RightPanel/RightPanel.vue',
    match: [
      "'默认'", "'自定义'", "'科技蓝'", "'自然绿'", "'暖阳橙'", "'星空紫'",
      "'海洋蓝'", "'大地棕'", "'糖果粉'", "'暗夜灰'", "'彩虹'", "'莫兰迪'",
    ],
    reason:
      '图表主题名是落库的中文枚举值：applyTheme 把它写进 component.props.theme，' +
      '存量存量大屏都是这批中文值。界面显示走同条记录的 nameKey，' +
      '因此切换界面语言不会让已保存的大屏失效；' +
      '若把 name 直接改成英文，旧大屏的主题名就匹配不到色板。',
  },
  {
    file: 'screen-designer/components/RightPanel/RightPanel.vue',
    match: ['总销售额'],
    reason:
      '这是「静态数据」提示里的 JSON 演示样本，用于展示用户自己的数据长什么样' +
      '（value / label 两个字段），属演示数据而非界面文案。',
  },
  {
    file: 'screen-designer/components/CodeEditor/CodeEditDialog.vue',
    match: [
      '双击', '请在右侧', '今日访问', '活跃用户', '实时销量排行', '系统监控', '运行稳定性',
      '星期日', "getFullYear() + '年'", '磁盘使用率', '系统状态', '搜索引擎', '直接访问', '邮件营销', '联盟广告',
      'data 来自右侧面板', 'HTML编辑器', '运行中', 'CSS编辑器', 'JS编辑器留空', '1月',
    ],
    reason:
      '这些行是「自定义组件代码模板」与帮助文档里的示例代码内容（示例图表的类目/系列名、' +
      '示例 DOM 文案、示例注释），属演示数据：用户把模板插入画布后即可任意改写，' +
      '译文写进代码字符串反而会与用户数据混杂；帮助文档的说明文字已单独译出。',
  },
  // 计划 8：widgets 目录的默认演示数据。界面文案已全部移入词典，
  // 剩下的中文只出现在「用户还没配数据时展示的示例值」里，逐文件登记以防漏网。
  {
    file: 'screen-designer/widgets/charts/BarChart.vue',
    match: ['系列一', '系列三', '系列二'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/BarLineMixChart.vue',
    match: ['折线', '柱形'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/BarStackedChart.vue',
    match: ['周一', '周三', '周二', '搜索引擎', '直接', '联盟', '视频', '邮件'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/BoxplotChart.vue',
    match: ['周一', '周三', '周二', '周五', '周四'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/BubbleMap.vue',
    match: ['上海', '乌鲁木齐', '兰州', '北京', '南京', '南宁', '南昌', '厦门', '台北', '合肥', '呼和浩特', '哈尔滨', '大连', '天津', '太原', '广州', '成都', '拉萨', '昆明', '杭州', '武汉', '沈阳', '济南', '海口', '深圳', '澳门', '石家庄', '福州', '苏州', '西宁', '西安', '贵阳', '郑州', '重庆', '银川', '长春', '长沙', '青岛', '香港'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/CandlestickChart.vue',
    match: ['周一', '周三', '周二', '周五', '周四'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/CarouselListChart.vue',
    match: ['东北区域', '华东区域', '华中区域', '华北区域', '华南区域', '海外区域', '西北区域', '西南区域'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/ChinaMap.vue',
    match: ['上海', '北京', '四川', '山东', '广东', '江苏', '河南', '浙江'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/DynamicBarRaceChart.vue',
    match: ['云南', '内蒙古', '四川', '广西', '新疆', '湖南', '甘肃', '西藏', '青海', '黑龙江'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/FunnelChart.vue',
    match: ['咨询', '展示', '点击', '订单', '访问'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/FunnelHorizontalChart.vue',
    match: ['咨询', '展现', '点击', '订单', '访问'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/GaugeChart.vue',
    match: ['指标'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/GeographicMapChart.vue',
    match: ['上海', '北京', '南京', '广州', '成都', '杭州', '武汉', '深圳', '西安', '重庆'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/HeatmapChart.vue',
    match: ['周一', '周三', '周二', '周五', '周六', '周四', '周日'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/HorizontalBarChart.vue',
    match: ['折线', '柱形', '系列一'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/HorizontalBarGroupChart.vue',
    match: ['系列一', '系列二'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/HorizontalBarStackChart.vue',
    match: ['周一', '周三', '周二', '搜索引擎', '直接', '联盟', '视频', '邮件'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/LineChart.vue',
    match: ['系列一', '系列三', '系列二'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/LineStepChart.vue',
    match: ['周一', '周三', '周二', '周五', '周六', '周四', '周日', '系列一', '系列二'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/PercentAreaChart.vue',
    match: ['周一', '周三', '周二', '周五', '周六', '周四', '周日', '搜索引擎', '直接访问', '邮件营销'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/PercentBarChart.vue',
    match: ['系列'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/PieChart.vue',
    match: ['搜索引擎', '直接访问', '联盟广告', '视频广告', '邮件营销'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/PieSunburstChart.vue',
    match: ['其他', '外部来源', '客户端', '必应', '搜索引擎', '数据访问', '浏览器', '百度', '直接访问', '社交媒体', '移动应用', '谷歌', '邮件营销'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/RadarChart.vue',
    match: ['信息技术', '客服', '市场', '研发', '管理', '销售', '预算分配'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/RankListChart.vue',
    match: ['周八', '孙七', '张三', '李四', '王五', '赵六'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/SankeyChart.vue',
    match: ['搜索', '注册', '浏览', '点击', '访问', '购买'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/StackedAreaChart.vue',
    match: ['搜索引擎', '直接访问', '联盟广告', '视频广告', '邮件营销'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/TableChart.vue',
    match: ['业绩', '姓名', '市场部', '张三', '技术部', '李四', '王五', '赵六', '部门', '销售部'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/TreemapChart.vue',
    match: ['前端框架', '后端技术', '数据可视化', '数据库'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/WaterfallChart.vue',
    match: ['利润', '商品成本', '工资', '房租', '收入', '水电'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/charts/WordCloudChart.vue',
    match: ['交互设计', '响应式布局', '图表组件', '大屏设计', '实时数据', '数据可视化', '数据大屏'],
    reason:
      '这些是图表在用户尚未配置数据源时展示的默认演示数据（系列名、类目名、省市名、星期、人名、区域名、词条等），不含任何界面框架文案。用户一旦绑定数据或手动改写，落库内容即成为用户自己的数据；若随界面语言切换，用户已保存的大屏会出现中英混杂，因此刻意不翻译。',
  },
  {
    file: 'screen-designer/widgets/small/StepsWidget.vue',
    match: ['数据分析', '数据处理', '数据采集', '结果展示'],
    reason:
      '这是组件新建时的预置默认内容，落库后成为用户可编辑的数据，不是界面框架文案，因此不随界面语言切换。',
  },
  {
    file: 'screen-designer/widgets/text/MarqueeText.vue',
    match: ['从右向左滚动显示', '这是一段跑马灯文本'],
    reason:
      '这是组件新建时的预置默认内容，落库后成为用户可编辑的数据，不是界面框架文案，因此不随界面语言切换。',
  },
]

let passed = 0
function t(name, fn) {
  fn()
  passed++
  console.log('  ok -', name)
}

function walk(abs) {
  if (!existsSync(abs)) return []
  if (statSync(abs).isFile()) return [abs]
  return readdirSync(abs).flatMap((name) => walk(join(abs, name)))
}

function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const usedExemptions = new Set()

// 该行是否被声明的豁免覆盖（同一文件 + 行内包含指定代码片段）
function exemptionFor(relFile, line) {
  for (const [i, ex] of CJK_EXEMPTIONS.entries()) {
    if (ex.file !== relFile) continue
    // 整文件豁免：仅用于「全文件都是预置数据、没有任何界面文案」的数据模块
    if (ex.fileScoped) {
      usedExemptions.add(i)
      return ex
    }
    const needles = Array.isArray(ex.match) ? ex.match : [ex.match]
    if (needles.some((n) => line.includes(n))) {
      usedExemptions.add(i)
      return ex
    }
  }
  return null
}

function scan(relPath) {
  const abs = join(SRC, relPath)
  const files = statSync(abs).isFile() ? [abs] : walk(abs)
  const hits = []
  for (const file of files) {
    if (!/\.(js|ts|vue)$/.test(file)) continue
    const relFile = relative(SRC, file)
    const body = stripComments(readFileSync(file, 'utf8'))
    body.split('\n').forEach((line, i) => {
      if (!CJK.test(line)) return
      if (exemptionFor(relFile, line)) return
      hits.push(`${relFile}:${i + 1}: ${line.trim()}`)
    })
  }
  return hits
}

t('i18n 内核文件无中文残留', () => {
  for (const p of SCAN_PATHS) {
    const hits = scan(p)
    assert.deepEqual(hits, [], `${p} 含中文:\n${hits.join('\n')}`)
  }
})

t('en-US 词典无中文残留', () => {
  const hits = scan('i18n/locales/en-US')
  assert.deepEqual(hits, [], `en-US 词典含中文:\n${hits.join('\n')}`)
})

t('SCAN_PATHS 中每个路径都存在', () => {
  for (const p of SCAN_PATHS) {
    assert.ok(existsSync(join(SRC, p)), `SCAN_PATHS 路径不存在: ${p}`)
  }
})

t('行级豁免都写明了原因', () => {
  for (const ex of CJK_EXEMPTIONS) {
    assert.ok(ex.reason && ex.reason.length >= 20, `豁免缺少充分原因: ${ex.file} ${ex.match}`)
    const why = ['枚举', '后端', '演示', '预置'].some((w) => ex.reason.includes(w))
    assert.ok(why, `豁免原因需说明为何不可翻译: ${ex.file}`)
    assert.ok(ex.fileScoped || ex.match, `豁免缺少匹配条件: ${ex.file}`)
  }
})

t('行级豁免全部命中（无僵尸配置）', () => {
  // 前面所有扫描都已执行过，usedExemptions 记录了实际命中的豁免
  for (const [i, ex] of CJK_EXEMPTIONS.entries()) {
    assert.ok(usedExemptions.has(i), `豁免已失效（代码已改动，请删除）: ${ex.file} ${ex.match}`)
  }
})

t('语言母语名保持母语写法（不翻译）', () => {
  // LOCALE_OPTIONS 是 [{ value, label }] 数组，先转成 value->label 映射再断言
  const labels = Object.fromEntries(LOCALE_OPTIONS.map((o) => [o.value, o.label]))
  assert.equal(labels['zh-CN'], '中文')
  assert.equal(labels['en-US'], 'English')
  assert.deepEqual(Object.keys(labels), SUPPORT_LOCALES)
})

console.log(`i18n 中文残留测试：${passed} 项通过`)
