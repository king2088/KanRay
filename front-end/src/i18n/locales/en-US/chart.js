export default {
  categories: {
    bar: 'Bar',
    horizontalBar: 'Horizontal bar',
    line: 'Line & area',
    pie: 'Pie & funnel',
    scatter: 'Scatter & bubble',
    indicator: 'Metric & progress',
    map: 'Map',
    table: 'Table',
    other: 'Other',
  },
  types: {
    bar: 'Bar',
    barClustered: 'Clustered bar',
    barStacked: 'Stacked bar',
    barLine: 'Clustered + line',
    barPictorial: 'Clustered + pictorial',
    barPercentStacked: 'Percent stacked',
    barGroupStacked: 'Grouped stacked',
    barStackedLine: 'Stacked + line',
    barStackedPictorial: 'Stacked + pictorial',
    bullet: 'Bullet chart',
    waterfall: 'Waterfall',
    pareto: 'Pareto',
    horizontalBar: 'Horizontal bar',
    horizontalBarClustered: 'Clustered horizontal bar',
    horizontalBarStacked: 'Stacked horizontal bar',
    horizontalBarPercentStacked: 'Percent stacked horizontal',
    horizontalBarGroupStacked: 'Grouped stacked horizontal',
    horizontalBullet: 'Bullet chart',
    butterfly: 'Butterfly',
    line: 'Line',
    lineMulti: 'Multi-line',
    areaStacked: 'Stacked area',
    areaPercentStacked: 'Percent stacked area',
    pie: 'Pie',
    doughnut: 'Donut',
    sunburst: 'Sunburst',
    nightingale: 'Nightingale rose',
    funnel: 'Funnel',
    funnelHorizontal: 'Horizontal funnel',
    scatter: 'Scatter',
    bubble: 'Bubble',
    stat: 'Metric card',
    progressBar: 'Progress bar',
    circularProgress: 'Circular progress',
    multiRingProgress: 'Multi-ring progress',
    fluidProgress: 'Fluid progress',
    gauge: 'Filled gauge',
    statTrend: 'Metric trend',
    mapChina: 'China administrative map',
    mapChinaBubble: 'Bubble administrative map',
    mapChinaSymbol: 'Symbol administrative map',
    mapWorld: 'World map',
    table: 'Table',
    heatmap: 'Heatmap',
    boxplot: 'Box plot',
    radar: 'Radar',
    polarBar: 'Polar chart',
    barBreakAxis: 'Broken-axis bar',
    calendar: 'Calendar',
    candlestick: 'Candlestick',
    treemap: 'Treemap',
    sankey: 'Sankey',
    chord: 'Chord',
  },
  agg: {
    sum: 'Sum',
    avg: 'Average',
    count: 'Count',
    count_distinct: 'Distinct count',
    max: 'Max',
    min: 'Min',
  },
  aggSql: {
    sum: 'Sum SUM',
    avg: 'Average AVG',
    count: 'Count COUNT',
    count_distinct: 'Distinct count',
    max: 'Max MAX',
    min: 'Min MIN',
  },
  derived: {
    share: 'Share',
    mom: 'MoM',
    yoy: 'YoY',
    cumsum: 'Cumulative',
    rank: 'Rank',
  },
  stringOps: {
    contains: 'Contains',
  },
  axis: {
    yAxisName: '{name} ({unit})',
    unitOnly: 'Unit: {unit}',
  },
  series: {
    thresholdValue: 'Threshold {value}',
    cumulativeShare: 'Cumulative %',
  },
  empty: {
    configureDimsMetrics: 'Configure a dimension and a metric to preview',
    configureData: 'Configure data',
    configureDimsMetricsShort: 'Configure dimensions and metrics',
    configureMetric: 'Configure a metric',
    configureXyDimsMetrics: 'Configure X/Y dimensions and metrics',
    configureSankey: 'Configure source / target / value',
    candlestickNeeds: 'Candlestick needs a date dimension plus 4 metrics: open / high / low / close',
    metricFallback: 'Metric',
    none: 'None',
  },
  position: {
    topLeft: 'Top left',
    topCenter: 'Top center',
    topRight: 'Top right',
    midLeft: 'Middle left',
    midCenter: 'Center',
    midRight: 'Middle right',
    botLeft: 'Bottom left',
    botCenter: 'Bottom center',
    botRight: 'Bottom right',
  },
  common: {
    pleaseSelect: 'Select',
    configMissing: 'Configuration missing',
    unsupportedFieldType: 'Unsupported field type',
  },
  group: {
    theme: 'Theme',
    exclusiveConfig: 'Settings',
    exclusiveConfigWithType: '{type} settings',
    lineStyles: 'Line styles · per series',
  },
  grain: {
    day: 'Day',
    month: 'Month',
    year: 'Year',
  },
  metricKind: {
    base: 'Atomic metric',
    expr: 'Composite metric',
    derived: 'Derived metric',
    saved: 'Metric library',
  },
  field: {
    panelTitle: 'Field configuration',
    paletteTitle: 'Available fields (drag or click to add)',
    dimsGroup: 'Dimensions (category / X axis)',
    metricsGroup: 'Metrics (numeric / Y axis)',
    dropHintDim: 'Drag a field here to add a dimension',
    dropHintMetric: 'Drag a field here to add a metric',
    selectField: 'Select a field',
    granularity: 'Granularity',
    metricShape: 'Metric type',
    selectLibraryMetric: 'Select a library metric',
    metricName: 'Metric name',
    formulaPlaceholder: 'Composite formula, e.g. $m0 / $m1',
    kindPlaceholder: 'Type',
    refMetric: 'Reference metric',
    derivedHint: 'Derived metrics are computed on the result rows from earlier atomic or composite metrics',
    libraryEmpty: '(Metric library is empty. Create metrics in the dataset "Metric library" first)',
    refLabel: 'Reference earlier atomic metrics:',
    noReferable: '(None. Add an atomic metric above first)',
    defaultExprName: 'Composite metric {n}',
    defaultDerivedName: 'Derived metric {n}',
    errLibraryEmpty: 'The dataset metric library is empty',
    errSelectReuse: 'Select a metric to reuse',
    errRefMissing: 'Reference {ref} does not exist',
    errNeedSource: 'Add an atomic or composite metric above as the reference source first',
    errSelectRef: 'Select a metric to reference',
  },
  theme: {
    mode: 'Mode',
    light: 'Light',
    dark: 'Dark',
    backgroundColor: 'Background color',
    textColor: 'Text color',
    palette: 'Series palette',
    reset: 'Reset',
    customPalette: 'Custom',
    restoreDefault: 'Restore defaults',
  },
  dataSource: {
    title: 'Data source',
    selectDataset: 'Select a dataset',
    emptyPrefix: 'No dataset yet, ',
    goUpload: 'go to Data sources to upload one',
  },
  builder: {
    displayOptions: 'Display options',
    displayCount: 'Display count',
    sortBy: 'Sort by',
    sortNone: 'No sorting',
    sortMetric: 'By metric',
    sortDim: 'By dimension',
    orderAsc: 'Ascending',
    orderDesc: 'Descending',
    chartNamePlaceholder: 'Chart name',
    save: 'Save chart',
    livePreview: ' - Live preview',
    refresh: 'Refresh',
    noMetric: 'No metrics',
    configureHint: 'Configure dimensions and metrics to preview the chart',
    chartType: 'Chart type',
    libraryMetric: 'Library metric',
    exprFormula: 'Composite formula {expr}',
    rowCount: 'Row count',
    errNameRequired: 'Enter a chart name',
    errDatasetRequired: 'Select a dataset',
    errMetricRequired: 'Add at least one metric',
    saved: 'Chart saved',
    updated: 'Chart updated',
  },
  list: {
    title: 'Charts',
    desc: 'Configure dimensions and metrics by dragging fields, with a live chart preview',
    create: 'New chart',
    statTotal: 'Total charts',
    statTypeCount: 'Chart types',
    statReferenced: 'Referenced by dashboards',
    listTitle: 'Chart list',
    searchPlaceholder: 'Search chart names',
    totalTag: '{n} in total',
    empty: 'No charts yet. Click "New chart" in the top right to start',
    colName: 'Name',
    colType: 'Chart type',
    colDatasource: 'Data source',
    invalid: 'Unavailable',
    colUpdatedAt: 'Updated',
    colActions: 'Actions',
    edit: 'Edit',
    preview: 'Preview',
    remove: 'Delete',
    previewTitle: 'Chart preview',
    deleteConfirm: 'Delete chart "{name}"?',
    deleteConfirmTitle: 'Confirm delete',
    deleteSuccess: 'Deleted',
  },
  schema: {
    style: {
      color: {
        label: 'Color',
      },
      fontSize: {
        label: 'Font size',
      },
      fontWeight: {
        label: 'Bold',
      },
      fontStyle: {
        label: 'Italic',
      },
      textDecoration: {
        label: 'Underline',
      },
    },
    styleTitle: {
      fontSize: {
        label: 'Font size',
      },
    },
    opt: {
      orient: {
        horizontal: {
          label: 'Horizontal',
          title: 'Horizontal',
        },
        vertical: {
          label: 'Vertical',
          title: 'Vertical',
        },
      },
      labelPos: {
        top: {
          label: 'Top',
          title: 'Top',
        },
        bottom: {
          label: 'Bottom',
          title: 'Bottom',
        },
        left: {
          label: 'Left',
          title: 'Left',
        },
        right: {
          label: 'Right',
          title: 'Right',
        },
        inside: {
          label: 'Inside',
          title: 'Inside',
        },
      },
      pieLabelPos: {
        outside: {
          label: 'Outside',
          title: 'Outside',
        },
        inside: {
          label: 'Inside',
          title: 'Inside',
        },
        center: {
          label: 'Center',
          title: 'Center',
        },
      },
    },
    cfg: {
      title: {
        label: 'Title',
        show: {
          label: 'Show',
        },
        text: {
          label: 'Title text',
          placeholder: 'Enter chart title',
        },
        subtext: {
          label: 'Subtitle',
          placeholder: 'Subtitle (optional)',
        },
        position: {
          label: 'Position',
        },
        textStyle: {
          label: 'Text style',
        },
      },
      legend: {
        label: 'Legend',
        show: {
          label: 'Show',
        },
        orient: {
          label: 'Orientation',
        },
        position: {
          label: 'Position',
        },
        align: {
          label: 'Alignment',
          options: {
            auto: {
              label: 'Auto',
              title: 'Auto align',
            },
            left: {
              label: 'Left',
              title: 'Align left',
            },
            center: {
              label: 'Center',
              title: 'Align center',
            },
            right: {
              label: 'Right',
              title: 'Align right',
            },
          },
        },
        icon: {
          label: 'Shape',
          options: {
            0: {
              label: 'Auto',
            },
            circle: {
              label: 'Circle',
            },
            rect: {
              label: 'Square',
            },
            roundRect: {
              label: 'Rounded rect',
            },
            diamond: {
              label: 'Diamond',
            },
            triangle: {
              label: 'Triangle',
            },
            pin: {
              label: 'Pin',
            },
          },
        },
        itemWidth: {
          label: 'Item width',
        },
        itemHeight: {
          label: 'Item height',
        },
        textStyle: {
          label: 'Text style',
        },
      },
      tooltip: {
        label: 'Tooltip',
        show: {
          label: 'Show',
        },
        trigger: {
          label: 'Trigger',
          options: {
            axis: {
              label: 'Axis',
            },
            item: {
              label: 'Item',
            },
            none: {
              label: 'None',
            },
          },
        },
        axisPointer: {
          label: 'Axis pointer type',
          type: {
            options: {
              line: {
                label: 'Line',
              },
              shadow: {
                label: 'Shadow',
              },
              none: {
                label: 'None',
              },
              cross: {
                label: 'Cross',
              },
            },
          },
        },
        formatter: {
          label: 'Content format',
          placeholder: "e.g. {'{'}a{'}'}{'{'}b{'}'}: {'{'}c{'}'}, leave blank for auto",
        },
        backgroundColor: {
          label: 'Background color',
        },
        borderColor: {
          label: 'Border color',
        },
        textStyle: {
          label: 'Text style',
        },
      },
      label: {
        label: 'Data label',
        show: {
          label: 'Show',
        },
        content: {
          label: 'Content',
          options: {
            a: {
              label: 'Series name',
            },
            b: {
              label: 'Category name',
            },
            c: {
              label: 'Value',
            },
          },
        },
        separator: {
          label: 'Separator',
          options: {
            space: {
              label: 'Space',
            },
            _2c_20: {
              label: 'Comma',
            },
            newline: {
              label: 'Newline',
            },
            _20_7c_20: {
              label: 'Pipe',
            },
          },
        },
        position: {
          label: 'Position',
        },
        textStyle: {
          label: 'Text style',
          color: {
            label: 'Color',
          },
        },
        showBorder: {
          label: 'Show border',
        },
        borderColor: {
          label: 'Border color',
        },
        allowOverlap: {
          label: 'Allow overlap',
        },
      },
      markLine: {
        label: 'Mark line',
        color: {
          label: 'Line color',
        },
        width: {
          label: 'Line width',
        },
        show: {
          label: 'Show',
        },
        type: {
          label: 'Type',
          options: {
            average: {
              label: 'Average',
            },
            max: {
              label: 'Max',
            },
            min: {
              label: 'Min',
            },
            median: {
              label: 'Median',
            },
            custom: {
              label: 'Custom',
            },
          },
        },
        customValue: {
          label: 'Custom value',
        },
        lineType: {
          label: 'Line style',
          options: {
            solid: {
              label: 'Solid',
            },
            dashed: {
              label: 'Dashed',
            },
            dotted: {
              label: 'Dotted',
            },
          },
        },
        showLabel: {
          label: 'Show label',
        },
      },
      grid: {
        label: 'Plot area',
        left: {
          label: 'Left margin',
        },
        right: {
          label: 'Right margin',
        },
        top: {
          label: 'Top margin',
        },
        bottom: {
          label: 'Bottom margin',
        },
      },
      dataZoom: {
        label: 'Data zoom',
        show: {
          label: 'Enable',
        },
        type: {
          label: 'Type',
          options: {
            slider: {
              label: 'Slider',
            },
            inside: {
              label: 'Inside',
            },
          },
        },
        startPercent: {
          label: 'Start %',
        },
        endPercent: {
          label: 'End %',
        },
      },
      xAxis: {
        label: 'X axis',
        show: {
          label: 'Show',
        },
        name: {
          label: 'Axis name',
        },
        nameTextStyle: {
          label: 'Text style',
        },
        labelColor: {
          label: 'Label color',
        },
        nameRotate: {
          label: 'Name rotation',
        },
        labelRotate: {
          label: 'Label rotation',
        },
      },
      yAxis: {
        label: 'Y axis',
        show: {
          label: 'Show',
        },
        name: {
          label: 'Axis name',
        },
        nameTextStyle: {
          label: 'Text style',
        },
        unit: {
          label: 'Unit',
          placeholder: 'e.g. USD, %',
        },
        labelColor: {
          label: 'Label color',
        },
        splitLine: {
          label: 'Grid lines',
        },
        min: {
          label: 'Min',
          placeholder: 'Auto or number',
        },
        max: {
          label: 'Max',
          placeholder: 'Auto or number',
        },
        interval: {
          label: 'Interval',
          placeholder: 'Auto or number',
        },
      },
    },
    type: {
      bar: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
        barGap: {
          label: 'Bar gap %',
        },
        rounded: {
          label: 'Rounded bars',
        },
      },
      barClustered: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
        barGap: {
          label: 'Bar gap %',
        },
        rounded: {
          label: 'Rounded bars',
        },
      },
      barStacked: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
        rounded: {
          label: 'Rounded bars',
        },
      },
      barLine: {
        lineSeries: {
          label: 'Line series',
        },
        smooth: {
          label: 'Smooth line',
        },
      },
      barPictorial: {
        symbolType: {
          label: 'Symbol type',
          options: {
            circle: {
              label: 'Circle',
            },
            rect: {
              label: 'Rect',
            },
            triangle: {
              label: 'Triangle',
            },
            diamond: {
              label: 'Diamond',
            },
          },
        },
      },
      barPercentStacked: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
        showPercentLabel: {
          label: 'Show percent labels',
        },
      },
      barGroupStacked: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
      },
      barStackedLine: {
        smooth: {
          label: 'Smooth line',
        },
      },
      barStackedPictorial: {
        symbolType: {
          label: 'Symbol type',
          options: {
            circle: {
              label: 'Circle',
            },
            rect: {
              label: 'Rect',
            },
          },
        },
      },
      bullet: {
        barWidth: {
          label: 'Bar width',
        },
        targetValue: {
          label: 'Target value',
        },
      },
      waterfall: {
        increaseColor: {
          label: 'Increase color',
        },
        decreaseColor: {
          label: 'Decrease color',
        },
      },
      pareto: {
        showLine: {
          label: 'Show cumulative line',
        },
      },
      horizontalBar: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
      },
      horizontalBarClustered: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
        barGap: {
          label: 'Bar gap %',
        },
      },
      horizontalBarStacked: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
      },
      horizontalBarPercentStacked: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
        showPercentLabel: {
          label: 'Show percent labels',
        },
      },
      horizontalBarGroupStacked: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
      },
      horizontalBullet: {
        barWidth: {
          label: 'Bar width',
        },
        targetValue: {
          label: 'Target value',
        },
      },
      butterfly: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
      },
      line: {
        smooth: {
          label: 'Smooth',
        },
        areaStyle: {
          label: 'Area fill',
        },
        step: {
          label: 'Step',
          options: {
            0: {
              label: 'None',
            },
            start: {
              label: 'Start',
            },
            middle: {
              label: 'Middle',
            },
            end: {
              label: 'End',
            },
          },
        },
      },
      lineMulti: {
        smooth: {
          label: 'Smooth',
        },
      },
      areaStacked: {
        smooth: {
          label: 'Smooth',
        },
        opacity: {
          label: 'Opacity',
        },
      },
      areaPercentStacked: {
        smooth: {
          label: 'Smooth',
        },
        opacity: {
          label: 'Opacity',
        },
      },
      pie: {
        radius: {
          label: 'Radius %',
        },
        startAngle: {
          label: 'Start angle',
        },
        labelPosition: {
          label: 'Label position',
        },
        roseType: {
          label: 'Rose mode',
        },
      },
      doughnut: {
        radiusInner: {
          label: 'Inner radius %',
        },
        radiusOuter: {
          label: 'Outer radius %',
        },
        startAngle: {
          label: 'Start angle',
        },
        labelPosition: {
          label: 'Label position',
        },
        showCenter: {
          label: 'Center text',
        },
        centerText: {
          label: 'Center title',
          placeholder: 'Leave blank to show the value',
        },
        centerSubtext: {
          label: 'Center subtitle',
          placeholder: 'Optional',
        },
        centerColor: {
          label: 'Title color',
        },
        centerSubColor: {
          label: 'Subtitle color',
        },
        centerFontSize: {
          label: 'Title font size',
        },
        centerSubFontSize: {
          label: 'Subtitle font size',
        },
      },
      sunburst: {
        radius: {
          label: 'Radius %',
        },
        startAngle: {
          label: 'Start angle',
        },
      },
      nightingale: {
        radius: {
          label: 'Radius %',
        },
        roseType: {
          label: 'Mode',
          options: {
            radius: {
              label: 'Radius',
            },
            area: {
              label: 'Area',
            },
          },
        },
      },
      funnel: {
        sort: {
          label: 'Sort',
          options: {
            descending: {
              label: 'Descending',
            },
            ascending: {
              label: 'Ascending',
            },
            none: {
              label: 'None',
            },
          },
        },
        gap: {
          label: 'Gap',
        },
      },
      funnelHorizontal: {
        sort: {
          label: 'Sort',
          options: {
            descending: {
              label: 'Descending',
            },
            ascending: {
              label: 'Ascending',
            },
            none: {
              label: 'None',
            },
          },
        },
        gap: {
          label: 'Gap',
        },
      },
      scatter: {
        symbolSize: {
          label: 'Symbol size',
        },
      },
      bubble: {
        symbolSize: {
          label: 'Max bubble size',
        },
      },
      progressBar: {
        max: {
          label: 'Max',
        },
        showTarget: {
          label: 'Show target',
        },
      },
      circularProgress: {
        max: {
          label: 'Max',
        },
        lineWidth: {
          label: 'Line width',
        },
      },
      multiRingProgress: {
        max: {
          label: 'Max',
        },
        lineWidth: {
          label: 'Line width',
        },
      },
      fluidProgress: {
        max: {
          label: 'Max',
        },
      },
      gauge: {
        min: {
          label: 'Min',
        },
        max: {
          label: 'Max',
        },
        splitNumber: {
          label: 'Split number',
        },
        progressWidth: {
          label: 'Progress width',
        },
      },
      statTrend: {
        showSparkline: {
          label: 'Show trend line',
        },
        sparklineColor: {
          label: 'Trend line color',
        },
      },
      radar: {
        shape: {
          label: 'Shape',
          options: {
            polygon: {
              label: 'Polygon',
            },
            circle: {
              label: 'Circle',
            },
          },
        },
        splitNumber: {
          label: 'Split number',
        },
        areaOpacity: {
          label: 'Area opacity',
        },
      },
      mapChina: {
        zoom: {
          label: 'Zoom',
        },
        showLabels: {
          label: 'Show region names',
        },
      },
      mapChinaBubble: {
        zoom: {
          label: 'Zoom',
        },
        symbolSize: {
          label: 'Bubble size',
        },
        showLabels: {
          label: 'Show region names',
        },
      },
      mapChinaSymbol: {
        zoom: {
          label: 'Zoom',
        },
        symbolSize: {
          label: 'Symbol size',
        },
      },
      mapWorld: {
        zoom: {
          label: 'Zoom',
        },
      },
      heatmap: {
        showValues: {
          label: 'Show values',
        },
      },
      polarBar: {
        barWidth: {
          label: 'Bar width',
          placeholder: 'Auto',
        },
      },
      barBreakAxis: {
        breakStart: {
          label: 'Break start',
        },
        breakEnd: {
          label: 'Break end',
        },
      },
      calendar: {
        cellSize: {
          label: 'Cell size',
        },
      },
      candlestick: {
        upColor: {
          label: 'Bullish color',
        },
        downColor: {
          label: 'Bearish color',
        },
      },
      treemap: {
        orient: {
          label: 'Orientation',
        },
      },
      sankey: {
        nodeWidth: {
          label: 'Node width',
        },
        nodeGap: {
          label: 'Node gap',
        },
        layoutIterations: {
          label: 'Layout iterations',
        },
      },
      chord: {
        nodeWidth: {
          label: 'Node width',
        },
        nodeGap: {
          label: 'Node gap',
        },
      },
    },
    series: {
      lineType: {
        label: 'Line style',
        options: {
          solid: {
            label: 'Solid',
          },
          dashed: {
            label: 'Dashed',
          },
          dotted: {
            label: 'Dotted',
          },
        },
      },
      lineColor: {
        label: 'Line color',
        placeholder: 'Leave blank to use the palette',
      },
      lineWidth: {
        label: 'Line width',
      },
      symbol: {
        label: 'Symbol',
        options: {
          circle: {
            label: 'Filled circle',
          },
          emptyCircle: {
            label: 'Hollow circle',
          },
          rect: {
            label: 'Rect',
          },
          roundRect: {
            label: 'Rounded rect',
          },
          diamond: {
            label: 'Diamond',
          },
          triangle: {
            label: 'Triangle',
          },
          none: {
            label: 'None',
          },
        },
      },
      symbolSize: {
        label: 'Symbol size',
      },
    },
  },
  palettes: {
    classicBlue: 'Classic blue',
    soft: 'Soft',
    vivid: 'Vivid',
    cool: 'Cool',
    warm: 'Warm',
    rainbow: 'Rainbow',
    business: 'Business',
    nature: 'Nature',
    tech: 'Tech',
    earth: 'Earth',
  },
}
