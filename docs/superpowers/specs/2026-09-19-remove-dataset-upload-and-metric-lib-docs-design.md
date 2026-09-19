# 移除数据集页上传入口 + 指标库文档化 Design

日期：2026-09-19
状态：approved（用户已确认两点决策：彻底移除 / 指标库文档覆盖完整闭环）

## 背景

- 数据源列表页「新建数据源 → 上传 Excel / CSV 文件」（`DataSourceUploadDialog.vue` 三步向导）已完整覆盖 数据集直接上传 的功能（选文件 → 确认字段 → 创建数据集 → 去建图表）。
- 数据集列表页右上角「上传数据」→ 独立向导页 `/datasets/new`（`DatasetUpload.vue`）为冗余重复，需彻底移除。
- 数据集详情页「指标库」Tab（原子/复合/衍生命名指标）此前无文档与截图，需补充。

## 演示数据现状（dev SQLite，不入库提交）

- 数据集 392「门店销售明细」指标库（用于截图与示例）：
  - 销售额 base `{field:amount, agg:sum}` (id 6)
  - 销量 base `{field:*, agg:count}` (id 7)
  - 品类数 base `{field:category, agg:count_distinct}` (id 8)
  - 客单价 expr `$6 / $7` (id 9)
  - 每品类平均 expr `$6 / $8` (id 10)

## 一、代码改动（任务 1：移除数据集页上传）

### DatasetList.vue
1. 删除 `page-header__actions` 中的「上传数据」按钮（第 9-11 行）。
2. `page-desc`（第 6 行）改为：「管理由数据源构建 / 上传的 Excel / CSV 数据集，作为图表与看板的数据基础」。
3. 空态文案（第 54 行）`empty-text` 改为：「还没有数据集，去「数据源」页上传 Excel / CSV 文件创建」。
4. 第 84 行 Excel 数据集「编辑构建」tooltip 文案改为：「文件类数据集不支持「编辑构建」，如需更新数据请在数据源页重新上传」。
5. 清理不再使用的 `<Upload />` 图标引用（script setup 中）。

### DataSourcePanel.vue（ChartBuilder 空数据集提示）
- 第 18 行「还没有数据集，去上传数据」的跳转由 `/datasets/new` 改为 `/datasources`，文案微调为「还没有数据集，去「数据源」页上传」。

### 路由与页面文件
- `router/index.js`：删除 `datasets/new` 路由（name: dataset-upload）。
- 删除文件 `front-end/src/views/DatasetUpload.vue`。
- 全局检索确认无残留引用（`datasetApi.preview` / `datasetApi.create` 由 `DataSourceUploadDialog.vue` 继续使用，API 保留）。

## 二、文档改动（任务 1）

### docs/01-用户手册.md
1. 第 19 行举例「（如「上传数据」「新建图表」「新建看板」）」改为「（如「新建数据源」「新建图表」「新建看板」）」。
2. 「二、上传数据」小节（第 21-28 行）改写为单一入口：
   - 数据源列表页 → 新建数据源 → 上传 Excel / CSV 文件，弹出三步向导（选文件 → 确认字段 → 完成创建，可直接去建图表）。
   - 配图改为 `03-data-source-upload.png`（数据源上传弹窗「确认字段」步骤）。
   - 原文配图 `03-dataset-upload.png` 删除（旧独立向导页已移除）。
3. 「数据集」小节配图 `02-datasets.png`（列表页）需重拍（无上传按钮）；「数据集详情」小节维持 `04-dataset-detail.png`（现图）。
4. 第 163 行速查表「上传一份明细数据」路径由「数据集页 → 上传数据 → ...」改为「数据源页 → 新建数据源 → 上传 Excel / CSV → 确认字段 → 创建」。

### docs/快速开始.md
- 「第 1 步：上传数据」（第 86-94 行）改为数据源页路径：「数据源 → 新建数据源 → 上传 Excel / CSV 文件」；保留文件规范说明。

### docs/03-数据源与构建器.md
- 第 47 行「需通过重新上传文件来替换数据」微调为「需在数据源页重新上传替换」。

## 三、文档新增（任务 2：指标库章节）

### docs/01-用户手册.md 新增「§4.5 指标库」
- 数据集详情页「指标库」Tab：
  - 三类命名指标：原子指标（字段 + 聚合）、复合指标（公式 `$数字ID` 四则运算，可引用原子指标）、衍生指标（环比/同比）。
  - 创建入口「新建指标」，编辑时类型锁定不可改，删除即移除；「公式怎么写」帮助弹窗内置语法规则与示例表。
- 图表构建器中的复用：
  - 指标区的 `+` 添加行，把类型切换为「指标库」，下拉选择命名指标复用（基于该数据集指标库）。
  - 与公式/衍生引用的关系一句话带过。
- 配图两张：
  - `20-dataset-metrics.png`：数据集详情页「指标库」Tab（392，含 销售额/销量/品类数/客单价/每品类平均）。
  - `21-chart-builder-metric-lib.png`：图表构建器指标区含一条「指标库」形态行（选择 客单价）。

## 四、验证与提交

1. `npm run build`（front-end）通过；有 lint 脚本则一并跑。
2. 页面健康检查：/datasets 无按钮且正常渲染；/datasets/new 不再可用（404/引导）；ChartBuilder 空数据集提示跳数据源页；数据集详情「指标库」Tab 正常。
3. 重拍 / 新增截图（1680×960）：
   - 02-datasets.png（重拍：无上传按钮）
   - 03-data-source-upload.png（新增：数据源上传弹窗确认字段步骤；旧 03-dataset-upload.png 删除）
   - 20-dataset-metrics.png（新增：392 指标库 Tab）
   - 21-chart-builder-metric-lib.png（新增：构建器指标库行）
4. 小提交（顺序）：
   - `feat: 移除数据集页上传入口与独立向导页`（代码）
   - `docs: 数据上传改写为数据源入口，重拍/新增截图`（文档 + 02/03 图）
   - `docs: 新增指标库章节（§4.5）与截图`（文档 + 20/21 图）
5. 底层数据（dev SQLite `backend/data`，gitignore）不入库。

## 范围外（YAGNI）
- 不改数据源页任何交互（其上传向导不动）。
- 不动 `DataSourceUploadDialog.vue` 本体。
- 不实现「文件类数据集可重载替换」等功能。