<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import CodeEditor from './CodeEditor.vue'
import * as echarts from 'echarts'
import { loadMonaco } from '@/utils/monacoCore'

// 用户自定义脚本通过 window.echarts 使用图表库（原挂在 main.js 入口，现按需注入）
window.echarts = echarts

const vHighlight = {
  async mounted(el: HTMLElement) {
    const lang = (el.getAttribute('data-lang') || 'javascript') as string
    const code = el.textContent || ''
    try {
      const monaco = await loadMonaco(['html', 'css', 'javascript'])
      monaco.editor.setTheme('vs-dark')
      el.innerHTML = await monaco.editor.colorize(code, lang, { tabSize: 2 })
    } catch {
      el.textContent = code
    }
  }
}

interface Template {
  name: string
  html: string
  css: string
  js: string
}

const templates: Template[] = [
  {
    name: 'Hello World 柱状图',
    html: `<div class="demo">
  <h2>Hello World</h2>
  <p>双击在这里编写HTML</p>
  <div class="chart-box"></div>
</div>`,
    css: `.demo {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: Arial, sans-serif;
}
h2 { margin: 0 0 8px; font-size: 28px; }
p { margin: 0 0 12px; font-size: 13px; opacity: 0.7; }
.chart-box {
  width: 80%;
  height: 200px;
  background: rgba(255,255,255,0.1);
  border-radius: 6px;
}`,
    js: `var chartBox = container.querySelector('.chart-box');
var labels = (data && data.labels) || [];
var values = (data && data.values) || [];
if (chartBox && values.length) {
  var chart = echarts.init(chartBox);
  chart.setOption({
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: [{ data: values, type: 'bar', itemStyle: { color: '#409eff' } }],
    grid: { left: 40, right: 20, top: 20, bottom: 30 }
  });
} else if (chartBox) {
  chartBox.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:13px;text-align:center;padding-top:80px;">请在右侧数据面板的静态数据中配置 labels / values</div>';
}`
  },
  {
    name: '数据卡片',
    html: `<div class="card-wrap">
  <div class="card">
    <div class="card-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>
    </div>
    <div class="card-info"><div class="card-label">今日访问</div><div class="card-value">12,846</div><div class="card-change up">+12.5%</div></div>
  </div>
  <div class="card">
    <div class="card-icon" style="background:linear-gradient(135deg,#a855f7,#6366f1)">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
    <div class="card-info"><div class="card-label">活跃用户</div><div class="card-value">3,284</div><div class="card-change up">+8.2%</div></div>
  </div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; }
.card-wrap {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 20px; padding: 20px;
}
.card {
  flex: 1; max-width: 220px; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;
  display: flex; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,0.08);
}
.card-icon {
  width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.card-icon svg { width: 22px; height: 22px; }
.card-label { font-size: 12px; color: #889; margin-bottom: 4px; }
.card-value { font-size: 22px; font-weight: bold; color: #e0e0ff; }
.card-change { font-size: 11px; margin-top: 2px; }
.card-change.up { color: #00f2fe; }
.card-change.down { color: #ff6b6b; }`,
    js: ``
  },
  {
    name: '轮播排名榜',
    html: `<div class="rank-wrap">
  <div class="rank-header"><span>实时销量排行</span><span class="rank-tag">LIVE</span></div>
  <div class="rank-list" id="rankList"></div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; font-family: Arial, sans-serif; }
.rank-wrap { width: 100%; height: 100%; padding: 16px; display: flex; flex-direction: column; }
.rank-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
  font-size: 14px; color: #e0e0ff; font-weight: bold;
}
.rank-tag {
  font-size: 10px; background: #ff4757; color: #fff; padding: 2px 8px; border-radius: 10px;
  animation: blink 1.5s infinite;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.rank-list { flex: 1; overflow: hidden; position: relative; }
.rank-item {
  display: flex; align-items: center; padding: 6px 0; gap: 10px;
  animation: slideUp 0.3s ease-out;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.rank-num {
  width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: bold; color: #fff; flex-shrink: 0;
}
.rank-num.top { background: linear-gradient(135deg, #ff6b6b, #ffa502); }
.rank-num.normal { background: rgba(255,255,255,0.1); color: #889; }
.rank-name { flex: 1; font-size: 13px; color: #c0c0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-bar-wrap { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.rank-bar { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #4facfe, #00f2fe); transition: width 0.6s ease; }
.rank-val { font-size: 12px; color: #4facfe; font-weight: bold; width: 40px; text-align: right; }`,
    js: `var list = [
  { name: 'iPhone 16 Pro', value: 9860 },
  { name: 'MacBook Air M4', value: 7520 },
  { name: 'iPad Pro 13"', value: 6230 },
  { name: 'AirPods Pro 3', value: 5810 },
  { name: 'Apple Watch Ultra', value: 4390 },
  { name: 'Vision Pro', value: 3200 },
  { name: 'HomePod mini', value: 2860 },
  { name: 'Magic Keyboard', value: 1940 }
];
var maxVal = Math.max.apply(null, list.map(function(i){return i.value}));
var el = container.querySelector('#rankList');
var idx = 0;
function render() {
  var html = '';
  var show = [list[idx%list.length], list[(idx+1)%list.length], list[(idx+2)%list.length], list[(idx+3)%list.length]];
  show.forEach(function(item, i) {
    var pct = Math.round(item.value / maxVal * 100);
    html += '<div class="rank-item">' +
      '<span class="rank-num '+(i<1?'top':'normal')+'">'+(i+1)+'</span>' +
      '<span class="rank-name">'+item.name+'</span>' +
      '<div class="rank-bar-wrap"><div class="rank-bar" style="width:'+pct+'%"></div></div>' +
      '<span class="rank-val">'+item.value+'</span></div>';
  });
  el.innerHTML = html;
  idx++;
}
render();
setInterval(render, 3000);`
  },
  {
    name: '科技感边框',
    html: `<div class="tech-box">
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div class="tech-title">系统监控</div>
  <div class="tech-value">99.97<span>%</span></div>
  <div class="tech-sub">运行稳定性</div>
  <div class="tech-bar"><div class="tech-bar-fill"></div></div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; display: flex; align-items: center; justify-content: center; height: 100vh; }
.tech-box {
  position: relative; width: 80%; max-width: 280px; padding: 28px 20px;
  background: rgba(79,172,254,0.04); border: 1px solid rgba(79,172,254,0.2);
  text-align: center; clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
}
.corner {
  position: absolute; width: 12px; height: 12px;
}
.corner.tl { top: 0; left: 0; border-top: 2px solid #4facfe; border-left: 2px solid #4facfe; }
.corner.tr { top: 0; right: 0; border-top: 2px solid #4facfe; border-right: 2px solid #4facfe; }
.corner.bl { bottom: 0; left: 0; border-bottom: 2px solid #4facfe; border-left: 2px solid #4facfe; }
.corner.br { bottom: 0; right: 0; border-bottom: 2px solid #4facfe; border-right: 2px solid #4facfe; }
.tech-title { font-size: 12px; color: #4facfe; letter-spacing: 4px; margin-bottom: 12px; text-transform: uppercase; }
.tech-value { font-size: 36px; font-weight: bold; color: #e0e0ff; line-height: 1; }
.tech-value span { font-size: 16px; color: #4facfe; }
.tech-sub { font-size: 11px; color: #889; margin: 8px 0 14px; }
.tech-bar { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
.tech-bar-fill {
  height: 100%; width: 99.97%; border-radius: 2px;
  background: linear-gradient(90deg, #4facfe, #00f2fe);
  animation: glow 2s ease-in-out infinite alternate;
}
@keyframes glow { from { box-shadow: 0 0 4px #4facfe; } to { box-shadow: 0 0 12px #00f2fe; } }`,
    js: ``
  },
  {
    name: '动态时钟',
    html: `<div class="clock-wrap">
  <div class="clock-date" id="date"></div>
  <div class="clock-time" id="time"></div>
  <div class="clock-sec" id="sec"></div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; }
.clock-wrap {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; font-family: 'Courier New', monospace;
}
.clock-date { font-size: 13px; color: #889; letter-spacing: 2px; margin-bottom: 8px; }
.clock-time {
  font-size: 48px; font-weight: bold; color: #e0e0ff;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  letter-spacing: 4px;
}
.clock-sec { font-size: 14px; color: #4facfe; margin-top: 4px; letter-spacing: 2px; }`,
    js: `function pad(n) { return n < 10 ? '0' + n : n; }
var days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
function tick() {
  var now = new Date();
  container.querySelector('#time').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  container.querySelector('#date').textContent = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日 ' + days[now.getDay()];
  container.querySelector('#sec').textContent = '> system running ' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
}
tick();
setInterval(tick, 1000);`
  },
  {
    name: '环形进度环',
    html: `<div class="ring-wrap">
  <div class="ring" id="ring">
    <div class="ring-inner"><span id="ringVal">72%</span></div>
  </div>
  <div class="ring-label">磁盘使用率</div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; }
.ring-wrap {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.ring {
  width: 150px; height: 150px; border-radius: 50%;
  background: conic-gradient(#4facfe 0% 72%, rgba(255,255,255,0.08) 72% 100%);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  animation: ringGlow 2.4s ease-in-out infinite alternate;
}
@keyframes ringGlow {
  from { box-shadow: 0 0 8px rgba(79,172,254,0.3); }
  to { box-shadow: 0 0 22px rgba(0,242,254,0.6); }
}
.ring-inner {
  width: 108px; height: 108px; border-radius: 50%;
  background: #0f0f2e; display: flex; align-items: center; justify-content: center;
}
.ring-inner span { font-size: 26px; font-weight: bold; color: #e0e0ff; }
.ring-label { margin-top: 14px; font-size: 12px; color: #889; letter-spacing: 2px; }`,
    js: `var val = 72;
var el = container.querySelector('#ring');
var txt = container.querySelector('#ringVal');
function setVal(v) {
  val = Math.max(0, Math.min(100, v));
  el.style.background = 'conic-gradient(#4facfe 0% ' + val + '%, rgba(255,255,255,0.08) ' + val + '% 100%)';
  txt.textContent = val + '%';
}
setVal(val);
setInterval(function () { setVal(val + Math.round((Math.random() - 0.5) * 6)); }, 2000);`
  },
  {
    name: '3D翻转卡片',
    html: `<div class="flip-scene">
  <div class="flip-card">
    <div class="flip-face front">
      <div class="fc-title">系统状态</div>
      <div class="fc-icon">SYS</div>
      <div class="fc-sub">hover to flip</div>
    </div>
    <div class="flip-face back">
      <div class="fc-row"><span>CPU</span><b>62%</b></div>
      <div class="fc-row"><span>MEM</span><b>78%</b></div>
      <div class="fc-row"><span>NET</span><b>1.2G</b></div>
    </div>
  </div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; }
.flip-scene {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  perspective: 900px;
}
.flip-card {
  width: 220px; height: 260px; position: relative;
  transform-style: preserve-3d; transition: transform 0.7s ease;
}
.flip-scene:hover .flip-card { transform: rotateY(180deg); }
.flip-face {
  position: absolute; inset: 0; border-radius: 14px; backface-visibility: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 1px solid rgba(79,172,254,0.35);
  background: linear-gradient(135deg, rgba(79,172,254,0.12), rgba(0,242,254,0.05));
}
.flip-face.back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, #1a2a6c, #0f0f2e);
}
.fc-title { font-size: 14px; color: #4facfe; letter-spacing: 4px; margin-bottom: 12px; }
.fc-icon {
  width: 72px; height: 72px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: bold; color: #00f2fe;
  border: 2px solid #00f2fe; box-shadow: 0 0 18px rgba(0,242,254,0.4);
}
.fc-sub { margin-top: 14px; font-size: 11px; color: #889; }
.fc-row {
  width: 120px; display: flex; justify-content: space-between;
  font-size: 13px; color: #c0c8dc; padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,0.12);
}
.fc-row:last-child { border-bottom: none; }
.fc-row b { color: #00f2fe; }`,
    js: ``
  },
  {
    name: '雷达扫描',
    html: `<div class="radar-wrap">
  <div class="radar-circle c1"></div>
  <div class="radar-circle c2"></div>
  <div class="radar-circle c3"></div>
  <div class="radar-line lh"></div>
  <div class="radar-line lv"></div>
  <div class="radar-sweep"></div>
  <div class="radar-dot d1"></div>
  <div class="radar-dot d2"></div>
  <div class="radar-dot d3"></div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f2e; }
.radar-wrap {
  width: 260px; height: 260px; position: relative; margin: 0 auto;
  border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle, rgba(79,172,254,0.1) 0%, rgba(15,15,46,0.6) 70%);
  border: 1px solid rgba(79,172,254,0.4);
}
.radar-circle {
  position: absolute; border-radius: 50%;
  border: 1px solid rgba(79,172,254,0.35);
}
.c1 { inset: 8%; } .c2 { inset: 26%; } .c3 { inset: 44%; }
.radar-line { position: absolute; background: rgba(79,172,254,0.35); }
.lh { left: 0; right: 0; top: 50%; height: 1px; }
.lv { top: 0; bottom: 0; left: 50%; width: 1px; }
.radar-sweep {
  position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(0,242,254,0.45), transparent 70deg, transparent 360deg);
  animation: sweep 3s linear infinite;
}
@keyframes sweep { to { transform: rotate(360deg); } }
.radar-dot {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  background: #00f2fe; box-shadow: 0 0 10px #00f2fe;
  animation: blink 1.8s ease-in-out infinite;
}
.d1 { top: 22%; left: 30%; } .d2 { top: 44%; left: 64%; } .d3 { top: 70%; left: 38%; }
@keyframes blink { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }`,
    js: ``
  }
]

const DEFAULT_HTML = templates[0].html
const DEFAULT_CSS = templates[0].css
const DEFAULT_JS = templates[0].js

const props = defineProps<{
  visible: boolean
  html: string
  css: string
  js: string
  data: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'update:html', val: string): void
  (e: 'update:css', val: string): void
  (e: 'update:js', val: string): void
  (e: 'save', val: { html: string; css: string; js: string }): void
}>()

const editorKey = ref(0)
const localHtml = ref(DEFAULT_HTML)
const localCss = ref(DEFAULT_CSS)
const localJs = ref(DEFAULT_JS)
const previewKey = ref(0)
const previewHtml = ref('')
const helpVisible = ref(false)
const previewHeight = ref(200)
const selectedTemplate = ref(0)
let previewTimer: ReturnType<typeof setTimeout> | null = null
let dragStartY = 0
let dragStartHeight = 0

function loadTemplate(idx: number) {
  selectedTemplate.value = idx
  const t = templates[idx]
  localHtml.value = t.html
  localCss.value = t.css
  localJs.value = t.js
  editorKey.value++
  updatePreview()
}

function onSplitDragStart(e: MouseEvent) {
  e.preventDefault()
  dragStartY = e.clientY
  dragStartHeight = previewHeight.value
  document.addEventListener('mousemove', onSplitDragMove)
  document.addEventListener('mouseup', onSplitDragEnd)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function onSplitDragMove(e: MouseEvent) {
  const delta = dragStartY - e.clientY
  const newHeight = Math.max(80, Math.min(dragStartHeight + delta, 600))
  previewHeight.value = newHeight
}

function onSplitDragEnd() {
  document.removeEventListener('mousemove', onSplitDragMove)
  document.removeEventListener('mouseup', onSplitDragEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function resolvePreviewData(raw: any): any {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw && 'type' in raw) {
    const v = raw.value
    if (typeof v === 'string') {
      try {
        return JSON.parse(v)
      } catch {
        return v
      }
    }
    return v ?? null
  }
  return raw ?? null
}

function buildPreviewHtml() {
  const previewData = resolvePreviewData(props.data)
  const dataJson = JSON.stringify(previewData ?? null).replace(/<\/script>/gi, '<\\/script>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/echarts.min.js"><\/script><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;width:100%;height:100%;overflow:auto}
${localCss.value || ''}
</style></head><body>
${localHtml.value || ''}
<script>(function(container, echarts, data){${localJs.value || ''}})(document.body, window.echarts, ${dataJson});<\/script>
</body></html>`
}

function updatePreview() {
  previewHtml.value = buildPreviewHtml()
  previewKey.value++
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(updatePreview, 800)
}

watch(() => props.visible, (v) => {
  if (v) {
    localHtml.value = props.html || DEFAULT_HTML
    localCss.value = props.css || DEFAULT_CSS
    localJs.value = props.js || DEFAULT_JS
    editorKey.value++
    updatePreview()
  }
})

watch(() => props.data, () => {
  if (props.visible) updatePreview()
}, { deep: true })

function handleSave() {
  emit('update:html', localHtml.value)
  emit('update:css', localCss.value)
  emit('update:js', localJs.value)
  emit('save', { html: localHtml.value, css: localCss.value, js: localJs.value })
  emit('update:visible', false)
}

function openPreviewWindow() {
  const html = buildPreviewHtml()
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  }
}

onUnmounted(() => {
  if (previewTimer) clearTimeout(previewTimer)
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    width="95vw"
    :close-on-click-modal="false"
    destroy-on-close
    top="3vh"
    class="code-edit-fs"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">自定义组件代码编辑</span>
        <el-select v-model="selectedTemplate" size="default" placeholder="选择模板" style="width: 160px" @change="loadTemplate">
          <el-option v-for="(t, i) in templates" :key="i" :label="t.name" :value="i" />
        </el-select>
      </div>
    </template>
    <div class="code-dialog-body">
      <div class="editors-row">
        <div class="editor-col">
          <div class="col-header html-header">HTML</div>
          <CodeEditor :key="'html-' + editorKey" :model-value="localHtml" @update:model-value="localHtml = $event; schedulePreview()" language="html" height="100%" />
        </div>
        <div class="editor-col">
          <div class="col-header css-header">CSS</div>
          <CodeEditor :key="'css-' + editorKey" :model-value="localCss" @update:model-value="localCss = $event; schedulePreview()" language="css" height="100%" />
        </div>
        <div class="editor-col">
          <div class="col-header js-header">JavaScript</div>
          <CodeEditor :key="'js-' + editorKey" :model-value="localJs" @update:model-value="localJs = $event; schedulePreview()" language="javascript" height="100%" />
        </div>
      </div>
      <div class="split-bar" @mousedown="onSplitDragStart">
        <div class="split-bar-line"></div>
      </div>
      <div class="preview-section" :style="{ height: previewHeight + 'px' }">
        <div class="preview-toolbar">
          <span class="preview-label">实时预览</span>
          <el-button size="default" text @click="openPreviewWindow">
            <el-icon><View /></el-icon> 在新窗口中预览
          </el-button>
          <el-button size="default" type="primary" @click="helpVisible = true">
            <el-icon><QuestionFilled /></el-icon> 帮助文档
          </el-button>
        </div>
        <iframe :key="previewKey" :srcdoc="previewHtml" class="preview-iframe"></iframe>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>

    <!-- 帮助文档弹窗 -->
    <el-dialog v-model="helpVisible" title="自定义组件开发帮助" width="800px" :close-on-click-modal="false" destroy-on-close top="5vh">
      <div class="help-content">
        <h3>可用变量</h3>
        <p>在 JavaScript 编辑器中，你可以直接使用以下变量：</p>
        <table class="help-table">
          <thead><tr><th>变量名</th><th>类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td><code>container</code></td><td>HTMLElement</td><td>组件容器DOM元素，你的内容会渲染在此元素内</td></tr>
            <tr><td><code>echarts</code></td><td>Object</td><td>ECharts实例，可直接调用 <code>echarts.init()</code></td></tr>
            <tr><td><code>data</code></td><td>Object|Null</td><td>API数据绑定返回的数据，未绑定时为 null</td></tr>
          </tbody>
        </table>

        <h3>示例1：基础柱状图</h3>
        <pre v-highlight data-lang="javascript" class="help-code">var chart = echarts.init(container.querySelector('#myChart'));
chart.setOption({
  xAxis: { type: 'category', data: ['Mon','Tue','Wed','Thu','Fri'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [120,200,150,80,70], itemStyle: { color: '#409eff' } }]
});
window.addEventListener('resize', () => chart.resize());</pre>

        <h3>示例2：折线图</h3>
        <pre v-highlight data-lang="javascript" class="help-code">var chart = echarts.init(container.querySelector('#myChart'));
chart.setOption({
  xAxis: { type: 'category', data: ['1月','2月','3月','4月','5月','6月'] },
  yAxis: { type: 'value' },
  series: [{
    type: 'line', smooth: true, data: [820,932,901,934,1290,1330],
    areaStyle: { opacity: 0.3 }, lineStyle: { width: 3 }
  }]
});
window.addEventListener('resize', () => chart.resize());</pre>

        <h3>示例3：饼图</h3>
        <pre v-highlight data-lang="javascript" class="help-code">var chart = echarts.init(container.querySelector('#myChart'));
chart.setOption({
  series: [{
    type: 'pie', radius: '60%',
    data: [
      { value: 1048, name: '搜索引擎' },
      { value: 735, name: '直接访问' },
      { value: 580, name: '邮件营销' },
      { value: 484, name: '联盟广告' }
    ]
  }]
});
window.addEventListener('resize', () => chart.resize());</pre>

        <h3>示例4：使用API数据</h3>
        <pre v-highlight data-lang="javascript" class="help-code">// data 来自右侧面板「数据绑定」配置的API返回值
if (data && data.list) {
  var chart = echarts.init(container.querySelector('#myChart'));
  var names = data.list.map(item => item.name);
  var values = data.list.map(item => item.value);
  chart.setOption({
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: values }]
  });
  window.addEventListener('resize', () => chart.resize());
}</pre>

        <h3>示例5：纯HTML/CSS内容（不使用ECharts）</h3>
        <pre v-highlight data-lang="html" class="help-code">&lt;!-- HTML编辑器 --&gt;
&lt;div class="card"&gt;
  &lt;div class="title"&gt;系统状态&lt;/div&gt;
  &lt;div class="value"&gt;运行中&lt;/div&gt;
&lt;/div&gt;

/* CSS编辑器 */
.card {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px; color: #fff;
}
.title { font-size: 14px; opacity: 0.8; margin-bottom: 8px; }
.value { font-size: 32px; font-weight: bold; }

/* JS编辑器留空即可 */</pre>

        <h3>示例6：动态数据与定时更新</h3>
        <pre v-highlight data-lang="javascript" class="help-code">var chart = echarts.init(container.querySelector('#myChart'));
function update() {
  var data = Array.from({length: 5}, () => Math.round(Math.random() * 200));
  chart.setOption({
    xAxis: { type: 'category', data: ['A','B','C','D','E'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data, itemStyle: { color: '#67c23a' } }]
  });
}
update();
setInterval(update, 3000);
window.addEventListener('resize', () => chart.resize());</pre>

        <h3>注意事项</h3>
        <ul class="help-list">
          <li>使用 <code>container.querySelector()</code> 获取容器内的DOM元素</li>
          <li>ECharts 图表需要设置容器宽高，HTML编辑器中建议使用 <code>width:100%;height:100%</code></li>
          <li>务必监听 <code>window resize</code> 事件调用 <code>chart.resize()</code></li>
          <li>不要使用 <code>document.querySelector</code>，请使用 <code>container.querySelector</code></li>
          <li>API数据绑定：在右侧面板「数据」→「数据绑定」中配置API地址，返回的数据通过 <code>data</code> 变量访问</li>
        </ul>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<style>
/* 全局样式：dialog被teleport到body，scoped无法命中 */
.code-edit-fs {
  height: 90vh !important;
  display: flex !important;
  flex-direction: column !important;
}
.code-edit-fs .el-dialog__header {
  flex-shrink: 0;
  margin-right: 0;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #e4e7ed;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.code-edit-fs .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.code-edit-fs .el-dialog__footer {
  flex-shrink: 0;
}
.help-content {
  max-height: 65vh;
  overflow-y: auto;
  line-height: 1.7;
  color: #303133;
}
.help-content h3 {
  margin: 20px 0 8px;
  font-size: 15px;
  color: #303133;
  border-left: 3px solid #409eff;
  padding-left: 10px;
}
.help-content h3:first-child { margin-top: 0; }
.help-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 8px 0 16px;
}
.help-table th,
.help-table td {
  border: 1px solid #e4e7ed;
  padding: 8px 12px;
  text-align: left;
}
.help-table th { background: #f5f7fa; font-weight: 600; }
.help-code {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  margin: 8px 0 12px;
  font-family: 'Consolas', 'Monaco', monospace;
}
.help-list {
  padding-left: 20px;
  margin: 8px 0;
}
.help-list li { margin: 6px 0; font-size: 13px; }
.help-content code {
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  color: #c41d7f;
}
</style>

<style scoped>
.code-dialog-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editors-row {
  display: flex;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.editor-col {
  flex: 1;
  min-width: 0;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.col-header {
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.html-header { background: #e44d26; }
.css-header { background: #264de4; }
.js-header { background: #f0db4f; color: #333; }

.split-bar {
  height: 10px;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.split-bar:hover .split-bar-line,
.split-bar:active .split-bar-line {
  background: #409eff;
}

.split-bar-line {
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: #dcdfe6;
  transition: background 0.15s;
}

.split-bar:hover {
  background: rgba(64, 158, 255, 0.06);
}

.preview-section {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f5f7fa;
  padding: 4px 12px;
  border-bottom: 1px solid #e4e7ed;
}

.preview-label {
  font-size: 12px;
  color: #909399;
  margin-right: auto;
}

.preview-iframe {
  width: 100%;
  height: calc(100% - 33px);
  border: none;
  background: #1a1a2e;
}
</style>
