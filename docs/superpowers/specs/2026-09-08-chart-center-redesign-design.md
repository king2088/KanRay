# 图表中心优化设计文档

> 日期：2026-09-08
> 状态：已批准

## 一、目标

将图表中心（ChartBuilder）从当前的两列布局升级为三列专业级 BI 图表编辑器，同时：
1. 升级 ECharts 从 5.6.0 到 6.1.0
2. 扩展图表类型从 7 种到 60+ 种（9大类）
3. 为每种图表提供专属配置面板

## 二、布局设计

### 当前布局
```
左配置(360px) + 右预览(flex:1)
```

### 新布局（三列）
```
+------------------------------------------------------------------+
| 工具栏 (52px) — 返回 | 图表名称 | 数据集标签 |         保存按钮 |
+------------------------------------------------------------------+
| 左侧(280px)    | 中间(flex:1)      | 右侧(320px)               |
|                 |                   |                           |
| 数据源选择      |                   | 图表类型选择网格           |
| 字段面板(拖拽)  |   图表预览区      |   (分类: 全部/柱形/...)    |
| 维度drop zone   |                   |                           |
| 指标drop zone   |                   | 配置折叠面板(滚动)         |
|                 |                   |   - 标题/图例/提示         |
|                 |                   |   - 坐标轴/标签/辅助线     |
|                 |                   |   - 类型专属配置           |
|                 |                   |   - 颜色/主题             |
+------------------------------------------------------------------+
```

## 三、图表类型体系（9大类60+种）

### 1. 柱形图 (12种)
- 单柱图 `bar`
- 簇状柱形图 `barClustered`
- 堆积柱形图 `barStacked`
- 簇状+折线 `barLine`
- 簇状+符号 `barPictorial`
- 百分比堆积柱形图 `barPercentStacked`
- 分组堆积柱形图 `barGroupStacked`
- 堆积+折线 `barStackedLine`
- 堆积+符号 `barStackedPictorial`
- 子弹图 `bullet`
- 瀑布图 `waterfall`
- 帕累托图 `pareto`

### 2. 条形图 (7种)
- 单条图 `horizontalBar`
- 簇状条形图 `horizontalBarClustered`
- 堆积条形图 `horizontalBarStacked`
- 百分比堆积条形图 `horizontalBarPercentStacked`
- 分组堆积条形图 `horizontalBarGroupStacked`
- 子弹图 `horizontalBullet`
- 蝴蝶图 `butterfly`

### 3. 折线图与面积图 (4种)
- 单线图 `line`
- 多线图 `lineMulti`
- 堆积面积图 `areaStacked`
- 百分比堆积面积图 `areaPercentStacked`

### 4. 饼图与漏斗图 (5种)
- 饼图 `pie`
- 旭日图 `sunburst`
- 矩形图 `treemapPie` (nightingale rose via pie)
- 漏斗图 `funnel`
- 水平漏斗图 `funnelHorizontal`

### 5. 气泡图与散点图 (2种)
- 气泡图 `bubble`
- 散点图 `scatter`

### 6. 指标与进度 (7种)
- 指标卡 `stat`
- 进度条 `progressBar`
- 圆形进度条 `circularProgress`
- 多环进度条 `multiRingProgress`
- 流体进度条 `fluidProgress`
- 填充仪表板 `gauge`
- 指标趋势图 `statTrend`

### 7. 地图 (4种)
- 中国行政区地图 `mapChina`
- 气泡行政区地图 `mapChinaBubble`
- 符号行政地图 `mapChinaSymbol`
- 世界地图 `mapWorld`

### 8. 表格 (1种)
- 表格 `table`

### 9. 其他 (11种)
- 热力图 `heatmap`
- 箱线图 `boxplot`
- 雷达图 `radar`
- 极坐标图 `polarBar`
- 断轴柱状图 `barBreakAxis`
- 日历图 `calendar`
- K线图 `candlestick`
- 盒须图 `boxplot` (same as boxplot, alias)
- 矩形树图 `treemap`
- 桑基图 `sankey`
- 和弦图 `chord`

## 四、配置面板体系

### 公共配置（所有图表类型共享）
1. **标题** — 标题文本、副标题、位置(top/center/left/right)、字体大小/颜色
2. **图例** — 显示/隐藏、位置(top/bottom/left/right)、布局方向
3. **提示(Tooltip)** — 触发方式(axis/item/none)、格式化模板
4. **辅助线(MarkLine)** — 阈值线、均值线、自定义值
5. **标签(Label)** — 显示/隐藏、位置、格式化(数值/百分比)
6. **颜色主题** — 预设调色板(10+套)、自定义颜色序列

### 类型专属配置
每种图表类型在 `chart-configs.js` 中定义独立的配置 schema，包含：
- `fields` — 配置项定义（类型、默认值、选项等）
- `buildOption(data, config)` — 根据配置生成 ECharts option 的函数

配置项按图表类别组织，详见各图表类型的实现。

## 五、数据映射

### 标准映射（大部分图表）
- 维度(Dimension) → X轴/分类轴
- 指标(Metric) → Y轴/数值轴
- 第二维度 → 系列分组

### 特殊映射
| 图表类型 | 需要的字段 | 说明 |
|----------|-----------|------|
| K线图 | 日期维度 + 开盘/最高/最低/收盘 4个指标 | OHLC字段映射 |
| 盒须图 | 分类维度 + 数值指标 | 自动计算5数概括 |
| 热力图 | X轴维度 + Y轴维度 + 数值指标 | 3字段映射 |
| 桑基图 | 来源节点 + 目标节点 + 数值 | source-target-value |
| 和弦图 | 来源节点 + 目标节点 + 数值 | source-target-value |
| 地图类 | 区域名称维度 + 数值指标 | 区域名需匹配GeoJSON |
| 矩形树图 | 分类维度 + 数值指标 | 层级可选多维度 |
| 指标趋势图 | 时间维度 + 数值指标 | 折线+大数字组合 |
| 漏斗图 | 分类维度 + 数值指标 | 按阶段递减 |

## 六、技术架构

### ECharts 6.1.0 升级
- 包名：`echarts@6.1.0`
- 树导入新增图表：BarChart, LineChart, PieChart, ScatterChart, GaugeChart, FunnelChart, RadarChart, BoxplotChart, CandlestickChart, HeatmapChart, TreeMapChart, SankeyChart, MapChart, CalendarChart, GraphChart, PictorialBarChart, CustomChart, SunburstChart, ChordChart
- 组件新增：VisualMapComponent, GeoComponent, DatasetComponent, TransformComponent, ToolboxComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent, GraphicComponent, CalendarComponent, PolarComponent, RadiusAxisComponent, AngleAxisComponent
- 使用 `echarts/theme/v5.js` 兼容旧主题

### 文件结构
```
src/
├── utils/
│   ├── echarts.js              ← 扩展所有图表/组件导入
│   └── chart-utils.js          ← 保留基础工具函数
├── config/
│   ├── chart-types.js          ← 9大类图表类型定义(含分类、图标、标签)
│   ├── chart-configs.js        ← 每种图表的配置schema + option生成器
│   └── color-palettes.js       ← 颜色主题/调色板定义
├── components/
│   └── charts/
│       ├── EChartRenderer.vue   ← 通用渲染(保持不变，扩展watch)
│       ├── ChartTypePanel.vue   ← 右侧上方：图表类型选择+分类筛选
│       ├── ChartConfigPanel.vue ← 右侧下方：公共+专属配置面板
│       ├── FieldConfigPanel.vue ← 左侧字段配置(维度/指标拖拽)
│       └── DataSourcePanel.vue  ← 左侧数据源选择
└── views/
    └── ChartBuilder.vue         ← 三列布局容器
```

## 七、提交计划（小提交）

| # | 提交内容 | 涉及文件 |
|---|---------|---------|
| 1 | ECharts 6.1.0 升级 + 导入更新 | package.json, echarts.js |
| 2 | 图表类型定义系统 | config/chart-types.js |
| 3 | 颜色主题系统 | config/color-palettes.js |
| 4 | 三列布局重构 | ChartBuilder.vue |
| 5 | 左侧组件拆分 | DataSourcePanel.vue, FieldConfigPanel.vue |
| 6 | 右侧图表类型面板 | ChartTypePanel.vue |
| 7 | 右侧配置面板框架 | ChartConfigPanel.vue |
| 8 | 柱形图12种渲染+配置 | chart-configs.js |
| 9 | 条形图7种渲染+配置 | chart-configs.js |
| 10 | 折线/面积4种渲染+配置 | chart-configs.js |
| 11 | 饼图/漏斗5种渲染+配置 | chart-configs.js |
| 12 | 散点/气泡2种渲染+配置 | chart-configs.js |
| 13 | 指标/进度7种渲染+配置 | chart-configs.js |
| 14 | 地图4种(含GeoJSON) | chart-configs.js, public/geo/ |
| 15 | 表格增强 | ChartBuilder.vue |
| 16 | 其他11种渲染+配置 | chart-configs.js |
| 17 | 公共配置面板实现 | ChartConfigPanel.vue |
| 18 | 各类型专属配置实现 | ChartConfigPanel.vue, chart-configs.js |
| 19 | 后端chart type白名单更新 | chart.service.js |
| 20 | EChartRenderer watch扩展 | EChartRenderer.vue |

## 八、验收标准

1. ECharts 6.1.0 安装成功，无控制台报错
2. 三列布局正常显示，左右面板可滚动，中间图表自适应
3. 60+种图表类型均可在右侧面板中选择并渲染
4. 每种图表类型有对应的专属配置项
5. 公共配置（标题/图例/提示/辅助线/标签/颜色）对所有图表生效
6. 特殊图表（K线/桑基/地图等）数据映射正确
7. 编辑模式下保存和加载正常
8. 暗色模式下图表正常显示
