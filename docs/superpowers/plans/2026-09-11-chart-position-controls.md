# 图表配置 Panel 位置/方向控件图标化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图表编辑面板中全部位置/方向下拉改为 Element Plus 图标按钮组并按配置组一行显示，标题默认字号改为 16，图例「形状」下拉宽度固定为 100px。

**Architecture:** 控件形态完全由前端 schema（`chart-configs.js`）与渲染组件（`SchemaControl.vue`/`SchemaForm.vue`）决定；配置数据键（`left`/`top`/`orient`/`position`/`labelPosition`）保持不变，已存图表配置不受影响。新图标复用 `@element-plus/icons-vue`，通过 `buttonGroup` 的 `icon` 字段以 Vue 组件形式渲染；`row`/`separator` 标志控制行内布局与分隔线。

**Tech Stack:** Vue 3 + Element Plus 2.10.4（全量注册，`el-icon` 全局可用）+ ECharts 6.1 + Vite 8。无单元测试框架，验证方式 = `vite build` + Playwright e2e（`e2e-config-panel.cjs`）+ 人工浏览器检查。

**Spec:** `docs/superpowers/specs/2026-09-11-chart-position-controls-design.md`

---

## File Structure

| 文件 | 职责 | 改动 |
|---|---|---|
| `front-end/src/components/charts/SchemaControl.vue` | 单一控件渲染 | buttonGroup 支持 Vue 图标组件；select 支持 `selectWidth` |
| `front-end/src/components/charts/SchemaForm.vue` | 表单布局编排 | row-group 支持 `separator` 分隔线与 `selectWidth` 固定宽度字段 |
| `front-end/src/config/chart-configs.js` | 配置 schema | 建图标常量；9 个 select→buttonGroup；新增 `STYLE_TITLE`；图例形状 `selectWidth:100` |
| `front-end/src/components/charts/EChartRenderer.vue` | ECharts option 生成 | 标题回退字号 `?? 14`→`?? 16` |
| `front-end/scripts/e2e-config-panel.cjs` | 回归测试 | 无需改动（已验证：图例「形状」仍为 select，选择器仍命中） |

---

## Task 1: SchemaControl 支持图标组件 buttonGroup 与 select 宽度

**验证前置**：本项目无单测框架，本任务验证 = `vite build` 通过（改动为纯渲染能力扩展，未接线 schema 前 UI 不变）。

**Files:**
- Modify: `front-end/src/components/charts/SchemaControl.vue:94-106`（buttonGroup 分支）
- Modify: `front-end/src/components/charts/SchemaControl.vue:54-72`（select 分支）

- [ ] **Step 1: 改造 buttonGroup 分支**

将 `SchemaControl.vue` 第 94-106 行替换为：

```html
  <el-button-group v-else-if="field.type === 'buttonGroup'">
    <el-button
      v-for="opt in field.options || []"
      :key="opt.value"
      :type="value === opt.value ? 'primary' : 'default'"
      size="small"
      @click="emit('change', opt.value)"
      :title="opt.title || opt.label"
      class="glyph-btn"
    >
      <el-icon v-if="typeof opt.icon === 'object'" :size="14">
        <component :is="opt.icon" />
      </el-icon>
      <span v-else :style="decoStyle(opt.value)" v-html="opt.icon || opt.label"></span>
    </el-button>
  </el-button-group>
```

说明：`opt.icon` 为组件对象（EP 图标）时用 `<el-icon>` 渲染；为字符串字形/无图标时走 `v-html` 回退（兼容现有 `align` 组）。

- [ ] **Step 2: 改造 select 分支支持固定宽度**

将 `SchemaControl.vue` 第 64 行 `style="width: 100%"` 改为：

```html
    :style="field.selectWidth ? 'width: ' + field.selectWidth + 'px' : 'width: 100%'"
```

- [ ] **Step 3: 追加紧凑图标按钮样式**

在 `SchemaControl.vue` 文件末尾（`</script>` 之后）追加：

```css
<style scoped>
.glyph-btn {
  min-width: 24px;
  padding: 3px 4px;
}
</style>
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功，输出 `vite v8.x.x building for production...` 与构建产物，无报错。

- [ ] **Step 5: Commit**

```bash
git add front-end/src/components/charts/SchemaControl.vue
git commit -m "feat: support component icons in buttonGroup and fixed select width"
```

---

## Task 2: SchemaForm 行内分隔线与固定宽度字段

**Files:**
- Modify: `front-end/src/components/charts/SchemaForm.vue:5-16`（row-group 模板）
- Modify: `front-end/src/components/charts/SchemaForm.vue:244-262`（样式区）

- [ ] **Step 1: row-group 模板加分隔线与 fixed 类**

将 `SchemaForm.vue` 第 5-16 行替换为：

```html
      <!-- One-line group: consecutive row-flagged fields laid out horizontally -->
      <div v-if="unit.type === 'row'" class="row-group">
        <div
          v-for="f in unit.fields"
          :key="f.key"
          class="row-field"
          :class="{ 'is-fixed': f.field.selectWidth }"
        >
          <span v-if="f.field.separator" class="row-sep" />
          <span class="row-field-label">{{ f.field.label }}</span>
          <Control
            :field="f.field"
            :value="getModelValue(f.key)"
            :compact="true"
            fluid
            @change="(v) => setModelValue(f.key, v)"
          />
        </div>
      </div>
```

说明：`separator: true` 的字段前渲染分隔线；带 `selectWidth` 的字段（图例「形状」）在行内固定宽度、不参与 flex 伸缩，保证下拉正好 100px。

- [ ] **Step 2: 追加样式**

在 `SchemaForm.vue` 的 `<style scoped>` 内、`.row-field-label` 规则之后追加：

```css
.row-group .row-sep {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  background: var(--el-border-color-lighter, #ebeef5);
  margin: 0 2px;
}
.row-group .row-field.is-fixed {
  flex: 0 0 auto;
}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错（schema 未接线，UI 无视觉变化）。

- [ ] **Step 4: Commit**

```bash
git add front-end/src/components/charts/SchemaForm.vue
git commit -m "feat: support separator and fixed-width fields in one-line rows"
```

---

## Task 3: 图例形状下拉宽度 + 标题默认字号 16

**Files:**
- Modify: `front-end/src/config/chart-configs.js:6-11`（新增 `STYLE_TITLE`）
- Modify: `front-end/src/config/chart-configs.js:29`（title.textStyle 引用）
- Modify: `front-end/src/config/chart-configs.js:59-69`（legend.icon 加 `selectWidth`）
- Modify: `front-end/src/components/charts/EChartRenderer.vue:232`

- [ ] **Step 1: 新增 `STYLE_TITLE`**

在 `chart-configs.js` 第 6-11 行 `STYLE_TEXT` 定义之后追加：

```js
// 标题专用文字样式：默认字号 16，其余与通用样式一致
const STYLE_TITLE = {
  ...STYLE_TEXT,
  fontSize: { type: 'number', label: '字号', default: 16, min: 8, max: 40 },
}
```

- [ ] **Step 2: title.textStyle 改用 STYLE_TITLE**

`chart-configs.js` 第 29 行：

```js
      textStyle: { type: 'group', label: '文字样式', inline: true, children: STYLE_TITLE },
```

- [ ] **Step 3: 图例形状下拉固定宽度 100px**

`chart-configs.js` 第 60 行 `icon` 字段定义中 `row: true` 后追加 `selectWidth: 100`：

```js
      icon: {
        type: 'select', label: '形状', row: true, selectWidth: 100, default: '', options: [
```

- [ ] **Step 4: EChartRenderer 标题回退字号 16**

`EChartRenderer.vue` 第 232 行：

```js
          fontSize: config.title.textStyle?.fontSize ?? 16,
```

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错。

- [ ] **Step 6: Commit**

```bash
git add front-end/src/config/chart-configs.js front-end/src/components/charts/EChartRenderer.vue
git commit -m "feat: title default font size 16 and fixed legend shape dropdown width 100px"
```

---

## Task 4: 位置/方向下拉 → 图标按钮组

**Files:**
- Modify: `front-end/src/config/chart-configs.js`（import + 常量 + 9 处字段）

- [ ] **Step 1: 引入 EP 图标并定义共享选项常量**

在 `chart-configs.js` 顶部 `color-palettes` import 之后追加：

```js
import {
  Aim, ArrowDown, ArrowDownBold, ArrowLeft, ArrowLeftBold,
  ArrowRight, ArrowRightBold, ArrowUp, ArrowUpBold, Expand, Fold, Position,
} from '@element-plus/icons-vue'
```

在 `STYLE_TITLE` 定义之后追加：

```js
// ---- 图标按钮组共享选项（位置/方向） ----
const H_POS_OPTIONS = [
  { label: '左', title: '左', value: 'left', icon: ArrowLeftBold },
  { label: '中', title: '居中', value: 'center', icon: Aim },
  { label: '右', title: '右', value: 'right', icon: ArrowRightBold },
]
const V_POS_OPTIONS = [
  { label: '上', title: '顶', value: 'top', icon: ArrowUpBold },
  { label: '中', title: '中部', value: 'middle', icon: Aim },
  { label: '下', title: '底', value: 'bottom', icon: ArrowDownBold },
]
const ORIENT_OPTIONS = [
  { label: '水平', title: '水平', value: 'horizontal', icon: ArrowRightBold },
  { label: '垂直', title: '垂直', value: 'vertical', icon: ArrowDownBold },
]
const LABEL_POS_OPTIONS = [
  { label: '上', title: '上', value: 'top', icon: ArrowUp },
  { label: '下', title: '下', value: 'bottom', icon: ArrowDown },
  { label: '左', title: '左', value: 'left', icon: ArrowLeft },
  { label: '右', title: '右', value: 'right', icon: ArrowRight },
  { label: '内', title: '内', value: 'inside', icon: Position },
]
const PIE_LABEL_POS_OPTIONS = [
  { label: '外', title: '外', value: 'outside', icon: Expand },
  { label: '内', title: '内', value: 'inside', icon: Fold },
  { label: '居中', title: '居中', value: 'center', icon: Aim },
]
```

- [ ] **Step 2: title 水平/垂直位置（L19-28）**

替换为：

```js
      left: { type: 'buttonGroup', label: '水平', row: true, default: 'center', options: H_POS_OPTIONS },
      top: { type: 'buttonGroup', label: '垂直', row: true, separator: true, default: 'top', options: V_POS_OPTIONS },
```

- [ ] **Step 3: legend 方向/水平/垂直（L35-49）**

替换为：

```js
      orient: { type: 'buttonGroup', label: '方向', row: true, default: 'horizontal', options: ORIENT_OPTIONS },
      left: { type: 'buttonGroup', label: '水平', row: true, default: 'center', options: H_POS_OPTIONS },
      top: { type: 'buttonGroup', label: '垂直', row: true, separator: true, default: 'bottom', options: V_POS_OPTIONS },
```

- [ ] **Step 4: 坐标轴标签位置（L113-118）**

替换为：

```js
      position: { type: 'buttonGroup', label: '位置', default: 'top', options: LABEL_POS_OPTIONS },
```

- [ ] **Step 5: 饼图/环形图标签位置（L304-308、L315-319）**

两处均替换为：

```js
    labelPosition: { type: 'buttonGroup', label: '标签位置', default: 'outside', options: PIE_LABEL_POS_OPTIONS },
```

- [ ] **Step 6: treemap 方向（L438-442）**

替换为：

```js
    orient: { type: 'buttonGroup', label: '方向', default: 'horizontal', options: ORIENT_OPTIONS },
```

- [ ] **Step 7: 构建验证**

Run: `npm run build`
Expected: 构建成功；若 `Position`/`Aim` 等图标未导出会在此报错——本计划所用图标均已在 spec 阶段用 `@vue/server-renderer` 验证存在。

- [ ] **Step 8: Commit**

```bash
git add front-end/src/config/chart-configs.js
git commit -m "feat: replace position and direction dropdowns with icon button groups"
```

---

## Task 5: 回归验证（build + e2e）

**Files:**
- Modify: 无（验证用）

- [ ] **Step 1: 检查 e2e 选择器不受影响**

`front-end/scripts/e2e-config-panel.cjs` 中图例部分仅引用 `fieldRow(gLeg, '形状')`、`'宽度'`、`'高度'`，图例「形状」仍是 `el-select`（只是固定 100px 宽），无需改动（已在 spec 阶段核对）。

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 启动前后端并跑 e2e**

Run（backend 目录）: `npm start`，另终端在 front-end 目录跑 `npm run dev` 并确认端口（若 5173 被占则落到其他端口）。
然后在 front-end 根目录跑：
Run: `node scripts/e2e-config-panel.cjs`
Expected: 图例形状选择「菱形」、宽度设 30、高度设 18 均生效，无页面报错，脚本输出通过。

- [ ] **Step 4: 人工检查图标布局**

浏览器打开一个图表编辑页，核对：
- 标题组单行：`水平[← ≡ →] ┇ 垂直[↑ ≡ ↓]`，图例组单行：`方向[→ ↓] 水平[← ≡ →] ┇ 垂直[↑ ≡ ↓]`，不溢出面板宽度。
- 数据标签位置、饼图/环形标签位置、treemap 方向显示为图标按钮，悬停出现中文提示。
- 点击图标后保存并重新打开，`config.options.title.left/top`、`legend.orient/left/top`、`label.position` 值与选择一致。
- 标题字号默认 16，图例/提示框文字字号默认仍为 12。
- 图例「形状」下拉宽度恰好 100px。

- [ ] **Step 5: 收尾提交（若有遗漏改动）**

```bash
git status
# 若 e2e 脚本因结构变化需微调，单独小提交；否则跳过
```

---

## 自审结论

**Spec 覆盖：**
- 请求① 默认标题字号 16 → Task 3 Step 1/2/4（新增 `STYLE_TITLE`，`EChartRenderer` 回退 16）。
- 请求② 位置/方向下拉全部图标化并按组一行 → Task 1（图标渲染）+ Task 2（分隔线/固定宽）+ Task 4（9 处字段，覆盖标题、图例、坐标轴标签、饼图/环形、treemap 全部位置/方向下拉）。
- 请求③ 图例形状下拉宽 100px → Task 3 Step 3 + Task 1 Step 2（`selectWidth`）。

**占位符扫描：** 无 TBD/TODO，每步含完整代码或命令。

**类型一致性：** `selectWidth`、`separator`、`row` 在 Task 1/2/3/4 中拼写一致；图标名 `Aim`/`Expand`/`Fold`/`Position`/各 `Bold` 箭头在 Step 1 常量与字段引用中一致；`STYLE_TITLE` 定义与引用一致。

**未覆盖风险：** 无。任务间前置依赖为「渲染能力」→「布局能力」→「schema 接线」→「验证」，每任务独立可构建。