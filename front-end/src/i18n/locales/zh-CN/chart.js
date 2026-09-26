export default {
  categories: {
    bar: '柱形图',
    horizontalBar: '条形图',
    line: '折线图与面积图',
    pie: '饼图与漏斗图',
    scatter: '气泡图与散点图',
    indicator: '指标与进度',
    map: '地图',
    table: '表格',
    other: '其他',
  },
  types: {
    bar: '单柱图',
    barClustered: '簇状柱形图',
    barStacked: '堆积柱形图',
    barLine: '簇状+折线',
    barPictorial: '簇状+符号',
    barPercentStacked: '百分比堆积',
    barGroupStacked: '分组堆积',
    barStackedLine: '堆积+折线',
    barStackedPictorial: '堆积+符号',
    bullet: '子弹图',
    waterfall: '瀑布图',
    pareto: '帕累托图',
    horizontalBar: '单条图',
    horizontalBarClustered: '簇状条形图',
    horizontalBarStacked: '堆积条形图',
    horizontalBarPercentStacked: '百分比堆积',
    horizontalBarGroupStacked: '分组堆积',
    horizontalBullet: '子弹图',
    butterfly: '蝴蝶图',
    line: '单线图',
    lineMulti: '多线图',
    areaStacked: '堆积面积图',
    areaPercentStacked: '百分比堆积面积',
    pie: '饼图',
    doughnut: '环形图',
    sunburst: '旭日图',
    nightingale: '南丁格尔玫瑰图',
    funnel: '漏斗图',
    funnelHorizontal: '水平漏斗图',
    scatter: '散点图',
    bubble: '气泡图',
    stat: '指标卡',
    progressBar: '进度条',
    circularProgress: '圆形进度条',
    multiRingProgress: '多环进度条',
    fluidProgress: '流体进度条',
    gauge: '填充仪表板',
    statTrend: '指标趋势图',
    mapChina: '中国行政区地图',
    mapChinaBubble: '气泡行政区地图',
    mapChinaSymbol: '符号行政地图',
    mapWorld: '世界地图',
    table: '表格',
    heatmap: '热力图',
    boxplot: '箱线图',
    radar: '雷达图',
    polarBar: '极坐标图',
    barBreakAxis: '断轴柱状图',
    calendar: '日历图',
    candlestick: 'K线图',
    treemap: '矩形树图',
    sankey: '桑基图',
    chord: '和弦图',
  },
  agg: {
    sum: '求和',
    avg: '平均值',
    count: '计数',
    count_distinct: '去重计数',
    max: '最大值',
    min: '最小值',
  },
  aggSql: {
    sum: '求和 SUM',
    avg: '平均 AVG',
    count: '计数 COUNT',
    count_distinct: '去重计数',
    max: '最大 MAX',
    min: '最小 MIN',
  },
  derived: {
    share: '占比',
    mom: '环比',
    yoy: '同比',
    cumsum: '累计',
    rank: '排名',
  },
  stringOps: {
    contains: '包含',
  },
  axis: {
    yAxisName: '{name} 单位： {unit}',
    unitOnly: '单位： {unit}',
  },
  series: {
    thresholdValue: '阈值 {value}',
    cumulativeShare: '累积占比%',
  },
  empty: {
    configureDimsMetrics: '请配置维度与指标后展示',
    configureData: '请配置数据',
    configureDimsMetricsShort: '请配置维度与指标',
    configureMetric: '请配置指标',
    configureXyDimsMetrics: '请配置 X/Y 维度与指标',
    configureSankey: '请配置 来源节点/目标节点/数值',
    candlestickNeeds: 'K线图需要 日期维度 + 开/高/低/收 4个指标',
    metricFallback: '指标',
    none: '无',
  },
  position: {
    topLeft: '左上',
    topCenter: '上中',
    topRight: '右上',
    midLeft: '左中',
    midCenter: '居中',
    midRight: '右中',
    botLeft: '左下',
    botCenter: '下中',
    botRight: '右下',
  },
  common: {
    pleaseSelect: '请选择',
    configMissing: '配置缺失',
    unsupportedFieldType: '不支持的字段类型',
  },
  group: {
    theme: '主题',
    exclusiveConfig: '专属配置',
    exclusiveConfigWithType: '{type} 专属配置',
    lineStyles: '线条样式 · 按系列',
  },
  grain: {
    day: '日',
    month: '月',
    year: '年',
  },
  metricKind: {
    base: '原子指标',
    expr: '复合指标',
    derived: '衍生指标',
    saved: '指标库',
  },
  field: {
    panelTitle: '字段配置',
    paletteTitle: '可用字段（拖拽或点击添加）',
    dimsGroup: '维度（分类 / X 轴）',
    metricsGroup: '指标（数值 / Y 轴）',
    dropHintDim: '拖入字段作为维度',
    dropHintMetric: '拖入字段作为指标',
    selectField: '选择字段',
    granularity: '粒度',
    metricShape: '形态',
    selectLibraryMetric: '选择指标库指标',
    metricName: '指标名称',
    formulaPlaceholder: '复合指标公式，如 $m0 / $m1',
    kindPlaceholder: '类型',
    refMetric: '引用指标',
    derivedHint: '衍生指标基于前序原子/复合指标在结果行上计算',
    libraryEmpty: '（指标库为空，请先在数据集「指标库」中创建）',
    refLabel: '引用前序原子指标：',
    noReferable: '（暂无，请先在上方添加原子指标）',
    defaultExprName: '复合指标{n}',
    defaultDerivedName: '衍生指标{n}',
    errLibraryEmpty: '数据集指标库为空',
    errSelectReuse: '请选择要复用的指标',
    errRefMissing: '引用 {ref} 不存在',
    errNeedSource: '需要先在上方添加原子/复合指标作为引用源',
    errSelectRef: '请选择要引用的指标',
  },
  theme: {
    mode: '模式',
    light: '亮色',
    dark: '暗色',
    backgroundColor: '背景色',
    textColor: '文字颜色',
    palette: '系列色板',
    reset: '重置',
    customPalette: '自定义',
    restoreDefault: '恢复默认',
  },
  dataSource: {
    title: '数据源',
    selectDataset: '选择一个数据集',
    emptyPrefix: '还没有数据集，',
    goUpload: '去「数据源」页上传',
  },
  builder: {
    displayOptions: '显示选项',
    displayCount: '显示数量',
    sortBy: '排序方式',
    sortNone: '不排序',
    sortMetric: '按指标',
    sortDim: '按维度',
    orderAsc: '升序',
    orderDesc: '降序',
    chartNamePlaceholder: '图表名称',
    save: '保存图表',
    livePreview: ' - 实时预览',
    refresh: '刷新',
    noMetric: '暂无指标',
    configureHint: '配置维度与指标后展示预览',
    chartType: '图表类型',
    libraryMetric: '指标库指标',
    exprFormula: '复合指标公式 {expr}',
    rowCount: '数据行数',
    errNameRequired: '请填写图表名称',
    errDatasetRequired: '请选择数据集',
    errMetricRequired: '请至少添加一个指标',
    saved: '图表已保存',
    updated: '图表已更新',
  },
  list: {
    title: '图表中心',
    desc: '通过字段拖拽配置维度与指标，实时预览图表效果',
    create: '新建图表',
    statTotal: '图表总数',
    statTypeCount: '图表类型数',
    statReferenced: '已被看板引用',
    listTitle: '图表列表',
    searchPlaceholder: '搜索图表名称',
    totalTag: '共 {n} 条',
    empty: '还没有图表，点击右上角「新建图表」开始',
    colName: '名称',
    colType: '图表类型',
    colDatasource: '数据源',
    invalid: '已失效',
    colUpdatedAt: '更新时间',
    colActions: '操作',
    edit: '编辑',
    preview: '预览',
    remove: '删除',
    previewTitle: '图表预览',
    deleteConfirm: '确定删除图表「{name}」？',
    deleteConfirmTitle: '删除确认',
    deleteSuccess: '删除成功',
  },
  schema: {
    style: {
      color: {
        label: '颜色',
      },
      fontSize: {
        label: '字号',
      },
      fontWeight: {
        label: '加粗',
      },
      fontStyle: {
        label: '斜体',
      },
      textDecoration: {
        label: '下划线',
      },
    },
    styleTitle: {
      fontSize: {
        label: '字号',
      },
    },
    opt: {
      orient: {
        horizontal: {
          label: '横排',
          title: '横排',
        },
        vertical: {
          label: '竖排',
          title: '竖排',
        },
      },
      labelPos: {
        top: {
          label: '上',
          title: '上',
        },
        bottom: {
          label: '下',
          title: '下',
        },
        left: {
          label: '左',
          title: '左',
        },
        right: {
          label: '右',
          title: '右',
        },
        inside: {
          label: '内',
          title: '内',
        },
      },
      pieLabelPos: {
        outside: {
          label: '外',
          title: '外',
        },
        inside: {
          label: '内',
          title: '内',
        },
        center: {
          label: '居中',
          title: '居中',
        },
      },
    },
    cfg: {
      title: {
        label: '标题',
        show: {
          label: '显示',
        },
        text: {
          label: '标题文字',
          placeholder: '输入图表标题',
        },
        subtext: {
          label: '副标题',
          placeholder: '副标题(可选)',
        },
        position: {
          label: '位置',
        },
        textStyle: {
          label: '文字样式',
        },
      },
      legend: {
        label: '图例',
        show: {
          label: '显示',
        },
        orient: {
          label: '方向',
        },
        position: {
          label: '位置',
        },
        align: {
          label: '对齐',
          options: {
            auto: {
              label: '自动',
              title: '自动对齐',
            },
            left: {
              label: '左',
              title: '左对齐',
            },
            center: {
              label: '中',
              title: '居中对齐',
            },
            right: {
              label: '右',
              title: '右对齐',
            },
          },
        },
        icon: {
          label: '形状',
          options: {
            0: {
              label: '自动',
            },
            circle: {
              label: '圆形',
            },
            rect: {
              label: '方形',
            },
            roundRect: {
              label: '圆角矩形',
            },
            diamond: {
              label: '菱形',
            },
            triangle: {
              label: '三角',
            },
            pin: {
              label: '引脚',
            },
          },
        },
        itemWidth: {
          label: '形状宽',
        },
        itemHeight: {
          label: '形状高',
        },
        textStyle: {
          label: '文字样式',
        },
      },
      tooltip: {
        label: '提示框',
        show: {
          label: '显示',
        },
        trigger: {
          label: '触发方式',
          options: {
            axis: {
              label: '坐标轴',
            },
            item: {
              label: '数据项',
            },
            none: {
              label: '不触发',
            },
          },
        },
        axisPointer: {
          label: '指示器类型',
          type: {
            options: {
              line: {
                label: '直线',
              },
              shadow: {
                label: '阴影',
              },
              none: {
                label: '无',
              },
              cross: {
                label: '十字准星',
              },
            },
          },
        },
        formatter: {
          label: '内容格式',
          placeholder: "如 {'{'}a{'}'}{'{'}b{'}'}: {'{'}c{'}'}，留空自动",
        },
        backgroundColor: {
          label: '背景色',
        },
        borderColor: {
          label: '边框色',
        },
        textStyle: {
          label: '文字样式',
        },
      },
      label: {
        label: '数据标签',
        show: {
          label: '显示',
        },
        content: {
          label: '显示内容',
          options: {
            a: {
              label: '系列名称',
            },
            b: {
              label: '类别名称',
            },
            c: {
              label: '数值',
            },
          },
        },
        separator: {
          label: '分隔符',
          options: {
            space: {
              label: '空格',
            },
            _2c_20: {
              label: '逗号',
            },
            newline: {
              label: '换行',
            },
            _20_7c_20: {
              label: '竖线',
            },
          },
        },
        position: {
          label: '位置',
        },
        textStyle: {
          label: '文字样式',
          color: {
            label: '颜色',
          },
        },
        showBorder: {
          label: '显示描边',
        },
        borderColor: {
          label: '描边颜色',
        },
        allowOverlap: {
          label: '允许重叠',
        },
      },
      markLine: {
        label: '标记线',
        color: {
          label: '线条颜色',
        },
        width: {
          label: '线宽',
        },
        show: {
          label: '显示',
        },
        type: {
          label: '类型',
          options: {
            average: {
              label: '平均值',
            },
            max: {
              label: '最大值',
            },
            min: {
              label: '最小值',
            },
            median: {
              label: '中位数',
            },
            custom: {
              label: '自定义',
            },
          },
        },
        customValue: {
          label: '自定义值',
        },
        lineType: {
          label: '线型',
          options: {
            solid: {
              label: '实线',
            },
            dashed: {
              label: '虚线',
            },
            dotted: {
              label: '点线',
            },
          },
        },
        showLabel: {
          label: '显示标签',
        },
      },
      grid: {
        label: '绘图区域',
        left: {
          label: '左边距',
        },
        right: {
          label: '右边距',
        },
        top: {
          label: '上边距',
        },
        bottom: {
          label: '下边距',
        },
      },
      dataZoom: {
        label: '缩略轴',
        show: {
          label: '启用',
        },
        type: {
          label: '类型',
          options: {
            slider: {
              label: '滑块',
            },
            inside: {
              label: '内置',
            },
          },
        },
        startPercent: {
          label: '起始比例%',
        },
        endPercent: {
          label: '结束比例%',
        },
      },
      xAxis: {
        label: 'X轴',
        show: {
          label: '显示',
        },
        name: {
          label: '轴名称',
        },
        nameTextStyle: {
          label: '文字样式',
        },
        labelColor: {
          label: '标签颜色',
        },
        nameRotate: {
          label: '名称旋转',
        },
        labelRotate: {
          label: '标签旋转',
        },
      },
      yAxis: {
        label: 'Y轴',
        show: {
          label: '显示',
        },
        name: {
          label: '轴名称',
        },
        nameTextStyle: {
          label: '文字样式',
        },
        unit: {
          label: '单位',
          placeholder: '如 元、%',
        },
        labelColor: {
          label: '标签颜色',
        },
        splitLine: {
          label: '网格线',
        },
        min: {
          label: '最小值',
          placeholder: '自动或数值',
        },
        max: {
          label: '最大值',
          placeholder: '自动或数值',
        },
        interval: {
          label: '数据步长',
          placeholder: '自动或数值',
        },
      },
    },
    type: {
      bar: {
        barWidth: {
          label: '柱宽',
          placeholder: '自动',
        },
        barGap: {
          label: '柱间距%',
        },
        rounded: {
          label: '圆角柱',
        },
      },
      barClustered: {
        barWidth: {
          label: '柱宽',
          placeholder: '自动',
        },
        barGap: {
          label: '柱间距%',
        },
        rounded: {
          label: '圆角柱',
        },
      },
      barStacked: {
        barWidth: {
          label: '柱宽',
          placeholder: '自动',
        },
        rounded: {
          label: '圆角柱',
        },
      },
      barLine: {
        lineSeries: {
          label: '折线指定系列',
        },
        smooth: {
          label: '平滑折线',
        },
      },
      barPictorial: {
        symbolType: {
          label: '符号类型',
          options: {
            circle: {
              label: '圆',
            },
            rect: {
              label: '矩形',
            },
            triangle: {
              label: '三角',
            },
            diamond: {
              label: '菱形',
            },
          },
        },
      },
      barPercentStacked: {
        barWidth: {
          label: '柱宽',
          placeholder: '自动',
        },
        showPercentLabel: {
          label: '显示百分比标签',
        },
      },
      barGroupStacked: {
        barWidth: {
          label: '柱宽',
          placeholder: '自动',
        },
      },
      barStackedLine: {
        smooth: {
          label: '平滑折线',
        },
      },
      barStackedPictorial: {
        symbolType: {
          label: '符号类型',
          options: {
            circle: {
              label: '圆',
            },
            rect: {
              label: '矩形',
            },
          },
        },
      },
      bullet: {
        barWidth: {
          label: '柱宽',
        },
        targetValue: {
          label: '目标值',
        },
      },
      waterfall: {
        increaseColor: {
          label: '增加颜色',
        },
        decreaseColor: {
          label: '减少颜色',
        },
      },
      pareto: {
        showLine: {
          label: '显示累积线',
        },
      },
      horizontalBar: {
        barWidth: {
          label: '条宽',
          placeholder: '自动',
        },
      },
      horizontalBarClustered: {
        barWidth: {
          label: '条宽',
          placeholder: '自动',
        },
        barGap: {
          label: '条间距%',
        },
      },
      horizontalBarStacked: {
        barWidth: {
          label: '条宽',
          placeholder: '自动',
        },
      },
      horizontalBarPercentStacked: {
        barWidth: {
          label: '条宽',
          placeholder: '自动',
        },
        showPercentLabel: {
          label: '显示百分比标签',
        },
      },
      horizontalBarGroupStacked: {
        barWidth: {
          label: '条宽',
          placeholder: '自动',
        },
      },
      horizontalBullet: {
        barWidth: {
          label: '条宽',
        },
        targetValue: {
          label: '目标值',
        },
      },
      butterfly: {
        barWidth: {
          label: '条宽',
          placeholder: '自动',
        },
      },
      line: {
        smooth: {
          label: '平滑',
        },
        areaStyle: {
          label: '面积填充',
        },
        step: {
          label: '步进',
          options: {
            0: {
              label: '无',
            },
            start: {
              label: '起始',
            },
            middle: {
              label: '中间',
            },
            end: {
              label: '结束',
            },
          },
        },
      },
      lineMulti: {
        smooth: {
          label: '平滑',
        },
      },
      areaStacked: {
        smooth: {
          label: '平滑',
        },
        opacity: {
          label: '透明度',
        },
      },
      areaPercentStacked: {
        smooth: {
          label: '平滑',
        },
        opacity: {
          label: '透明度',
        },
      },
      pie: {
        radius: {
          label: '半径%',
        },
        startAngle: {
          label: '起始角度',
        },
        labelPosition: {
          label: '标签位置',
        },
        roseType: {
          label: '玫瑰模式',
        },
      },
      doughnut: {
        radiusInner: {
          label: '内径%',
        },
        radiusOuter: {
          label: '外径%',
        },
        startAngle: {
          label: '起始角度',
        },
        labelPosition: {
          label: '标签位置',
        },
        showCenter: {
          label: '中心文本',
        },
        centerText: {
          label: '中心标题',
          placeholder: '留空显示数值',
        },
        centerSubtext: {
          label: '中心副标题',
          placeholder: '可选',
        },
        centerColor: {
          label: '标题颜色',
        },
        centerSubColor: {
          label: '副标题颜色',
        },
        centerFontSize: {
          label: '标题字号',
        },
        centerSubFontSize: {
          label: '副标题字号',
        },
      },
      sunburst: {
        radius: {
          label: '半径%',
        },
        startAngle: {
          label: '起始角度',
        },
      },
      nightingale: {
        radius: {
          label: '半径%',
        },
        roseType: {
          label: '模式',
          options: {
            radius: {
              label: '半径',
            },
            area: {
              label: '面积',
            },
          },
        },
      },
      funnel: {
        sort: {
          label: '排序',
          options: {
            descending: {
              label: '降序',
            },
            ascending: {
              label: '升序',
            },
            none: {
              label: '无',
            },
          },
        },
        gap: {
          label: '间距',
        },
      },
      funnelHorizontal: {
        sort: {
          label: '排序',
          options: {
            descending: {
              label: '降序',
            },
            ascending: {
              label: '升序',
            },
            none: {
              label: '无',
            },
          },
        },
        gap: {
          label: '间距',
        },
      },
      scatter: {
        symbolSize: {
          label: '符号大小',
        },
      },
      bubble: {
        symbolSize: {
          label: '最大气泡大小',
        },
      },
      progressBar: {
        max: {
          label: '最大值',
        },
        showTarget: {
          label: '显示目标',
        },
      },
      circularProgress: {
        max: {
          label: '最大值',
        },
        lineWidth: {
          label: '线宽',
        },
      },
      multiRingProgress: {
        max: {
          label: '最大值',
        },
        lineWidth: {
          label: '线宽',
        },
      },
      fluidProgress: {
        max: {
          label: '最大值',
        },
      },
      gauge: {
        min: {
          label: '最小值',
        },
        max: {
          label: '最大值',
        },
        splitNumber: {
          label: '分割段数',
        },
        progressWidth: {
          label: '进度宽度',
        },
      },
      statTrend: {
        showSparkline: {
          label: '显示趋势线',
        },
        sparklineColor: {
          label: '趋势线颜色',
        },
      },
      radar: {
        shape: {
          label: '形状',
          options: {
            polygon: {
              label: '多边形',
            },
            circle: {
              label: '圆形',
            },
          },
        },
        splitNumber: {
          label: '分割段数',
        },
        areaOpacity: {
          label: '区域透明度',
        },
      },
      mapChina: {
        zoom: {
          label: '缩放',
        },
        showLabels: {
          label: '显示地区名',
        },
      },
      mapChinaBubble: {
        zoom: {
          label: '缩放',
        },
        symbolSize: {
          label: '气泡大小',
        },
        showLabels: {
          label: '显示地区名',
        },
      },
      mapChinaSymbol: {
        zoom: {
          label: '缩放',
        },
        symbolSize: {
          label: '符号大小',
        },
      },
      mapWorld: {
        zoom: {
          label: '缩放',
        },
      },
      heatmap: {
        showValues: {
          label: '显示数值',
        },
      },
      polarBar: {
        barWidth: {
          label: '柱宽',
          placeholder: '自动',
        },
      },
      barBreakAxis: {
        breakStart: {
          label: '断点起始',
        },
        breakEnd: {
          label: '断点结束',
        },
      },
      calendar: {
        cellSize: {
          label: '单元格大小',
        },
      },
      candlestick: {
        upColor: {
          label: '阳线颜色',
        },
        downColor: {
          label: '阴线颜色',
        },
      },
      treemap: {
        orient: {
          label: '方向',
        },
      },
      sankey: {
        nodeWidth: {
          label: '节点宽度',
        },
        nodeGap: {
          label: '节点间距',
        },
        layoutIterations: {
          label: '布局迭代',
        },
      },
      chord: {
        nodeWidth: {
          label: '节点宽度',
        },
        nodeGap: {
          label: '节点间距',
        },
      },
    },
    series: {
      lineType: {
        label: '线型',
        options: {
          solid: {
            label: '实线',
          },
          dashed: {
            label: '虚线',
          },
          dotted: {
            label: '点线',
          },
        },
      },
      lineColor: {
        label: '线条颜色',
        placeholder: '留空随调色板',
      },
      lineWidth: {
        label: '线宽',
      },
      symbol: {
        label: '数据点',
        options: {
          circle: {
            label: '实心圆',
          },
          emptyCircle: {
            label: '空心圆',
          },
          rect: {
            label: '矩形',
          },
          roundRect: {
            label: '圆角矩形',
          },
          diamond: {
            label: '菱形',
          },
          triangle: {
            label: '三角',
          },
          none: {
            label: '无',
          },
        },
      },
      symbolSize: {
        label: '点大小',
      },
    },
  },
  palettes: {
    classicBlue: '经典蓝',
    soft: '柔和',
    vivid: '鲜艳',
    cool: '冷色',
    warm: '暖色',
    rainbow: '彩虹',
    business: '商务',
    nature: '自然',
    tech: '科技',
    earth: '大地',
  },
}
